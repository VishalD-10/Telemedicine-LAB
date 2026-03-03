## Tele-pulmonology Platform (Phase 1)

HIPAA-grade tele-pulmonology web platform foundation using **Next.js (App Router)** and **Supabase**.

### Tech stack

- **Frontend**: Next.js (App Router), TypeScript, TailwindCSS  
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)

### Supabase schema and RLS

- Apply the schema in `supabase/schema.sql` to your Supabase project:

```bash
supabase db push --file supabase/schema.sql
```

This creates:

- `profiles`, `patients`, `vitals`, `spirometry`, `cases`, `xrays`
- enum types: `user_role`, `case_priority`, `case_status`, `gender`
- triage trigger `trg_set_case_priority` (automatic emergency vs routine)
- RLS policies enforcing:
  - **rural_doctor**: can create patients, vitals, spirometry, xrays; read only their own
  - **specialist**: can read all cases; raw data only when `consent_given = true`
  - **patient**: can only read their own `patients` row (summary-level)
  - X-rays are private and accessed via signed URLs from bucket `xrays`

### Environment variables

Configure `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser; it is only for secure server-side or Edge function use.

### Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000/login`.

### Auth and roles

- Users are stored in `auth.users`.
- A row in `public.profiles` must exist for each user, with `role` set to one of:
  - `rural_doctor`
  - `specialist`
  - `patient`
- The login page inspects `user_metadata.role` to route to:
  - `/dashboard/rural`
  - `/dashboard/specialist`

### Frontend pages

- `/login`: Supabase email/password login.
- `/dashboard/rural`:
  - Patient intake form.
  - Vitals + spirometry capture.
  - X-ray (DICOM/image) upload to private `xrays` bucket.
  - Case submission (priority computed in Postgres trigger).
- `/dashboard/specialist`:
  - Split view:
    - **🔴 Emergency cases** (top).
    - **🔵 Routine cases** (bottom).
  - Uses Supabase Realtime channel `emergency_cases` on the `cases` table to refresh when new emergency-case rows are inserted.

### Realtime behavior

- `cases` table is configured for Realtime in the frontend by:
  - Subscribing to:
    - Channel: `emergency_cases`
    - Event: `INSERT` on `public.cases` with `priority = 'emergency'`.
  - UI updates emergency list and highlights accordingly.

### Storage rules

- Bucket: `xrays` (private).
- Rural doctors:
  - Can upload to `xrays`.
  - Can read their own uploads.
- Specialists:
  - Can only access objects for patients with `consent_given = true`, via signed URLs.

### Next steps

- Add audited logging (access logs) for HIPAA.
- Extend patient-facing dashboard with summary-only views.
- Add video calling, AI interpretation, and richer workflows in later phases without changing this foundation.

