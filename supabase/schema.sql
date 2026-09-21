create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  full_name text,
  email text unique not null,
  phone text,
  avatar_url text,
  role text not null default 'student' check (role in ('student','tutor','admin')),
  is_verified boolean default false,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_profiles_user_id_unique
on public.profiles(user_id);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  )
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before update on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, email, role, is_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    case
      when new.raw_user_meta_data ->> 'account_type' in ('student', 'tutor')
        then new.raw_user_meta_data ->> 'account_type'
      else 'student'
    end,
    false
  )
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        role = public.profiles.role,
        updated_at = now();

  return new;
end;
$$;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  parent_id uuid references public.categories(id),
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id),
  category text not null default 'General',
  title text not null,
  slug text unique not null,
  short_description text,
  description text,
  level text not null default 'Beginner' check (level in ('Beginner','Intermediate','Advanced')),
  lessons int not null default 0,
  lesson_count int not null default 0,
  price numeric(12,2) not null default 0,
  rating numeric(3,1) not null default 4.7,
  thumbnail_url text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses
  add column if not exists category text not null default 'General';

alter table public.courses
  add column if not exists level text not null default 'Beginner';

alter table public.courses
  add column if not exists lessons int not null default 0;

alter table public.courses
  add column if not exists lesson_count int not null default 0;

alter table public.courses
  add column if not exists price numeric(12,2) not null default 0;

alter table public.courses
  add column if not exists rating numeric(3,1) not null default 4.7;

alter table public.courses
  add column if not exists is_published boolean not null default false;

alter table public.courses
  add column if not exists is_featured boolean not null default false;

alter table public.courses
  add column if not exists approval_status text not null default 'pending';

alter table public.courses
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  sort_order int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.course_modules(id) on delete cascade,
  title text not null,
  content text,
  video_url text,
  duration_minutes int not null default 0,
  sort_order int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.course_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.course_lessons(id) on delete cascade,
  title text not null,
  file_url text not null,
  file_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  question_text text not null,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  enrolled_at timestamptz not null default now(),
  unique(student_id, course_id)
);

create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references public.enrollments(id) on delete cascade,
  lesson_id uuid references public.course_lessons(id) on delete cascade,
  is_completed boolean not null default false,
  last_position_seconds int not null default 0,
  updated_at timestamptz not null default now(),
  unique(enrollment_id, lesson_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id),
  subscription_id uuid,
  total_amount numeric(12,2) not null,
  commission_amount numeric(12,2) not null default 0,
  tutor_amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  gateway text not null default 'manual',
  gateway_reference text,
  amount numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade,
  plan_name text not null,
  price numeric(12,2) not null,
  status text not null default 'active' check (status in ('active','cancelled','expired')),
  started_at timestamptz not null default now(),
  ends_at timestamptz
);

