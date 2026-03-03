-- Phase-2C: Doctor advice / diagnosis table (append-only per case)

create type public.advice_author_role as enum ('rural_doctor', 'specialist');

create table public.doctor_advice (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  author_role public.advice_author_role not null,
  advice_text text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.doctor_advice enable row level security;

-- INSERT: auth.uid() = author_id, user role rural_doctor or specialist, case exists
create policy "Doctors can insert own advice"
on public.doctor_advice
for insert
with check (
  auth.uid() = author_id
  and exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('rural_doctor', 'specialist')
  )
  and exists (
    select 1 from public.cases c
    where c.id = case_id
  )
);

-- SELECT: rural_doctor (own cases only) or specialist (all cases)
create policy "Doctors can read advice for accessible cases"
on public.doctor_advice
for select
using (
  exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('rural_doctor', 'specialist')
  )
  and (
    (exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'specialist'))
    or
    (exists (
      select 1 from public.cases c
      join public.patients p on p.id = c.patient_id
      where c.id = doctor_advice.case_id
        and p.created_by = auth.uid()
    ))
  )
);

-- No UPDATE or DELETE policies (read + insert only)
