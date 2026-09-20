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

1. Open the project in a browser or serve it locally using a static server.
2. If you want real Supabase auth and database data, configure the frontend with your own project URL and anon key before loading the page.
3. You can do this by setting `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY` before the app scripts run, or by assigning `window.__COURSEHUB_SUPABASE__ = { url: '...', anonKey: '...' }` before `js/supabase.js` is loaded.
4. Apply the SQL from `supabase/schema.sql` in your Supabase project and then seed the starter data from `supabase/seed.sql`.

## Supabase readiness

The app is built to work in two modes:

- Demo mode: static mock data is used when Supabase is not configured.
- Live mode: real auth, profile creation, and course data are used when the project URL and anon key are supplied.

This makes the project usable for local UI work while still having a real backend integration path.
