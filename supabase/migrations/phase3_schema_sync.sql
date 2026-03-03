-- Phase 3: schema and RLS sync to canonical tele-pulmonology workflow

-- Remove auto case creation trigger if present
DROP TRIGGER IF EXISTS trg_create_case_for_new_patient ON public.patients;
DROP FUNCTION IF EXISTS public.create_case_for_new_patient();

-- Remove case priority trigger if present
DROP TRIGGER IF EXISTS trg_set_case_priority ON public.cases;
DROP FUNCTION IF EXISTS public.set_case_priority_from_latest_data();

-- Add required columns to cases
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS generated_patient_id text,
  ADD COLUMN IF NOT EXISTS created_by uuid references public.profiles (id),
  ADD COLUMN IF NOT EXISTS specialist_id uuid references public.profiles (id),
  ADD COLUMN IF NOT EXISTS rural_diagnosis_report text,
  ADD COLUMN IF NOT EXISTS specialist_diagnosis_report text,
  ADD COLUMN IF NOT EXISTS finalized_report text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Add required columns to specialist_requests
ALTER TABLE public.specialist_requests
  ADD COLUMN IF NOT EXISTS rural_doctor_id uuid references public.profiles (id),
  ADD COLUMN IF NOT EXISTS priority public.case_priority,
  ADD COLUMN IF NOT EXISTS specialist_message text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Drop obsolete status column/type if present
ALTER TABLE public.specialist_requests
  DROP COLUMN IF EXISTS status;
DROP TYPE IF EXISTS public.specialist_request_status;

-- Normalize existing case_priority values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cases' AND column_name = 'priority'
  ) THEN
    UPDATE public.cases SET priority = 'normal' WHERE priority::text = 'routine';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'specialist_requests' AND column_name = 'priority'
  ) THEN
    UPDATE public.specialist_requests SET priority = 'normal' WHERE priority::text = 'routine';
  END IF;
END $$;

-- Normalize existing case_status values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cases' AND column_name = 'status'
  ) THEN
    UPDATE public.cases SET status = 'assigned' WHERE status::text IN ('submitted', 'in_review');
    UPDATE public.cases SET status = 'reviewed' WHERE status::text IN ('awaiting_rural_finalization');
  END IF;
END $$;

-- Replace case_priority enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_priority_new') THEN
    EXECUTE 'CREATE TYPE public.case_priority_new AS ENUM (''emergency'', ''normal'')';
  END IF;
END $$;

ALTER TABLE public.cases
  ALTER COLUMN priority TYPE public.case_priority_new
  USING priority::text::public.case_priority_new;

ALTER TABLE public.specialist_requests
  ALTER COLUMN priority TYPE public.case_priority_new
  USING priority::text::public.case_priority_new;

DROP TYPE IF EXISTS public.case_priority;
ALTER TYPE public.case_priority_new RENAME TO case_priority;

-- Replace case_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_status_new') THEN
    EXECUTE 'CREATE TYPE public.case_status_new AS ENUM (''pending'', ''assigned'', ''reviewed'', ''completed'')';
  END IF;
END $$;

ALTER TABLE public.cases
  ALTER COLUMN status TYPE public.case_status_new
  USING status::text::public.case_status_new;

DROP TYPE IF EXISTS public.case_status;
ALTER TYPE public.case_status_new RENAME TO case_status;

ALTER TABLE public.cases
  ALTER COLUMN status SET DEFAULT 'pending';

-- Backfill cases from patients and specialist requests
UPDATE public.cases c
SET generated_patient_id = p.generated_patient_id,
    created_by = p.created_by
FROM public.patients p
WHERE c.patient_id = p.id
  AND (c.generated_patient_id IS NULL OR c.created_by IS NULL);

UPDATE public.cases c
SET specialist_id = sr.specialist_id
FROM public.specialist_requests sr
WHERE c.id = sr.case_id
  AND c.specialist_id IS NULL;

