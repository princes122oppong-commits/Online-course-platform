(function () {
  const injectedConfig = window.__COURSEHUB_SUPABASE__ || {};

  const config = {
    url: (window.SUPABASE_URL || injectedConfig.url || '').trim(),
    anonKey: (window.SUPABASE_ANON_KEY || injectedConfig.anonKey || '').trim()
  };

  const SUPABASE_URL = config.url;
  const SUPABASE_ANON_KEY = config.anonKey;

  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  const hasRealConfig = Boolean(
    SUPABASE_URL &&
    SUPABASE_URL.includes('supabase.co') &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.includes('your-') &&
    !SUPABASE_ANON_KEY.includes('placeholder')
  );

  const supabase = hasRealConfig && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;

  window.coursehubSupabase = supabase;
  window.coursehubSupabaseConfig = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    hasRealConfig
  };
  window.coursehubUseMockData = !supabase;

  window.coursehubSetSupabaseConfig = function setSupabaseConfig(nextConfig = {}) {
    const merged = {
      url: (nextConfig.url || window.SUPABASE_URL || '').trim(),
      anonKey: (nextConfig.anonKey || window.SUPABASE_ANON_KEY || '').trim()
    };

    window.__COURSEHUB_SUPABASE__ = merged;
    window.SUPABASE_URL = merged.url;
    window.SUPABASE_ANON_KEY = merged.anonKey;
    window.location.reload();
  };
})();