create table if not exists public.tutor_earnings (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id),
  amount numeric(12,2) not null,
  commission_rate numeric(5,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','paid','released')),
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  payout_method text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  rating int check (rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  certificate_code text unique not null,
  issued_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.course_materials enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.enrollments enable row level security;
alter table public.course_progress enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.tutor_earnings enable row level security;
alter table public.withdrawals enable row level security;
alter table public.reviews enable row level security;
alter table public.certificates enable row level security;
alter table public.notifications enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Public can read published courses" on public.courses;
create policy "Public can read published courses"
on public.courses for select
using (
  (is_published = true and approval_status = 'approved')
  or tutor_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories"
on public.categories for select
using (true);

drop policy if exists "Users can view their own enrollments" on public.enrollments;
create policy "Users can view their own enrollments"
on public.enrollments for select
using (student_id = public.current_profile_id() or public.is_admin());

drop policy if exists "Users can create their own enrollments" on public.enrollments;
create policy "Users can create their own enrollments"
on public.enrollments for insert
with check (student_id = public.current_profile_id());

drop policy if exists "Users can update their own enrollments" on public.enrollments;
create policy "Users can update their own enrollments"
on public.enrollments for update
using (student_id = public.current_profile_id() or public.is_admin())
with check (student_id = public.current_profile_id() or public.is_admin());

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
on public.notifications for select
using (user_id = public.current_profile_id() or public.is_admin());

drop policy if exists "Course owners can manage their courses" on public.courses;
create policy "Course owners can manage their courses"
on public.courses for insert
with check (tutor_id = public.current_profile_id());

drop policy if exists "Course owners can update their courses" on public.courses;
create policy "Course owners can update their courses"
on public.courses for update
using (tutor_id = public.current_profile_id() or public.is_admin())
with check (tutor_id = public.current_profile_id() or public.is_admin());

create index if not exists idx_courses_tutor on public.courses(tutor_id);
create index if not exists idx_courses_category on public.courses(category_id);
create index if not exists idx_courses_category_text on public.courses(category);
create index if not exists idx_courses_rating on public.courses(rating);
create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_orders_student on public.orders(student_id);
create index if not exists idx_notifications_user on public.notifications(user_id);

-- Reapply policies with profile IDs and explicit ownership checks.
drop policy if exists "Public can read published courses" on public.courses;
create policy "Public can read published courses"
on public.courses for select
using (
  (is_published = true and approval_status = 'approved')
  or tutor_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists "Users can view their own enrollments" on public.enrollments;
create policy "Users can view their own enrollments"
on public.enrollments for select
using (student_id = public.current_profile_id() or public.is_admin());

drop policy if exists "Students can create enrollments" on public.enrollments;
create policy "Students can create enrollments"
on public.enrollments for insert
with check (student_id = public.current_profile_id());

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
on public.notifications for select
using (user_id = public.current_profile_id() or public.is_admin());

drop policy if exists "Course owners can manage their courses" on public.courses;
create policy "Course owners can manage their courses"
on public.courses for insert
with check (tutor_id = public.current_profile_id());

drop policy if exists "Course owners can update their courses" on public.courses;
create policy "Course owners can update their courses"
on public.courses for update
using (tutor_id = public.current_profile_id() or public.is_admin())
with check (tutor_id = public.current_profile_id() or public.is_admin());

drop policy if exists "Admins can manage courses" on public.courses;
create policy "Admins can manage courses"
on public.courses for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published modules" on public.course_modules;
create policy "Public can read published modules"
on public.course_modules for select
using (exists (
  select 1 from public.courses c
  where c.id = course_id and c.is_published and c.approval_status = 'approved'
));

drop policy if exists "Public can read published lessons" on public.course_lessons;
create policy "Public can read published lessons"
on public.course_lessons for select
using (exists (
  select 1 from public.course_modules m
  join public.courses c on c.id = m.course_id
  where m.id = module_id and c.is_published and c.approval_status = 'approved'
));

drop policy if exists "Public can read published materials" on public.course_materials;
create policy "Public can read published materials"
on public.course_materials for select
using (exists (
  select 1 from public.course_lessons l
  join public.course_modules m on m.id = l.module_id
  join public.courses c on c.id = m.course_id
  where l.id = lesson_id and c.is_published and c.approval_status = 'approved'
));

drop policy if exists "Public can read published quizzes" on public.quizzes;
create policy "Public can read published quizzes"
on public.quizzes for select
using (exists (
  select 1 from public.courses c
  where c.id = course_id and c.is_published and c.approval_status = 'approved'
));

drop policy if exists "Admins can manage quiz questions" on public.quiz_questions;
create policy "Admins can manage quiz questions"
on public.quiz_questions for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Students can manage course progress" on public.course_progress;
create policy "Students can manage course progress"
on public.course_progress for all
using (exists (
  select 1 from public.enrollments e
  where e.id = enrollment_id and e.student_id = public.current_profile_id()
))
with check (exists (
  select 1 from public.enrollments e
  where e.id = enrollment_id and e.student_id = public.current_profile_id()
));

drop policy if exists "Users can view their own orders" on public.orders;
create policy "Users can view their own orders"
on public.orders for select
using (student_id = public.current_profile_id() or public.is_admin());

drop policy if exists "Users can view their own payments" on public.payments;
create policy "Users can view their own payments"
on public.payments for select
using (exists (
  select 1 from public.orders o
  where o.id = order_id and (o.student_id = public.current_profile_id() or public.is_admin())
));

drop policy if exists "Users can view their own subscriptions" on public.subscriptions;
create policy "Users can view their own subscriptions"
on public.subscriptions for select
using (student_id = public.current_profile_id() or public.is_admin());

drop policy if exists "Tutors can view their earnings" on public.tutor_earnings;
create policy "Tutors can view their earnings"
on public.tutor_earnings for select
using (tutor_id = public.current_profile_id() or public.is_admin());

drop policy if exists "Tutors can view their withdrawals" on public.withdrawals;
create policy "Tutors can view their withdrawals"
on public.withdrawals for select
using (tutor_id = public.current_profile_id() or public.is_admin());

drop policy if exists "Public can read reviews" on public.reviews;
create policy "Public can read reviews"
on public.reviews for select using (true);

drop policy if exists "Students can create reviews" on public.reviews;
create policy "Students can create reviews"
on public.reviews for insert
with check (student_id = public.current_profile_id());

drop policy if exists "Students can view their certificates" on public.certificates;
create policy "Students can view their certificates"
on public.certificates for select
using (student_id = public.current_profile_id() or public.is_admin());

drop policy if exists "Admins can manage platform settings" on public.platform_settings;
create policy "Admins can manage platform settings"
on public.platform_settings for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can manage audit logs" on public.audit_logs;
create policy "Admins can manage audit logs"
on public.audit_logs for all
using (public.is_admin()) with check (public.is_admin());