-- Ensure specialist_requests has rural_doctor_id
UPDATE public.specialist_requests sr
SET rural_doctor_id = c.created_by
FROM public.cases c
WHERE sr.case_id = c.id
  AND sr.rural_doctor_id IS NULL;

-- Enable RLS on specialist_requests if needed
ALTER TABLE public.specialist_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (cases, patients, specialist_requests)
DROP POLICY IF EXISTS "Rural doctors can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Rural doctors can select their patients" ON public.patients;
DROP POLICY IF EXISTS "Specialists can read assigned patients with consent" ON public.patients;
DROP POLICY IF EXISTS "Specialists can read patients with consent" ON public.patients;
DROP POLICY IF EXISTS "Patients can read their own patient row" ON public.patients;
DROP POLICY IF EXISTS "Rural doctors can update their patients" ON public.patients;

DROP POLICY IF EXISTS "Rural doctors can insert cases for their patients" ON public.cases;
DROP POLICY IF EXISTS "Rural doctors can read their own cases" ON public.cases;
DROP POLICY IF EXISTS "Specialists can read assigned cases" ON public.cases;
DROP POLICY IF EXISTS "Specialists can read all cases" ON public.cases;
DROP POLICY IF EXISTS "Specialists can update case diagnosis and status" ON public.cases;
DROP POLICY IF EXISTS "Rural doctors can update case status for their cases" ON public.cases;

DROP POLICY IF EXISTS "Rural doctors can create specialist requests for their cases" ON public.specialist_requests;
DROP POLICY IF EXISTS "Specialists can read and update their requests" ON public.specialist_requests;
DROP POLICY IF EXISTS "Specialists can update their own requests" ON public.specialist_requests;
DROP POLICY IF EXISTS "Rural doctors can read requests for their cases" ON public.specialist_requests;
DROP POLICY IF EXISTS "Rural doctors can insert specialist requests" ON public.specialist_requests;
DROP POLICY IF EXISTS "Specialists can update their requests" ON public.specialist_requests;
DROP POLICY IF EXISTS "Doctors can read related requests" ON public.specialist_requests;

-- Recreate policies per canonical rules
CREATE POLICY "Rural doctors can insert patients"
ON public.patients
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'rural_doctor'
  )
);

CREATE POLICY "Rural doctors can select their patients"
ON public.patients
FOR SELECT
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'rural_doctor'
  )
);

CREATE POLICY "Specialists can read assigned patients"
ON public.patients
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.cases c
    WHERE c.patient_id = patients.id
      AND c.specialist_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'specialist'
  )
);

CREATE POLICY "Rural doctors can insert cases for their patients"
ON public.cases
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'rural_doctor'
  )
  AND EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = patient_id
      AND p.created_by = auth.uid()
  )
);

CREATE POLICY "Rural doctors can read their own cases"
ON public.cases
FOR SELECT
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'rural_doctor'
  )
);

CREATE POLICY "Specialists can read assigned cases"
ON public.cases
FOR SELECT
USING (
  specialist_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'specialist'
  )
);

CREATE POLICY "Rural doctors can finalize their cases"
ON public.cases
FOR UPDATE
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'rural_doctor'
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND status = 'completed'
);

CREATE POLICY "Specialists can update diagnosis"
ON public.cases
FOR UPDATE
USING (
  specialist_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'specialist'
  )
)
WITH CHECK (
  specialist_id = auth.uid()
  AND status = 'reviewed'
);

CREATE POLICY "Rural doctors can insert specialist requests"
ON public.specialist_requests
FOR INSERT
WITH CHECK (
  rural_doctor_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'rural_doctor'
  )
);

CREATE POLICY "Specialists can update their requests"
ON public.specialist_requests
FOR UPDATE
USING (
  specialist_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'specialist'
  )
)
WITH CHECK (
  specialist_id = auth.uid()
);

CREATE POLICY "Doctors can read related requests"
ON public.specialist_requests
FOR SELECT
USING (
  rural_doctor_id = auth.uid()
  OR specialist_id = auth.uid()
);
