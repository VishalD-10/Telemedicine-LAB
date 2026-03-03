-- Phase-2A: Allow manual Emergency/Routine selection on case submission.
-- The trigger no longer overwrites priority; the application passes it explicitly.

CREATE OR REPLACE FUNCTION public.set_case_priority_from_latest_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Phase-2A: Do not overwrite. Priority is set by the application (Emergency/Routine modal).
  -- If no priority was provided, default to normal.
  IF NEW.priority IS NULL THEN
    NEW.priority := 'normal';
  END IF;
  RETURN NEW;
END;
$$;
