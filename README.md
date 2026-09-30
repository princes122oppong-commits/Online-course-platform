# Online Course Platform

A professional multi-role online learning platform foundation built with HTML, CSS, JavaScript, and Supabase.

## Roles

- Student
- Tutor
- Admin

## Core structure

- Public marketing pages
- Student dashboard
- Tutor dashboard
- Admin dashboard
- Supabase schema and seed scripts

## Tech stack

- Frontend: HTML, CSS, JavaScript
- Backend: Supabase
- Auth: Supabase Auth
- Database: Supabase PostgreSQL
- Storage: Supabase Storage
- Edge Functions: Supabase Functions

## Phase order

1. Foundation
2. Public website
3. Student area
4. Tutor dashboard
5. Monetization
6. Admin dashboard
7. Advanced features

## Quick start

1. Install dependencies with `npm install`.
2. Start the site with `npm start`.
3. Copy your Supabase project URL and publishable anon key into `config.js`.
4. Run the complete SQL from `supabase/schema.sql` in the Supabase SQL editor.
5. Run `supabase/seed.sql` to create the initial categories and platform settings.
6. Open the URL printed by the server, normally `http://localhost:8000`.

## Production safety

- The frontend uses only the Supabase publishable anon key. Never put a service-role key in `config.js` or any browser-delivered file.
- Keep service-role keys, database passwords, payment credentials, and webhook secrets in Supabase Edge Functions or deployment secrets.
- The application refuses authentication and protected routes until Supabase is configured.
- Use `npm start` or `npm run dev` for local development. The default port is `8000` and the server will automatically try the next available port if needed.

## Live Supabase behavior

The application is configured for a real backend-first flow:

- Supabase Auth handles registration, login, sessions, refresh, and logout.
- Profiles are created by the `on_auth_user_created` database trigger.
- Published courses are read from `public.courses`.
- Tutor course submissions are inserted into `public.courses` as pending review.
- Enrollment is created through the protected `enroll_in_course` database function.
- Withdrawal requests are created through the protected `request_withdrawal` database function.
- Row-level security prevents users from changing roles, publishing courses, or writing financial records directly.

Paid checkout still requires a payment provider and a Supabase Edge Function to create and verify paid orders. The database function deliberately refuses paid-course enrollment until an order has status `paid`.
