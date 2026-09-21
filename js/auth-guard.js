(function () {
  const path = window.location.pathname.toLowerCase();
  const role = path.includes('/admin/') ? 'admin' : path.includes('/tutor/') ? 'tutor' : path.includes('/student/') ? 'student' : null;
  const client = window.coursehubSupabase;

  if (!role || !client) return;

  const redirect = (target) => {
    window.location.replace(target);
  };

  client.auth.getUser().then(async ({ data, error }) => {
    if (error || !data.user) {
      redirect('../login.html');
      return;
    }

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== role) {
      redirect('../index.html');
      return;
    }

    document.documentElement.classList.add('auth-ready');
  });

  document.querySelectorAll('a').forEach((link) => {
    if (link.textContent.trim().toLowerCase() !== 'logout') return;
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      await client.auth.signOut();
      redirect('../index.html');
    });
  });
})();
