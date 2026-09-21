document.addEventListener('DOMContentLoaded', async () => {
  const client = window.coursehubSupabase;
  const root = document.querySelector('[data-admin-page]');
  const page = root?.dataset.adminPage || 'dashboard';

  const setMessage = (text, isError = false) => {
    const message = document.querySelector('#adminMessage');
    if (!message) return;
    message.textContent = text;
    message.className = isError ? 'admin-message error' : 'admin-message';
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;'
  }[character]));

  const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Not available';
  const formatMoney = (value) => `GH₵${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const query = async (table, columns = '*', options = {}) => {
    let request = client.from(table).select(columns);
    if (options.order) request = request.order(options.order, { ascending: options.ascending ?? false });
    if (options.limit) request = request.limit(options.limit);
    if (options.eq) request = request.eq(options.eq[0], options.eq[1]);
    return request;
  };

  if (!client || !window.coursehubSupabaseConfig?.hasRealConfig) {
    setMessage('Supabase is not configured. This admin area requires the live backend.', true);
    return;
  }

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    window.location.replace('login.html');
    return;
  }

  const { data: profile, error: profileError } = await client
    .from('profiles').select('id, role, full_name, email').eq('user_id', userData.user.id).maybeSingle();
  if (profileError || !profile || profile.role !== 'admin') {
    await client.auth.signOut();
    window.location.replace('../index.html');
    return;
  }

  document.documentElement.classList.add('auth-ready');
  document.querySelectorAll('a[data-logout]').forEach((link) => link.addEventListener('click', async (event) => {
    event.preventDefault();
    await client.auth.signOut();
    window.location.replace('../index.html');
  }));

  const loadDashboard = async () => {
    const [profiles, courses, orders, withdrawals, logs] = await Promise.all([
      query('profiles', 'role'), query('courses', 'id, title, approval_status, is_published, created_at', { order: 'created_at', limit: 100 }),
      query('orders', 'total_amount, status'), query('withdrawals', 'amount, status'), query('audit_logs', 'action, entity_type, created_at', { order: 'created_at', limit: 8 })
    ]);
    const errors = [profiles, courses, orders, withdrawals, logs].filter((result) => result.error);
    if (errors.length) setMessage(errors[0].error.message, true);

    const rows = profiles.data || [];
    const courseRows = courses.data || [];
    const orderRows = orders.data || [];
    const withdrawalRows = withdrawals.data || [];
    const metric = (label, value) => `<div class="stat-box"><strong>${escapeHtml(value)}</strong><div>${label}</div></div>`;
    document.querySelector('#dashboardMetrics').innerHTML = [
      metric('Users', rows.length), metric('Courses', courseRows.length),
      metric('Paid revenue', formatMoney(orderRows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.total_amount || 0), 0)))
    ].join('');
    document.querySelector('#dashboardQuickStats').innerHTML = [
      ['Students', rows.filter((row) => row.role === 'student').length],
      ['Tutors', rows.filter((row) => row.role === 'tutor').length],
      ['Pending withdrawals', withdrawalRows.filter((row) => row.status === 'pending').length]
    ].map(([label, value]) => `<div class="mini-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
    document.querySelector('#dashboardSummary').textContent = 'Live metrics loaded from Supabase.';
    const pending = courseRows.filter((row) => row.approval_status === 'pending');
    document.querySelector('#dashboardCourses').innerHTML = pending.length ? pending.map((course) => `<div class="list-row"><div class="row-copy"><strong>${escapeHtml(course.title)}</strong><span>Pending approval</span></div><a class="text-button" href="courses.html">Review</a></div>`).join('') : '<p class="empty-state">No courses are waiting for approval.</p>';
    document.querySelector('#dashboardActivity').innerHTML = (logs.data || []).length ? logs.data.map((log) => `<li>${escapeHtml(log.action)} <span>${formatDate(log.created_at)}</span></li>`).join('') : '<li>No audit activity recorded yet.</li>';
  };

  const loadUsers = async () => {
    const { data, error } = await query('profiles', 'id, full_name, email, role, is_verified, created_at', { order: 'created_at' });
    if (error) { setMessage(error.message, true); return; }
    document.querySelector('#usersTable').innerHTML = (data || []).map((user) => `<tr><td>${escapeHtml(user.full_name || 'Unnamed')}</td><td>${escapeHtml(user.email)}</td><td><select data-role-user="${user.id}"><option value="student" ${user.role === 'student' ? 'selected' : ''}>Student</option><option value="tutor" ${user.role === 'tutor' ? 'selected' : ''}>Tutor</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option></select></td><td>${user.is_verified ? 'Verified' : 'Unverified'}</td><td>${formatDate(user.created_at)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No users found.</td></tr>';
    document.querySelectorAll('[data-role-user]').forEach((select) => select.addEventListener('change', async () => {
      const { error: updateError } = await client.from('profiles').update({ role: select.value }).eq('id', select.dataset.roleUser);
      if (updateError) { setMessage(updateError.message, true); return; }
      setMessage('User role updated.');
    }));
  };

  const loadCourses = async () => {
    const { data, error } = await query('courses', 'id, title, category, level, price, approval_status, is_published, created_at', { order: 'created_at' });
    if (error) { setMessage(error.message, true); return; }
    document.querySelector('#coursesTable').innerHTML = (data || []).map((course) => `<tr><td>${escapeHtml(course.title)}</td><td>${escapeHtml(course.category)}</td><td>${escapeHtml(course.level)}</td><td>${formatMoney(course.price)}</td><td><select data-status-course="${course.id}"><option value="pending" ${course.approval_status === 'pending' ? 'selected' : ''}>Pending</option><option value="approved" ${course.approval_status === 'approved' ? 'selected' : ''}>Approved</option><option value="rejected" ${course.approval_status === 'rejected' ? 'selected' : ''}>Rejected</option></select></td><td>${course.is_published ? 'Published' : 'Draft'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No courses found.</td></tr>';
    document.querySelectorAll('[data-status-course]').forEach((select) => select.addEventListener('change', async () => {
      const updates = { approval_status: select.value, is_published: select.value === 'approved' };
      const { error: updateError } = await client.from('courses').update(updates).eq('id', select.dataset.statusCourse);
      if (updateError) { setMessage(updateError.message, true); return; }
      setMessage('Course status updated.');
    }));
  };

  const loadRows = async (table, columns, target, formatter, emptyLabel, orderColumn = 'created_at') => {
    const { data, error } = await query(table, columns, { order: orderColumn });
    if (error) { setMessage(error.message, true); return; }
    document.querySelector(target).innerHTML = (data || []).map(formatter).join('') || `<tr><td colspan="6" class="empty-state">${emptyLabel}</td></tr>`;
  };

  if (page === 'dashboard') await loadDashboard();
  if (page === 'users') await loadUsers();
  if (page === 'courses') await loadCourses();
  if (page === 'students') await loadRows('profiles', 'full_name, email, role, is_verified, created_at', '#adminTableBody', (row) => row.role === 'student' ? `<tr><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(row.email)}</td><td>Student</td><td>${row.is_verified ? 'Verified' : 'Unverified'}</td><td>${formatDate(row.created_at)}</td></tr>` : '', 'No students found.');
  if (page === 'tutors') await loadRows('profiles', 'full_name, email, role, is_verified, created_at', '#adminTableBody', (row) => row.role === 'tutor' ? `<tr><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(row.email)}</td><td>Tutor</td><td>${row.is_verified ? 'Verified' : 'Unverified'}</td><td>${formatDate(row.created_at)}</td></tr>` : '', 'No tutors found.');
  if (page === 'payments') await loadRows('payments', 'gateway, gateway_reference, amount, status, created_at', '#adminTableBody', (row) => `<tr><td>${escapeHtml(row.gateway)}</td><td>${escapeHtml(row.gateway_reference || 'Not provided')}</td><td>${formatMoney(row.amount)}</td><td>${escapeHtml(row.status)}</td><td>${formatDate(row.created_at)}</td></tr>`, 'No payments found.');
  if (page === 'subscriptions') await loadRows('subscriptions', 'plan_name, price, status, started_at, ends_at', '#adminTableBody', (row) => `<tr><td>${escapeHtml(row.plan_name)}</td><td>${formatMoney(row.price)}</td><td>${escapeHtml(row.status)}</td><td>${formatDate(row.started_at)}</td><td>${formatDate(row.ends_at)}</td></tr>`, 'No subscriptions found.', 'started_at');
  if (page === 'withdrawals') await loadRows('withdrawals', 'id, amount, status, payout_method, created_at', '#adminTableBody', (row) => `<tr><td>${escapeHtml(row.id).slice(0, 8)}...</td><td>${formatMoney(row.amount)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.payout_method || 'Not provided')}</td><td>${formatDate(row.created_at)}</td></tr>`, 'No withdrawals found.');
  if (page === 'reports') await loadRows('audit_logs', 'action, entity_type, created_at', '#adminTableBody', (row) => `<tr><td>${escapeHtml(row.action)}</td><td>${escapeHtml(row.entity_type || 'System')}</td><td>${formatDate(row.created_at)}</td></tr>`, 'No audit reports found.');
  if (page === 'settings') await loadRows('platform_settings', 'key, value, updated_at', '#adminTableBody', (row) => `<tr><td>${escapeHtml(row.key)}</td><td>${escapeHtml(JSON.stringify(row.value))}</td><td>${formatDate(row.updated_at)}</td></tr>`, 'No platform settings found.', 'updated_at');
});
