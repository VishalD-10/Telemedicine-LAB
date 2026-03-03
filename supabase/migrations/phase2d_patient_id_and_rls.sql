-- Phase-2D: Patient ID generation, case creation, specialist message, and RLS tightening

-- 1) Daily patient sequence table
create table if not exists public.patient_daily_sequences (
  day date primary key,
  last_seq integer not null default 0
);

-- 2) Generate Patient ID (DDMMYYYYNN) at DB level
create or replace function public.set_generated_patient_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seq_val integer;
  effective_date date;
begin
  effective_date := coalesce(new.diagnosis_date, current_date);
  new.diagnosis_date := effective_date;

  insert into public.patient_daily_sequences(day, last_seq)
  values (effective_date, 1)
  on conflict (day) do update
    set last_seq = public.patient_daily_sequences.last_seq + 1
  returning last_seq into seq_val;

  new.generated_patient_id := to_char(effective_date, 'DDMMYYYY') || lpad(seq_val::text, 2, '0');
  return new;
end;
$$;

drop trigger if exists trg_set_generated_patient_id on public.patients;
create trigger trg_set_generated_patient_id
before insert on public.patients
for each row
execute function public.set_generated_patient_id();

-- 3) Auto-create a case for each new patient
create or replace function public.create_case_for_new_patient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cases (patient_id, status)
  values (new.id, 'pending');
  return new;
end;
$$;

drop trigger if exists trg_create_case_for_new_patient on public.patients;
create trigger trg_create_case_for_new_patient
after insert on public.patients
for each row
execute function public.create_case_for_new_patient();

-- 4) Specialist message on accept
alter table public.specialist_requests
  add column if not exists specialist_message text;

-- 5) Tighten specialist access to assigned cases only (and consent)
drop policy if exists "Specialists can read all cases" on public.cases;
create policy "Specialists can read assigned cases"
on public.cases
for select
using (
  exists (
    select 1
    from public.specialist_requests sr
    where sr.case_id = cases.id
      and sr.specialist_id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);

-- Patients: assigned + consent
 drop policy if exists "Specialists can read patients with consent" on public.patients;
create policy "Specialists can read assigned patients with consent"
on public.patients
for select
using (
  consent_given = true
  and exists (
    select 1
    from public.cases c
    join public.specialist_requests sr on sr.case_id = c.id
    where c.patient_id = patients.id
      and sr.specialist_id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);

-- Vitals: assigned + consent
drop policy if exists "Specialists can read vitals with consent" on public.vitals;
create policy "Specialists can read vitals for assigned patients"
on public.vitals
for select
using (
  exists (
    select 1
    from public.patients p
    join public.cases c on c.patient_id = p.id
    join public.specialist_requests sr on sr.case_id = c.id
    where p.id = vitals.patient_id
      and p.consent_given = true
      and sr.specialist_id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);

-- Spirometry: assigned + consent
drop policy if exists "Specialists can read spirometry with consent" on public.spirometry;
create policy "Specialists can read spirometry for assigned patients"
on public.spirometry
for select
using (
  exists (
    select 1
    from public.patients p
    join public.cases c on c.patient_id = p.id
    join public.specialist_requests sr on sr.case_id = c.id
    where p.id = spirometry.patient_id
      and p.consent_given = true
      and sr.specialist_id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);

-- X-rays: assigned + consent
drop policy if exists "Specialists can read xrays with patient consent" on public.xrays;
create policy "Specialists can read xrays for assigned patients"
on public.xrays
for select
using (
  exists (
    select 1
    from public.patients p
    join public.cases c on c.patient_id = p.id
    join public.specialist_requests sr on sr.case_id = c.id
    where p.id = xrays.patient_id
      and p.consent_given = true
      and sr.specialist_id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);

-- 6) Storage policies for x_rays + DICOM-only
drop policy if exists "Rural doctors can upload xrays" on storage.objects;
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

drop policy if exists "Rural doctors can read their own xrays" on storage.objects;
create policy "Rural doctors can read their own xrays"
on storage.objects
for select
using (
  bucket_id = 'x_rays'
  and owner = auth.uid()
);

drop policy if exists "Specialists can read xrays with consent via signed URLs" on storage.objects;
create policy "Specialists can read xrays for assigned patients"
on storage.objects
for select
using (
  bucket_id = 'x_rays'
  and exists (
    select 1
    from public.xrays x
    join public.patients p on p.id = x.patient_id
    join public.cases c on c.patient_id = p.id
    join public.specialist_requests sr on sr.case_id = c.id
    where x.file_path = storage.objects.name
      and p.consent_given = true
      and sr.specialist_id = auth.uid()
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'specialist'
  )
);
