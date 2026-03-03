-- Ensure cases.created_by exists and references auth.users
alter table public.cases
  add column if not exists created_by uuid references auth.users (id);

update public.cases c
set created_by = p.created_by
from public.patients p
where c.patient_id = p.id
  and c.created_by is null;

do $$
begin
  if not exists (
    select 1 from public.cases where created_by is null
  ) then
    execute 'alter table public.cases alter column created_by set not null';
  end if;
end $$;
