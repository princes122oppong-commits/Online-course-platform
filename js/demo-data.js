/*
 * Demo content for CourseHub.
 *
 * Used when Supabase is not configured (or a live query fails), so the public
 * pages, dashboards and course details render real-looking content instead of
 * empty grids. Records mirror supabase/seed.sql so demo and live look alike.
 */
(function () {
  const courses = [
    {
      id: 'complete-web-development',
      title: 'Complete Web Development',
      slug: 'complete-web-development',
      category: 'Web Development',
      level: 'Beginner',
      lessons: 24,
      price: 250,
      rating: 4.9,
      description: 'Build modern websites with HTML, CSS, JavaScript, and backend fundamentals.',
      tutor: 'Kwame Boateng'
    },
    {
      id: 'ui-ux-design-basics',
      title: 'UI/UX Design Basics',
      slug: 'ui-ux-design-basics',
      category: 'Design',
      level: 'Intermediate',
      lessons: 18,
      price: 180,
      rating: 4.8,
      description: 'Design intuitive interfaces with strong layout and user flow principles.',
      tutor: 'Efua Sarpong'
    },
    {
      id: 'digital-marketing-masterclass',
      title: 'Digital Marketing Masterclass',
      slug: 'digital-marketing-masterclass',
      category: 'Marketing',
      level: 'Beginner',
      lessons: 16,
      price: 210,
      rating: 4.7,
      description: 'Grow brands using organic reach, content strategy, and campaign planning.',
      tutor: 'Nana Adjei'
    }
  ];

  const tutors = [
    {
      id: 'tutor-kwame',
      name: 'Kwame Boateng',
      specialty: 'Web Development',
      bio: 'Full-stack engineer teaching production-ready JavaScript workflows.'
    },
    {
      id: 'tutor-efua',
      name: 'Efua Sarpong',
      specialty: 'UI/UX Design',
      bio: 'Product designer focused on design systems and accessible interfaces.'
    },
    {
      id: 'tutor-nana',
      name: 'Nana Adjei',
      specialty: 'Digital Marketing',
      bio: 'Growth strategist with a decade of campaign and SEO experience.'
    }
  ];

  const categories = [
    { name: 'Web Development', text: 'Frontend, backend, mobile, and full-stack training.' },
    { name: 'Design', text: 'Branding, UI/UX, visual communication, and product design.' },
    { name: 'Marketing', text: 'SEO, campaigns, content strategy, and growth analytics.' },
    { name: 'Business', text: 'Startup strategy, entrepreneurship, and leadership courses.' }
  ];

  const dashboards = {
    student: {
      stats: [
        { label: 'Courses enrolled', value: 3 },
        { label: 'Average progress', value: '70%' },
        { label: 'Certificates', value: 2 }
      ],
      summary: 'You are viewing a demo account. Configure Supabase to load your real learning data.',
      quickStats: [
        { label: 'Completion rate', value: '70%' },
        { label: 'Next lesson', value: 'CSS Fundamentals' },
        { label: 'Streak', value: '4 days' }
      ],
      courses: [
        { title: 'Complete Web Development', status: 'In progress', progress: 72 },
        { title: 'UI/UX Design Basics', status: 'In progress', progress: 58 },
        { title: 'Digital Marketing Masterclass', status: 'In progress', progress: 81 }
      ],
      activity: [
        'Completed lesson: HTML Basics',
        'Earned certificate: UI/UX Design Basics',
        'Enrolled in Digital Marketing Masterclass'
      ]
    },
    tutor: {
      stats: [
        { label: 'Courses', value: 3 },
        { label: 'Enrolled students', value: 128 },
        { label: 'Earnings', value: 'GH\u20b512,450.00' }
      ],
      summary: 'You are viewing a demo account. Configure Supabase to load your real tutor data.',
      quickStats: [
        { label: 'Course rating', value: '4.8' },
        { label: 'Students', value: '128' },
        { label: 'Earnings', value: 'GH\u20b512,450.00' }
      ],
      courses: [
        { title: 'Complete Web Development', status: 'Published', progress: 100 },
        { title: 'UI Design Crash Course', status: 'Draft', progress: 40 },
        { title: 'Digital Growth Strategies', status: 'Pending review', progress: 75 }
      ],
      activity: [
        'New enrollment in Complete Web Development',
        'Course submitted for review: Digital Growth Strategies',
        'Payout released: GH\u20b52,100.00'
      ]
    },
    admin: {
      stats: [
        { label: 'Students', value: '342' },
        { label: 'Tutors', value: '28' },
        { label: 'Revenue', value: 'GH\u20b548,900.00' }
      ],
      summary: 'You are viewing a demo account. Configure Supabase to load live platform metrics.',
      quickStats: [
        { label: 'New enrollments', value: '37' },
        { label: 'Pending approvals', value: '4' },
        { label: 'Revenue', value: 'GH\u20b548,900.00' }
      ],
      courses: [
        { title: 'Complete Web Development', status: 'Published', progress: 100 },
        { title: 'UI/UX Design Basics', status: 'Published', progress: 100 },
        { title: 'Digital Growth Strategies', status: 'Pending review', progress: 60 }
      ],
      activity: [
        'Approved course: UI/UX Design Basics',
        'Processed withdrawal: GH\u20b51,500.00',
        'New tutor registration: Nana Adjei'
      ]
    }
  };

  const platformSnapshot = { students: 342, tutors: 28, courses: 3 };

  window.coursehubDemoData = {
    courses,
    tutors,
    categories,
    dashboards,
    platformSnapshot
  };
})();
