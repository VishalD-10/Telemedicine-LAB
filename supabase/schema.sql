-- ENUM TYPES
create type public.user_role as enum ('rural_doctor', 'specialist', 'patient');

create type public.case_priority as enum ('emergency', 'normal');

create type public.case_status as enum ('pending', 'assigned', 'reviewed', 'reviewing', 'completed');

create type public.gender as enum ('male', 'female', 'other');

-- TABLES

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text,
  hospital_name text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  age integer,
  gender public.gender,
  height_cm numeric,
  weight_kg numeric,
  smoking_history text,
  consent_given boolean not null default false,
  diagnosis_date date,
  generated_patient_id text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table public.vitals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  spo2 numeric,
  respiratory_rate numeric,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table public.spirometry (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  fvc numeric,
  fev1 numeric,
  fev1_fvc numeric,
  fev1_fev6 numeric,
  pef numeric,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients (id) on delete cascade,
  generated_patient_id text,
  created_by uuid not null references auth.users (id) on delete restrict,
  specialist_id uuid references public.profiles (id) on delete restrict,
  priority public.case_priority,
  status public.case_status,
  rural_diagnosis_report text,
  specialist_diagnosis_report text,
  finalized_report text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  assigned_at timestamptz,
  reviewed_at timestamptz,
  completed_at timestamptz
);

create table public.specialist_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases (id) on delete cascade,
  rural_doctor_id uuid references public.profiles (id) on delete restrict,
  specialist_id uuid references public.profiles (id) on delete restrict,
  priority public.case_priority,
  rural_message text,
  specialist_message text,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table public.xrays (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  file_path text not null,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- VIEW FOR SPECIALIST DASHBOARD

create view public.case_summary_for_specialist as
select
  c.id,
  c.patient_id,
  c.priority,
  c.status,
  c.created_at,
  p.name as patient_name,
  v.spo2,
  v.respiratory_rate,
  s.fev1
from public.cases c
join public.patients p on p.id = c.patient_id
left join lateral (
  select spo2, respiratory_rate
  from public.vitals v2
  where v2.patient_id = c.patient_id
  order by v2.created_at desc
  limit 1
) v on true
left join lateral (
  select fev1
  from public.spirometry s2
  where s2.patient_id = c.patient_id
  order by s2.created_at desc
  limit 1
) s on true;

alter view public.case_summary_for_specialist owner to postgres;

-- ENABLE RLS

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.vitals enable row level security;
alter table public.spirometry enable row level security;
alter table public.cases enable row level security;
alter table public.specialist_requests enable row level security;
alter table public.xrays enable row level security;

-- PROFILES POLICIES

create policy "Users can view their own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- PATIENTS POLICIES

create policy "Rural doctors can insert patients"
on public.patients
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
);

create policy "Rural doctors can select their patients"
on public.patients
for select
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
);

create policy "Specialists can read assigned patients"
on public.patients
for select
using (
  exists (
    select 1
    from public.cases c
    where c.patient_id = patients.id
      and c.specialist_id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);

-- CASES POLICIES

create policy "Rural doctors can insert cases for their patients"
on public.cases
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
  and exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.created_by = auth.uid()
  )
);

create policy "Rural doctors can read their own cases"
on public.cases
for select
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
);

create policy "Specialists can read assigned cases"
on public.cases
for select
using (
  specialist_id = auth.uid()
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);

create policy "Rural doctors can finalize their cases"
on public.cases
for update
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
)
with check (
  created_by = auth.uid()
  and status = 'completed'
);

create policy "Specialists can update diagnosis"
on public.cases
for update
using (
  specialist_id = auth.uid()
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
)
with check (
  specialist_id = auth.uid()
  and status = 'reviewed'
);

-- SPECIALIST REQUESTS POLICIES

create policy "Rural doctors can insert specialist requests"
on public.specialist_requests
for insert
with check (
  rural_doctor_id = auth.uid()
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
);

create policy "Specialists can update their requests"
on public.specialist_requests
for update
using (
  specialist_id = auth.uid()
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
)
with check (
  specialist_id = auth.uid()
);

create policy "Doctors can read related requests"
on public.specialist_requests
for select
using (
  rural_doctor_id = auth.uid()
  or specialist_id = auth.uid()
);

-- VITALS POLICIES

create policy "Rural doctors can insert vitals"
on public.vitals
for insert
with check (
  exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
  and exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.created_by = auth.uid()
  )
);

create policy "Rural doctors can read vitals they created via their patients"
on public.vitals
for select
using (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.created_by = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
);

create policy "Specialists can read vitals for assigned patients"
on public.vitals
for select
using (
  exists (
    select 1
    from public.cases c
    where c.patient_id = vitals.patient_id
      and c.specialist_id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);

-- SPIROMETRY POLICIES

create policy "Rural doctors can insert spirometry"
on public.spirometry
for insert
with check (
  exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
  and exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.created_by = auth.uid()
  )
);

create policy "Rural doctors can read spirometry they created via their patients"
on public.spirometry
for select
using (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.created_by = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
);

create policy "Specialists can read spirometry for assigned patients"
on public.spirometry
for select
using (
  exists (
    select 1
    from public.cases c
    where c.patient_id = spirometry.patient_id
      and c.specialist_id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);

-- XRAYS POLICIES

create policy "Rural doctors can insert xray records"
on public.xrays
for insert
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
  and exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.created_by = auth.uid()
  )
);

create policy "Rural doctors can read their own xrays"
on public.xrays
for select
using (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
);

create policy "Specialists can read xrays for assigned patients"
on public.xrays
for select
using (
  exists (
    select 1
    from public.cases c
    where c.patient_id = xrays.patient_id
      and c.specialist_id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);

-- STORAGE POLICIES FOR X-RAYS (bucket: x_rays)

create policy "Rural doctors can upload xrays"
on storage.objects
for insert
with check (
  bucket_id = 'x_rays'
  and lower(name) like '%.dcm'
  and coalesce(metadata->>'mimetype', '') in ('application/dicom', 'application/x-dicom')
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'rural_doctor'
  )
);

create policy "Rural doctors can read their own xrays"
on storage.objects
for select
using (
  bucket_id = 'x_rays'
  and owner = auth.uid()
);

create policy "Specialists can read xrays for assigned patients"
on storage.objects
for select
using (
  bucket_id = 'x_rays'
  and exists (
    select 1
    from public.xrays x
    join public.cases c on c.patient_id = x.patient_id
    where x.file_path = storage.objects.name
      and c.specialist_id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);

-- Auto-update case status when review timestamp is set
create or replace function public.auto_update_case_status()
returns trigger
language plpgsql
as $$
begin

-- Specialist accepted
if new.assigned_at is not null and old.assigned_at is null then
    new.status := 'accepted';
end if;

-- Specialist started reviewing
if new.reviewed_at is not null and old.reviewed_at is null then
    new.status := 'reviewing';
end if;

-- Specialist finished report
if new.reviewed_at is not null 
   and new.status not in ('finalized') 
   and new.report_pdf_path is not null then
    new.status := 'completed';
end if;

return new;

end;
$$;

drop trigger if exists trg_auto_update_case_status on public.cases;
create trigger trg_auto_update_case_status
before update on public.cases
for each row
execute function public.auto_update_case_status();
