# Supabase setup guide

## 1. Create a Supabase project

1. Go to https://supabase.com and create a new project.
2. Copy the project URL and API keys.
3. Add the values to your environment or frontend config.

## 2. Apply the database schema

Run the SQL from `schema.sql` in the Supabase SQL editor.

## 3. Seed essential platform data

Run the SQL from `seed.sql` after the schema is created.

## 4. Configure storage buckets

Create these storage buckets in Supabase Storage:

- course-thumbnails
- course-videos
- course-materials
- tutor-avatars

## 5. Set up authentication

Enable:

- Email authentication
- Google or other OAuth providers if needed later

## 6. Edge functions

Create Edge Functions for:

- course purchase handling
- commission calculation
- withdrawal processing
- notifications
- payment webhooks

## 7. Connect the frontend

Use the generated project URL and anon key in the frontend config. The project is already prepared to accept Supabase client integration.

## 8. Security rules

Protect sensitive tables and ensure only server-side logic can modify financial data, payouts, and tutor commissions.

## Recommended first production rules

- Students can only read their own profile and enrollments.
- Tutors can only manage their own courses and payouts.
- Admins can manage platform-wide data.
- Financial tables should be write-protected from browser code.
