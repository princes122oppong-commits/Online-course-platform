insert into public.categories (name, slug, description)
values
  ('Web Development', 'web-development', 'Courses for modern frontend and backend development.'),
  ('Design', 'design', 'UI/UX, branding, and digital design learning paths.'),
  ('Marketing', 'marketing', 'Growth, SEO, and digital marketing training.'),
  ('Business', 'business', 'Entrepreneurship and professional business courses.')
on conflict (slug) do nothing;

insert into public.platform_settings (key, value)
values
  ('commission_rate', to_jsonb(0.15::numeric)),
  ('subscription_basic_price', to_jsonb(50::int)),
  ('subscription_premium_price', to_jsonb(100::int)),
  ('default_course_status', to_jsonb('pending'::text)),
  ('default_role', to_jsonb('student'::text))
on conflict (key) do nothing;

-- Demo seed data for the frontend course catalog.
insert into public.courses (
  category,
  title,
  slug,
  short_description,
  description,
  level,
  lessons,
  lesson_count,
  price,
  rating,
  is_published,
  is_featured,
  approval_status,
  tutor_id
)
values
  (
    'Web Development',
    'Complete Web Development',
    'complete-web-development',
    'Build modern websites with HTML, CSS, JavaScript, and backend fundamentals.',
    'Learn how to build full-stack web projects from scratch using practical workflows and production-ready thinking.',
    'Beginner',
    24,
    24,
    250.00,
    4.9,
    true,
    true,
    'approved',
    null
  ),
  (
    'Design',
    'UI/UX Design Basics',
    'ui-ux-design-basics',
    'Design intuitive interfaces with strong layout and user flow principles.',
    'Understand wireframes, visual hierarchy, design systems, and how to prototype clean interfaces that convert.',
    'Intermediate',
    18,
    18,
    180.00,
    4.8,
    true,
    true,
    'approved',
    null
  ),
  (
    'Marketing',
    'Digital Marketing Masterclass',
    'digital-marketing-masterclass',
    'Grow brands using organic reach, content strategy, and campaign planning.',
    'Master strategy, SEO, paid campaigns, and customer journeys for digital-first businesses.',
    'Beginner',
    16,
    16,
    210.00,
    4.7,
    true,
    false,
    'approved',
    null
  )
on conflict (slug) do nothing;
