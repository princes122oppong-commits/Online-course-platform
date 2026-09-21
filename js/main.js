document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.navbar').forEach((navbar, index) => {
    const links = navbar.querySelector('.nav-links');
    if (!links || navbar.querySelector('.menu-toggle')) return;
    const toggle = document.createElement('button');
    toggle.className = 'menu-toggle';
    toggle.type = 'button';
    toggle.textContent = 'Menu';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', `site-nav-${index}`);
    links.id = `site-nav-${index}`;
    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.textContent = isOpen ? 'Close' : 'Menu';
    });
    navbar.querySelector('.nav-actions')?.prepend(toggle);
  });

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('[data-nav]');

  navLinks.forEach(link => {
    const linkFile = link.getAttribute('href');
    if (linkFile === currentPath || (currentPath === '' && linkFile === 'index.html')) {
      link.classList.add('active');
    }
  });

  const counters = document.querySelectorAll('[data-count]');
  counters.forEach(counter => {
    const value = Number(counter.dataset.count || 0);
    counter.textContent = value.toLocaleString();
  });

  const getSupabaseClient = () => window.coursehubSupabase || window.supabase || null;
  const isSupabaseReady = () => Boolean(window.coursehubSupabaseConfig?.hasRealConfig && getSupabaseClient());

  const getDashboardPathForRole = (role) => {
    const normalizedRole = (role || 'student').toLowerCase();
    const targetMap = {
      student: 'student/dashboard.html',
      tutor: 'tutor/dashboard.html',
      admin: 'admin/dashboard.html'
    };
    return targetMap[normalizedRole] || 'student/dashboard.html';
  };

  const getDashboardUrlForRole = (role) => {
    const target = getDashboardPathForRole(role);
    return window.location.pathname.toLowerCase().includes('/admin/') ? `../${target}` : target;
  };

  const setAuthMessage = (messageEl, text, isError = false) => {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.style.color = isError ? '#b91c1c' : '#166534';
    messageEl.style.marginBottom = '12px';
    messageEl.style.fontWeight = '600';
  };

  const redirectAuthenticatedUser = async () => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseReady()) return;

    try {
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) return;

      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profile) return;
      const target = getDashboardUrlForRole(profile.role);
      if (window.location.pathname.split('/').pop() !== target.split('/').pop()) {
        window.location.href = target;
      }
    } catch (error) {
      return;
    }
  };

  const protectAuthenticatedRoute = async () => {
    const path = window.location.pathname.toLowerCase();
    const routeRole = path.includes('/admin/') ? 'admin' : path.includes('/tutor/') ? 'tutor' : path.includes('/student/') ? 'student' : null;

    if (!routeRole) return;

    const client = getSupabaseClient();
    if (!client || !isSupabaseReady()) {
      window.location.replace('../login.html');
      return;
    }

    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) {
        window.location.replace('../login.html');
        return;
      }

      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profile || profile.role !== routeRole) {
        window.location.replace('../index.html');
        return;
      }

      document.documentElement.classList.add('auth-ready');
    } catch (error) {
      window.location.replace('../index.html');
    }
  };

  const fallbackData = {
    courses: [],
    tutors: [],
    dashboards: {
      student: { stats: [], quickStats: [], courses: [], activity: [] },
      tutor: { stats: [], quickStats: [], courses: [], activity: [] },
      admin: { stats: [], quickStats: [], courses: [], activity: [] }
    }
  };

  const resolveCourses = async () => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseReady()) return [];

    try {
      const { data, error } = await client
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error || !data) return [];

      return data.map((course, index) => ({
        id: course.id || index + 1,
        title: course.title || 'Untitled Course',
        category: course.category || course.categories?.name || 'General',
        level: course.level || 'Beginner',
        lessons: Number(course.lessons || course.lesson_count || 0),
        price: Number(course.price || 0),
        rating: Number(course.rating || 0),
        description: course.description || course.short_description || ''
      }));
    } catch (error) {
      return [];
    }
  };

  const renderFeaturedCourses = (courses) => {
    const container = document.getElementById('featuredCourses');
    if (!container) return;

    const items = (courses || []).slice(0, 3);
    container.innerHTML = items.map(course => `
      <article class="course-card">
        <div class="thumb"></div>
        <div class="body">
          <div class="meta"><span>${course.category}</span><span class="rating-pill">★ ${Number(course.rating).toFixed(1)}</span></div>
          <h3>${course.title}</h3>
          <p>${course.description}</p>
          <div class="meta"><span>${course.lessons} lessons</span><span class="price">GH₵${course.price}</span></div>
          <div style="margin-top: 14px;">
            <a class="btn btn-primary" href="course-details.html?id=${course.id}">View Details</a>
          </div>
        </div>
      </article>
    `).join('');
  };

  const renderCategories = () => {
    const container = document.getElementById('popularCategories');
    if (!container) return;

    const categories = [
      { name: 'Development', text: 'Frontend, backend, mobile, and full-stack training.' },
      { name: 'Design', text: 'Branding, UI/UX, visual communication, and product design.' },
      { name: 'Business', text: 'Startup strategy, entrepreneurship, and leadership courses.' }
    ];

    container.innerHTML = categories.map(category => `
      <div class="category-card panel-body">
        <h3>${category.name}</h3>
        <p>${category.text}</p>
      </div>
    `).join('');
  };

  const renderTutors = (tutors) => {
    const container = document.getElementById('topTutors');
    if (!container) return;

    const items = tutors || [];
    container.innerHTML = items.map(tutor => `
      <div class="tutor-card">
        <div class="thumb"></div>
        <div class="body">
          <h3>${tutor.name}</h3>
          <p>${tutor.specialty}</p>
        </div>
      </div>
    `).join('');
  };

  const renderCoursesGrid = (courses) => {
    const container = document.getElementById('coursesGrid');
    if (!container) return;

    const items = courses || [];
    container.innerHTML = items.map(course => `
      <article class="course-card" data-title="${course.title}" data-category="${String(course.category || '').toLowerCase()}">
        <div class="thumb"></div>
        <div class="body">
          <div class="meta"><span>${course.category}</span><span class="rating-pill">★ ${Number(course.rating).toFixed(1)}</span></div>
          <h3>${course.title}</h3>
          <p>${course.description}</p>
          <div class="meta"><span>${course.lessons} lessons</span><span class="price">GH₵${course.price}</span></div>
          <div style="margin-top: 14px;">
            <a class="btn btn-primary" href="course-details.html?id=${course.id}">View Details</a>
          </div>
        </div>
      </article>
    `).join('');
  };

  const searchInput = document.querySelector('#courseSearch');
  const categoryFilter = document.querySelector('#categoryFilter');
  const courseCards = () => Array.from(document.querySelectorAll('.course-card'));

  const applyCourseFilters = () => {
    const cards = courseCards();
    if (!searchInput || !categoryFilter || !cards.length) return;

    const query = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value.toLowerCase();

    cards.forEach(card => {
      const title = (card.dataset.title || '').toLowerCase();
      const cardCategory = (card.dataset.category || '').toLowerCase();
      const matchesQuery = !query || title.includes(query) || cardCategory.includes(query);
      const matchesCategory = category === 'all' || cardCategory === category;
      card.style.display = matchesQuery && matchesCategory ? 'block' : 'none';
    });
  };

  const renderCourseDetail = (courses) => {
    const detailRoot = document.getElementById('courseDetail');
    if (!detailRoot) return;

    const items = courses || [];
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('id');
    const course = items.find(item => String(item.id) === String(courseId));

    if (!course) return;

    detailRoot.innerHTML = `
      <div class="content-box">
        <h2>${course.title}</h2>
        <p>${course.description}</p>
        <div class="meta"><span>${course.category}</span><span>${course.level}</span><span>${course.lessons} lessons</span></div>
        <div class="hero-actions" style="margin-top: 18px;">
          <a class="btn btn-primary" href="register.html">Enroll Now</a>
          <span class="price" style="font-size: 2rem;">GH₵${course.price}</span>
        </div>
      </div>

      <aside class="sidebar">
        <h3>Instructor</h3>
        <p>Kwame Boateng</p>
        <h3>Course info</h3>
        <p>${course.lessons} lessons</p>
        <p>Certificate included</p>
        <p><span class="rating-pill">★ ${Number(course.rating).toFixed(1)}</span> / 5</p>
        <a class="btn btn-primary" href="register.html">Buy This Course</a>
      </aside>
    `;
  };

  const getRoleDashboardData = async (role) => {
    const fallback = fallbackData.dashboards?.[role] || fallbackData.dashboards?.student || {
      stats: [],
      summary: 'Your dashboard is ready.',
      quickStats: [],
      courses: [],
      activity: []
    };

    const client = getSupabaseClient();
    if (!client || !isSupabaseReady()) return fallback;

    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) return fallback;

      const { data: currentProfile, error: profileError } = await client
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !currentProfile) return fallback;

      if (role === 'student') {
        const profileId = currentProfile.id;
        const [{ data: enrollments = [] }, { data: certificates = [] }, { data: progress = [] }] = await Promise.all([
          client.from('enrollments').select('*').eq('student_id', profileId),
          client.from('certificates').select('*').eq('student_id', profileId),
          client.from('course_progress').select('*')
        ]);

        const completionRate = progress.length
          ? Math.round((progress.filter(item => item.is_completed).length / progress.length) * 100)
          : 0;

        return {
          stats: [
            { label: 'Courses enrolled', value: enrollments.length || 0 },
            { label: 'Average progress', value: `${completionRate}%` },
            { label: 'Certificates', value: certificates.length || 0 }
          ],
          summary: progress.length ? 'Your learning progress is updated below.' : 'No learning activity yet.',
          quickStats: [
            { label: 'Completion rate', value: `${completionRate}%` },
            { label: 'Next lesson', value: 'Not started' },
            { label: 'Streak', value: '0 days' }
          ],
          courses: [
            
          ],
          activity: []
        };
      }

      if (role === 'tutor') {
        const profileId = currentProfile.id;
        const [{ data: courses = [] }, { data: courseRows = [] }] = await Promise.all([
          client.from('courses').select('*').eq('tutor_id', profileId),
          client.from('enrollments').select('*')
        ]);

        const courseCount = courses.length || 0;
        const studentCount = courseRows.length;
        const revenueValue = `GH₵${(courseCount * 0).toLocaleString()}`;

        return {
          stats: [
            { label: 'Courses', value: courseCount },
            { label: 'Enrolled students', value: studentCount },
            { label: 'Earnings', value: revenueValue }
          ],
          summary: 'Your tutor data is shown from the database.',
          quickStats: [
            { label: 'Course rating', value: 'Not available' },
            { label: 'Students', value: String(studentCount) },
            { label: 'Earnings', value: revenueValue }
          ],
          courses: [],
          activity: []
        };
      }

      if (role === 'admin') {
        const [{ data: studentProfiles = [] }, { data: tutorProfiles = [] }, { data: orders = [] }] = await Promise.all([
          client.from('profiles').select('*').eq('role', 'student'),
          client.from('profiles').select('*').eq('role', 'tutor'),
          client.from('orders').select('*')
        ]);

        const paidRevenue = (orders || [])
          .filter(item => item.status === 'paid')
          .reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

        return {
          stats: [
            { label: 'Students', value: studentProfiles.length.toLocaleString() },
            { label: 'Tutors', value: tutorProfiles.length },
            { label: 'Revenue', value: `GH₵${paidRevenue.toLocaleString()}` }
          ],
          summary: 'Platform metrics are shown from the database.',
          quickStats: [
            { label: 'New enrollments', value: 'Not available' },
            { label: 'Pending approvals', value: 'Not available' },
            { label: 'Revenue', value: `GH₵${paidRevenue.toLocaleString()}` }
          ],
          courses: [],
          activity: []
        };
      }

      return fallback;
    } catch (error) {
      return fallback;
    }
  };

  const renderDashboard = async () => {
    const path = window.location.pathname.toLowerCase();
    let role = 'student';
    if (path.includes('/tutor/')) role = 'tutor';
    if (path.includes('/admin/')) role = 'admin';

    const dashboardRoot = document.getElementById('dashboardMetrics');
    const quickStatsRoot = document.getElementById('dashboardQuickStats');
    const coursesRoot = document.getElementById('dashboardCourses');
    const activityRoot = document.getElementById('dashboardActivity');
    const summaryRoot = document.getElementById('dashboardSummary');

    const content = await getRoleDashboardData(role);
    const stats = content?.stats || fallbackData.dashboards?.[role]?.stats || [];

    if (dashboardRoot) {
      dashboardRoot.innerHTML = stats.map(item => `
        <div class="stat-box">
          <strong>${item.value}</strong>
          <div>${item.label}</div>
        </div>
      `).join('');
    }

    if (summaryRoot) {
      summaryRoot.textContent = content?.summary || 'Your dashboard is ready.';
    }

    if (quickStatsRoot) {
      const quickStats = content?.quickStats || fallbackData.dashboards?.[role]?.quickStats || [];
      quickStatsRoot.innerHTML = quickStats.map(item => `
        <div class="mini-stat">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </div>
      `).join('');
    }

    if (coursesRoot) {
      const courses = content?.courses || fallbackData.dashboards?.[role]?.courses || [];
      coursesRoot.innerHTML = courses.map(item => `
        <div class="list-row">
          <div class="row-copy">
            <strong>${item.title}</strong>
            <span>${item.status}</span>
          </div>
          <div class="progress-block">
            <div class="progress-bar">
              <span style="width: ${item.progress}%"></span>
            </div>
            <small>${item.progress}%</small>
          </div>
        </div>
      `).join('');
    }

    if (activityRoot) {
      const items = content?.activity || fallbackData.dashboards?.[role]?.activity || [];
      activityRoot.innerHTML = items.map(item => `<li>${item}</li>`).join('');
    }
  };

  if (window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('register.html')) {
    await redirectAuthenticatedUser();
  } else {
    await protectAuthenticatedRoute();
  }

  const courses = await resolveCourses();
  renderFeaturedCourses(courses);
  renderCategories();
  renderTutors(fallbackData.tutors);
  renderCoursesGrid(courses);
  renderCourseDetail(courses);
  await renderDashboard();

  if (searchInput) searchInput.addEventListener('input', applyCourseFilters);
  if (categoryFilter) categoryFilter.addEventListener('change', applyCourseFilters);

  const loginForm = document.querySelector('#loginForm');
  const registerForm = document.querySelector('#registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const email = document.querySelector('#loginForm #email')?.value.trim();
      const password = document.querySelector('#loginForm #password')?.value;
      const messageEl = document.querySelector('#loginForm #authMessage');

      if (!email || !password) {
        setAuthMessage(messageEl, 'Please enter both email and password.', true);
        return;
      }

      const client = getSupabaseClient();
      if (!client || !isSupabaseReady()) {
        setAuthMessage(messageEl, 'The authentication service is unavailable. Please configure Supabase before signing in.', true);
        return;
      }

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthMessage(messageEl, error.message || 'Login failed. Please try again.', true);
        return;
      }

      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      const pageRole = window.location.pathname.toLowerCase().includes('/admin/') ? 'admin' : 'student';
      const target = getDashboardUrlForRole(profile?.role || 'student');

      if (pageRole === 'admin' && profile?.role !== 'admin') {
        setAuthMessage(messageEl, 'This admin portal is restricted to admin accounts only.', true);
        await client.auth.signOut();
        return;
      }

      if (profileError && !profile) {
        setAuthMessage(messageEl, 'Login successful. Profile is still being set up.', false);
        setTimeout(() => window.location.href = target, 800);
        return;
      }

      window.location.href = target;
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const fullName = document.querySelector('#registerForm #fullname')?.value.trim();
      const email = document.querySelector('#registerForm #email')?.value.trim();
      const password = document.querySelector('#registerForm #password')?.value;
      const confirmPassword = document.querySelector('#registerForm #confirmPassword')?.value;
      const messageEl = document.querySelector('#registerForm #authMessage');

      if (!fullName || !email || !password || !confirmPassword) {
        setAuthMessage(messageEl, 'Please fill in your name, email, password, and confirmation.', true);
        return;
      }

      if (password !== confirmPassword) {
        setAuthMessage(messageEl, 'Passwords do not match. Please re-enter them.', true);
        return;
      }

      const client = getSupabaseClient();
      if (!client || !isSupabaseReady()) {
        setAuthMessage(messageEl, 'The authentication service is unavailable. Please configure Supabase before creating an account.', true);
        return;
      }

      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        setAuthMessage(messageEl, error.message || 'Registration failed.', true);
        return;
      }

      if (data.user) {
        const { error: profileError } = await client.from('profiles').upsert({
          user_id: data.user.id,
          full_name: fullName,
          email,
          is_verified: Boolean(data.session)
        }, { onConflict: 'user_id' });

        if (profileError) {
          setAuthMessage(messageEl, 'Account created, but profile setup needs attention.', true);
          return;
        }
      }

      if (data.session) {
        window.location.href = getDashboardUrlForRole('student');
        return;
      }

      setAuthMessage(messageEl, 'Account created. Check your email to confirm and then sign in.', false);
    });
  }
});
