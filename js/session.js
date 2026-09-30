/*
 * CourseHub session and local data system.
 *
 * This is the real application state layer for the current codebase: persisted
 * local user records, role-based sessions, course enrollment, and tutor course
 * creation all live in browser storage instead of mock-only data.
 */
(function () {
  const ROLE_HOME = {
    student: 'student/dashboard.html',
    tutor: 'tutor/dashboard.html',
    admin: 'admin/dashboard.html'
  };

  const PROTECTED_SEGMENTS = ['/student/', '/tutor/', '/admin/'];
  const STORAGE_KEY = 'coursehub-system-v1';
  const SESSION_KEY = 'coursehub-session-v1';

  let cachedActor = null;

  const getClient = () => window.coursehubSupabase || null;
  const isConfigured = () => Boolean(window.coursehubSupabaseConfig?.hasRealConfig && getClient());
  const isDemoMode = () => !isConfigured();

  const currentPath = () => window.location.pathname.toLowerCase();
  const isInsideProtectedFolder = () => PROTECTED_SEGMENTS.some((segment) => currentPath().includes(segment));
  const resolveHref = (target) => (isInsideProtectedFolder() ? `../${target}` : target);

  const routeRole = () => {
    const path = currentPath();
    if (path.includes('/admin/')) return 'admin';
    if (path.includes('/tutor/')) return 'tutor';
    if (path.includes('/student/')) return 'student';
    return null;
  };

  const isAuthPath = () => currentPath().endsWith('/login.html') || currentPath().endsWith('/register.html');
  const redirect = (href) => window.location.replace(href);
  const redirectToLogin = () => redirect(resolveHref('login.html'));
  const redirectToHome = () => redirect(resolveHref('index.html'));
  const redirectToDashboard = (role) => redirect(resolveHref(ROLE_HOME[role] || ROLE_HOME.student));

  const seedState = () => ({
    users: [
      { id: 'user-student', fullName: 'Ada Mensah', email: 'student@example.com', password: 'student123', role: 'student' },
      { id: 'user-tutor', fullName: 'Kwame Boateng', email: 'tutor@example.com', password: 'tutor123', role: 'tutor' },
      { id: 'user-admin', fullName: 'Admin User', email: 'admin@example.com', password: 'admin123', role: 'admin' }
    ],
    courses: [
      { id: 'course-1', title: 'Complete Web Development', category: 'Web Development', price: 250, level: 'Beginner', lessons: 24, description: 'Build modern websites and production-ready frontend workflows.', tutorId: 'user-tutor', rating: 4.9 },
      { id: 'course-2', title: 'UI/UX Design Basics', category: 'Design', price: 180, level: 'Intermediate', lessons: 18, description: 'Design solid interfaces with clarity and user-focused thinking.', tutorId: 'user-tutor', rating: 4.8 },
      { id: 'course-3', title: 'Digital Marketing Masterclass', category: 'Marketing', price: 210, level: 'Beginner', lessons: 16, description: 'Plan campaigns, content, and conversions with strong strategy.', tutorId: 'user-tutor', rating: 4.7 }
    ],
    enrollments: [],
    activity: []
  });

  const getLocalState = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seeded = seedState();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        return seeded;
      }
      return JSON.parse(raw);
    } catch (error) {
      return seedState();
    }
  };

  const setLocalState = (state) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      return false;
    }
  };

  const getSession = () => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };

  const setSession = (session) => {
    try {
      if (!session) {
        window.localStorage.removeItem(SESSION_KEY);
        return true;
      }
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return true;
    } catch (error) {
      return false;
    }
  };

  const getUserByEmail = (email) => {
    const state = getLocalState();
    return state.users.find((user) => String(user.email).toLowerCase() === String(email || '').trim().toLowerCase()) || null;
  };

  const registerLocalUser = ({ fullName, email, accountType, password }) => {
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedName = String(fullName || '').trim();
    const role = accountType === 'tutor' ? 'tutor' : 'student';

    if (!trimmedEmail || !trimmedName || !password) {
      return { ok: false, message: 'Please complete all required fields.' };
    }

    if (getUserByEmail(trimmedEmail)) {
      return { ok: false, message: 'This email is already registered.' };
    }

    const state = getLocalState();
    const user = {
      id: `user-${Date.now()}`,
      fullName: trimmedName,
      email: trimmedEmail,
      password,
      role
    };

    state.users.push(user);
    state.activity.unshift({
      type: 'user_registered',
      userId: user.id,
      message: `${user.fullName} joined CourseHub`,
      createdAt: new Date().toISOString()
    });
    setLocalState(state);
    setSession({ userId: user.id, role, fullName: user.fullName, email: trimmedEmail });
    return { ok: true, user };
  };

  const loginLocalUser = ({ email, password }) => {
    const user = getUserByEmail(email);
    if (!user || user.password !== String(password || '')) {
      return { ok: false, message: 'Invalid email or password.' };
    }

    const session = { userId: user.id, role: user.role, fullName: user.fullName, email: user.email };
    setSession(session);
    return { ok: true, user, session };
  };

  const getCurrentLocalUser = () => {
    const session = getSession();
    if (!session?.userId) return null;
    const state = getLocalState();
    return state.users.find((user) => user.id === session.userId) || null;
  };

  const getCurrentUserRole = () => getSession()?.role || getCurrentLocalUser()?.role || null;
  const getAllCourses = () => getLocalState().courses || [];

  const createCourse = ({ title, category, price, description, level, tutorId }) => {
    const state = getLocalState();
    const course = {
      id: `course-${Date.now()}`,
      title: String(title || '').trim(),
      category: String(category || 'Web Development').trim(),
      price: Number(price || 0),
      description: String(description || '').trim(),
      level: String(level || 'Beginner').trim(),
      lessons: 12,
      rating: 4.8,
      tutorId: tutorId || getCurrentLocalUser()?.id || 'user-tutor'
    };

    if (!course.title || !course.description) {
      return { ok: false, message: 'Course title and description are required.' };
    }

    state.courses.unshift(course);
    state.activity.unshift({
      type: 'course_created',
      userId: course.tutorId,
      message: `${course.title} was published`,
      createdAt: new Date().toISOString()
    });
    setLocalState(state);
    return { ok: true, course };
  };

  const createCourseLive = async ({ title, category, price, description, level, tutorId }) => {
    const client = getClient();
    const actor = await getActor();
    if (!client || !isConfigured() || !actor || actor.profile.role !== 'tutor') {
      return { ok: false, message: 'Only authenticated tutors can create courses.' };
    }

    const slug = `${String(title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
    const result = await client.from('courses').insert({
      tutor_id: tutorId || actor.profile.id,
      title: String(title || '').trim(),
      slug,
      category: String(category || 'General').trim(),
      level: String(level || 'Beginner').trim(),
      price: Number(price || 0),
      short_description: String(description || '').trim(),
      description: String(description || '').trim(),
      lessons: 0,
      lesson_count: 0,
      is_published: false,
      approval_status: 'pending'
    }).select('id, title, approval_status').single();

    return result.error ? { ok: false, message: result.error.message } : { ok: true, course: result.data };
  };

  const enrollInCourse = (courseId) => {
    const session = getSession();
    const user = getCurrentLocalUser();
    if (!session || !user) {
      return { ok: false, message: 'Please sign in first.' };
    }

    const state = getLocalState();
    const alreadyEnrolled = state.enrollments.some((item) => item.userId === user.id && item.courseId === courseId);
    if (alreadyEnrolled) {
      return { ok: false, message: 'You are already enrolled in this course.' };
    }

    state.enrollments.push({
      id: `enrollment-${Date.now()}`,
      userId: user.id,
      courseId,
      enrolledAt: new Date().toISOString()
    });
    state.activity.unshift({
      type: 'course_enrolled',
      userId: user.id,
      message: `Enrollment created for ${courseId}`,
      createdAt: new Date().toISOString()
    });
    setLocalState(state);
    return { ok: true };
  };

  const enrollInCourseLive = async (courseId) => {
    const client = getClient();
    if (!client || !isConfigured()) return { ok: false, message: 'Supabase is not configured.' };
    const result = await client.rpc('enroll_in_course', { p_course_id: courseId });
    return result.error ? { ok: false, message: result.error.message } : { ok: true, enrollment: result.data };
  };

  const loadProfile = async (userId, columns = 'id, user_id, role, full_name, email, avatar_url, bio') => {
    const client = getClient();
    if (!client || !userId) return null;

    const { data, error } = await client
      .from('profiles')
      .select(columns)
      .eq('user_id', userId)
      .maybeSingle();

    return error ? null : data;
  };

  const ensureProfile = async (user) => {
    const existing = await loadProfile(user.id);
    if (existing) return existing;

    const client = getClient();
    if (!client) return null;

    const accountType = user.user_metadata?.account_type === 'tutor' ? 'tutor' : 'student';

    const { data, error } = await client
      .from('profiles')
      .insert({
        user_id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'CourseHub user',
        email: user.email,
        role: accountType,
        is_verified: false
      })
      .select('id, user_id, role, full_name, email, avatar_url, bio')
      .single();

    return error ? null : data;
  };

  const getActor = async () => {
    if (cachedActor) return cachedActor;
    if (!isConfigured()) return null;
    const client = getClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return null;

    const profile = await ensureProfile(session.user);
    if (!profile) return null;

    cachedActor = { session, user: session.user, profile };
    return cachedActor;
  };

  const guard = async (requiredRole) => {
    if (!requiredRole) return { allowed: true, mode: isDemoMode() ? 'local' : 'live', actor: null };

    if (isConfigured()) {
      const actor = await getActor();
      if (!actor) {
        redirectToLogin();
        return { allowed: false, mode: 'live', actor: null };
      }

      if (actor.profile.role !== requiredRole) {
        if (ROLE_HOME[actor.profile.role]) redirectToDashboard(actor.profile.role);
        else redirectToHome();
        return { allowed: false, mode: 'live', actor };
      }

      return { allowed: true, mode: 'live', actor };
    }

    if (isDemoMode()) {
      redirectToLogin();
      return { allowed: false, mode: 'local', actor: null };
    }

    const actor = await getActor();
    if (!actor) {
      redirectToLogin();
      return { allowed: false, mode: 'live', actor: null };
    }

    if (actor.profile.role !== requiredRole) {
      if (ROLE_HOME[actor.profile.role]) redirectToDashboard(actor.profile.role);
      else redirectToHome();
      return { allowed: false, mode: 'live', actor };
    }

    return { allowed: true, mode: 'live', actor };
  };

  const redirectSignedInUsers = async () => {
    if (isConfigured()) {
      const actor = await getActor();
      if (!actor) return false;
      redirectToDashboard(actor.profile.role);
      return true;
    }

    const localSession = getSession();
    if (localSession?.role) {
      redirectToDashboard(localSession.role);
      return true;
    }

    if (isDemoMode()) return false;

    const actor = await getActor();
    if (!actor) return false;

    redirectToDashboard(actor.profile.role);
    return true;
  };

  const signOut = async () => {
    const client = getClient();
    cachedActor = null;
    if (client && isConfigured()) {
      await client.auth.signOut();
    }
    setSession(null);
    redirectToHome();
  };

  const isLogoutLink = (link) => {
    if (link.hasAttribute('data-logout')) return true;
    const href = (link.getAttribute('href') || '').toLowerCase();
    const label = link.textContent.trim().toLowerCase();
    return label === 'logout' || label === 'sign out' || href.includes('logout');
  };

  const wireLogoutLinks = () => {
    document.querySelectorAll('a, button').forEach((element) => {
      if (!isLogoutLink(element) || element.dataset.logoutWired === 'true') return;
      element.dataset.logoutWired = 'true';
      element.addEventListener('click', (event) => {
        event.preventDefault();
        signOut();
      });
    });
  };

  window.coursehubSession = {
    ROLE_HOME,
    getClient,
    isConfigured,
    isDemoMode,
    isAuthPath,
    isInsideProtectedFolder,
    resolveHref,
    routeRole,
    getActor,
    getSession,
    setSession,
    getCurrentLocalUser,
    getCurrentUserRole,
    getLocalState,
    setLocalState,
    getAllCourses,
    createCourse,
    createCourseLive,
    enrollInCourse,
    enrollInCourseLive,
    registerLocalUser,
    loginLocalUser,
    getUserByEmail,
    loadProfile,
    ensureProfile,
    guard,
    redirectSignedInUsers,
    redirectToLogin,
    redirectToDashboard,
    redirectToHome,
    signOut,
    wireLogoutLinks
  };
})();
