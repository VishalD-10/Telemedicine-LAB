-- Master workflow: patient ID, case lifecycle, specialist requests

-- 1. Patients: diagnosis_date and generated_patient_id
alter table public.patients
  add column if not exists diagnosis_date date,
  add column if not exists generated_patient_id text;

-- 2. Extend case_status enum (add new values; run once)
alter type public.case_status add value if not exists 'submitted';
alter type public.case_status add value if not exists 'in_review';
alter type public.case_status add value if not exists 'completed';

-- 3. Cases: rural and specialist reports, follow-up
alter table public.cases
  add column if not exists rural_diagnosis_report text,
  add column if not exists specialist_diagnosis_report text,
  add column if not exists follow_up_notes text;

-- 4. Specialist request status
create type public.specialist_request_status as enum ('pending', 'accepted', 'completed');

-- 5. Specialist requests table
create table if not exists public.specialist_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  specialist_id uuid not null references public.profiles (id) on delete restrict,
  rural_message text,
  status public.specialist_request_status not null default 'pending',
  created_at timestamptz not null default timezone('utc'::text, now()),
  accepted_at timestamptz,
  completed_at timestamptz
);

alter table public.specialist_requests enable row level security;

-- RLS: rural doctors can insert for their cases; specialists can update (accept/complete) and read their requests
create policy "Rural doctors can create specialist requests for their cases"
on public.specialist_requests
for insert
with check (
  exists (
    select 1 from public.cases c
    join public.patients p on p.id = c.patient_id
    where c.id = case_id and p.created_by = auth.uid()
  )
);

create policy "Specialists can read and update their requests"
on public.specialist_requests
for select
using (specialist_id = auth.uid());

create policy "Specialists can update their own requests"
on public.specialist_requests
for update
using (specialist_id = auth.uid())
with check (specialist_id = auth.uid());

create policy "Rural doctors can read requests for their cases"
on public.specialist_requests
for select
using (
  exists (
    select 1 from public.cases c
    join public.patients p on p.id = c.patient_id
    where c.id = case_id and p.created_by = auth.uid()
  )
);

-- 6. Cases: allow update for status and specialist report (by specialist or system)
create policy "Specialists can update case diagnosis and status"
on public.cases
for update
using (
  exists (
    select 1 from public.specialist_requests sr
    where sr.case_id = cases.id and sr.specialist_id = auth.uid()
  )
)
with check (true);

create policy "Rural doctors can update case status for their cases"
on public.cases
for update
using (
  exists (
    select 1 from public.patients p
    where p.id = cases.patient_id and p.created_by = auth.uid()
  )
)
with check (true);

-- 7. Patients: allow update for generated_patient_id (by rural doctor who created)
create policy "Rural doctors can update their patients"
on public.patients
for update
using (created_by = auth.uid())
with check (created_by = auth.uid());
