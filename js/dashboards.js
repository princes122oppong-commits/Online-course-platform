/*
 * CourseHub dashboard data.
 *
 * Live aggregates for the student and tutor dashboards. Admin pages are served
 * by js/admin.js and are not built here.
 *
 * Student and tutor see different things and the queries are genuinely
 * different, so they are kept in separate functions rather than one branch
 * tree. Every failure path falls back to the bundled demo dashboard.
 */
(function () {
  const demoDashboards = (window.coursehubDemoData || {}).dashboards || {};

  const formatMoney = (value) =>
    (window.coursehubFormat ? window.coursehubFormat.money(value) : `GH\u20b5${Number(value || 0).toFixed(2)}`);

  const getClient = () => window.coursehubSupabase || null;

  const isLive = () => Boolean(window.coursehubSupabaseConfig?.hasRealConfig && getClient());

  const demoFallback = (role) =>
    Object.assign(
      { stats: [], summary: '', quickStats: [], courses: [], activity: [] },
      demoDashboards[role] || {},
      { mode: 'demo' }
    );

  const countCompleted = (progressRows) =>
    progressRows.filter((row) => row.is_completed === true).length;

  const progressPercent = (completed, totalLessons, status) => {
    if (totalLessons > 0) return Math.min(100, Math.round((completed / totalLessons) * 100));
    return status === 'completed' ? 100 : 0;
  };

  const loadStudentDashboard = async (client, profile) => {
    const [enrollmentsResult, certificatesResult, progressResult] = await Promise.all([
      client.from('enrollments').select('id, course_id, status, enrolled_at').eq('student_id', profile.id),
      client.from('certificates').select('id, course_id, issued_at').eq('student_id', profile.id),
      client.from('course_progress').select('enrollment_id, is_completed')
    ]);

    const enrollments = enrollmentsResult.data || [];
    const certificates = certificatesResult.data || [];
    const progressRows = progressResult.data || [];

    const courseIds = enrollments.map((enrollment) => enrollment.course_id).filter(Boolean);
    const coursesResult = courseIds.length
      ? await client.from('courses').select('id, title, lessons, lesson_count').in('id', courseIds)
      : { data: [] };

    const courseTitles = new Map((coursesResult.data || []).map((course) => [course.id, course]));

    const courses = enrollments.map((enrollment) => {
      const course = courseTitles.get(enrollment.course_id) || {};
      const completed = progressRows
        .filter((row) => row.enrollment_id === enrollment.id)
        .filter((row) => row.is_completed === true).length;

      return {
        title: course.title || 'Course',
        status: enrollment.status === 'completed' ? 'Completed' : 'In progress',
        progress: progressPercent(completed, Number(course.lessons || course.lesson_count || 0), enrollment.status)
      };
    });

    const completedLessons = countCompleted(progressRows);
    const trackedLessons = progressRows.length;
    const completionRate = trackedLessons ? Math.round((completedLessons / trackedLessons) * 100) : 0;

    const activity = [
      ...certificates.map((certificate) => `Earned a certificate for ${courseTitles.get(certificate.course_id)?.title || 'a course'}`),
      ...enrollments.map((enrollment) => `Enrolled in ${courseTitles.get(enrollment.course_id)?.title || 'a course'}`)
    ].slice(0, 5);

    return {
      stats: [
        { label: 'Courses enrolled', value: enrollments.length },
        { label: 'Lessons completed', value: completedLessons },
        { label: 'Certificates', value: certificates.length }
      ],
      summary: enrollments.length
        ? 'Your learning progress is loaded from the database.'
        : 'You have not enrolled in a course yet. Browse the catalogue to get started.',
      quickStats: [
        { label: 'Completion rate', value: `${completionRate}%` },
        { label: 'Active courses', value: enrollments.filter((row) => row.status === 'active').length },
        { label: 'Certificates', value: certificates.length }
      ],
      courses,
      activity,
      mode: 'live'
    };
  };

  const courseStatusLabel = (course) => {
    if (course.approval_status === 'rejected') return 'Rejected';
    if (course.approval_status === 'pending') return 'Pending review';
    if (course.is_published && course.approval_status === 'approved') return 'Published';
    return 'Draft';
  };

  const loadTutorDashboard = async (client, profile) => {
    const [coursesResult, earningsResult] = await Promise.all([
      client
        .from('courses')
        .select('id, title, is_published, approval_status, rating, lessons, lesson_count')
        .eq('tutor_id', profile.id),
      client.from('tutor_earnings').select('amount, status').eq('tutor_id', profile.id)
    ]);

    const courses = coursesResult.data || [];
    const earnings = earningsResult.data || [];
    const courseIds = courses.map((course) => course.id);

    /* Only enrollments for this tutor's own courses (the previous version
       counted every enrollment on the platform). */
    const enrollmentsResult = courseIds.length
      ? await client.from('enrollments').select('id, course_id, student_id, status').in('course_id', courseIds)
      : { data: [] };

    const enrollments = enrollmentsResult.data || [];

    const totalEarnings = earnings.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const releasedEarnings = earnings
      .filter((row) => row.status === 'released')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const ratedCourses = courses.map((course) => Number(course.rating || 0)).filter((rating) => rating > 0);
    const averageRating = ratedCourses.length
      ? ratedCourses.reduce((sum, rating) => sum + rating, 0) / ratedCourses.length
      : 0;

    const courseRows = courses.map((course) => {
      const courseEnrollments = enrollments.filter((row) => row.course_id === course.id);
      const completed = courseEnrollments.filter((row) => row.status === 'completed').length;

      return {
        title: course.title,
        status: courseStatusLabel(course),
        progress: courseEnrollments.length ? Math.round((completed / courseEnrollments.length) * 100) : 0
      };
    });

    const activity = [
      ...enrollments.slice(-3).map((enrollment) => {
        const course = courses.find((row) => row.id === enrollment.course_id);
        return `New enrollment in ${course?.title || 'a course'}`;
      }),
      ...courses.filter((course) => course.approval_status === 'pending').map((course) => `Awaiting review: ${course.title}`)
    ].slice(0, 5);

    return {
      stats: [
        { label: 'Courses', value: courses.length },
        { label: 'Enrolled students', value: enrollments.length },
        { label: 'Earnings', value: formatMoney(totalEarnings) }
      ],
      summary: courses.length
        ? 'Your tutor data is loaded from the database.'
        : 'You have not created a course yet. Use "Create course" to publish your first one.',
      quickStats: [
        { label: 'Course rating', value: averageRating ? averageRating.toFixed(1) : 'No ratings yet' },
        { label: 'Students', value: enrollments.length },
        { label: 'Released earnings', value: formatMoney(releasedEarnings) }
      ],
      courses: courseRows,
      activity,
      mode: 'live'
    };
  };

  const load = async (role, actor) => {
    if (!isLive() || !actor) return demoFallback(role);

    const client = getClient();

    try {
      const content = role === 'tutor'
        ? await loadTutorDashboard(client, actor.profile)
        : await loadStudentDashboard(client, actor.profile);

      return content;
    } catch (error) {
      console.warn('[CourseHub] Using demo dashboard:', error.message || error);
      return demoFallback(role);
    }
  };

  window.coursehubDashboards = { load, demoFallback };
})();
