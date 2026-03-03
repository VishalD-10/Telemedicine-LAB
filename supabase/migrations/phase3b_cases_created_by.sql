-- Ensure cases.created_by exists to match frontend queries and RLS policies
alter table public.cases
  add column if not exists created_by uuid references public.profiles (id);

update public.cases c
set created_by = p.created_by
from public.patients p
where c.patient_id = p.id
  and c.created_by is null;
