/*
 * CourseHub Supabase client.
 *
 * A dependency-free REST + Auth client for Supabase so the site works when
 * opened as plain static files (no bundler, no npm install). It handles
 * access-token refresh, because the raw token response expires after ~1 hour
 * and every request would otherwise start failing with 401.
 */
(function () {
  const injectedConfig = window.__COURSEHUB_SUPABASE__ || {};

  const SUPABASE_URL = String(window.SUPABASE_URL || injectedConfig.url || '')
    .trim()
    .replace(/\/+$/, '');
  const SUPABASE_ANON_KEY = String(window.SUPABASE_ANON_KEY || injectedConfig.anonKey || '').trim();

  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  const hasRealConfig = Boolean(
    SUPABASE_URL &&
    SUPABASE_URL.includes('supabase.co') &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.includes('your-') &&
    !SUPABASE_ANON_KEY.includes('placeholder')
  );

  const STORAGE_KEY = `coursehub-session:${SUPABASE_URL}`;
  const EXPIRY_SKEW_MS = 60 * 1000;

  const readSession = () => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      return stored && typeof stored === 'object' ? stored : null;
    } catch (error) {
      return null;
    }
  };

  const writeSession = (session) => {
    try {
      if (!session) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      const expiresInSeconds = Number(session.expires_in || 0);
      const stored = Object.assign({}, session, {
        expires_at: expiresInSeconds
          ? Date.now() + expiresInSeconds * 1000 - EXPIRY_SKEW_MS
          : session.expires_at || null
      });

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (error) {
      /* Storage can be unavailable in private browsing; the session then
         simply does not persist across page loads. */
    }
  };

  const isExpired = (session) => {
    if (!session || !session.expires_at) return false;
    return Date.now() >= Number(session.expires_at);
  };

  const toError = (rawBody, status) => {
    if (!rawBody) return { message: `Request failed (${status})`, status };
    if (typeof rawBody === 'string') return { message: rawBody, status };
    return {
      message: rawBody.msg || rawBody.message || rawBody.error_description || rawBody.error || `Request failed (${status})`,
      code: rawBody.error_code || rawBody.code || null,
      status
    };
  };

  const parseBody = (text) => {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  };

  let refreshInFlight = null;

  /* Exchange the stored refresh token for a new access token. Only one
     refresh runs at a time so parallel requests cannot invalidate each other. */
  const refreshSession = () => {
    if (refreshInFlight) return refreshInFlight;

    const session = readSession();
    if (!session || !session.refresh_token) return Promise.resolve({ data: null, error: null });

    refreshInFlight = fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    })
      .then(async (response) => {
        const body = parseBody(await response.text());
        if (!response.ok || !body?.access_token) {
          writeSession(null);
          return { data: null, error: toError(body, response.status) };
        }
        writeSession(body);
        return { data: body, error: null };
      })
      .catch(() => ({ data: null, error: { message: 'Could not reach the authentication service.', status: 0 } }))
      .finally(() => {
        refreshInFlight = null;
      });

    return refreshInFlight;
  };

  const ensureFreshSession = async () => {
    const session = readSession();
    if (!session) return null;
    if (!isExpired(session)) return session;

    const { data } = await refreshSession();
    return data || null;
  };

  const buildHeaders = (session, options = {}) => ({
    apikey: SUPABASE_ANON_KEY,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...options.headers
  });

  /* Core request helper. A 401 triggers exactly one token refresh + retry. */
  const request = async (path, options = {}, allowRetry = true) => {
    const session = await ensureFreshSession();
    let response;

    try {
      response = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers: buildHeaders(session, options)
      });
    } catch (error) {
      return { data: null, error: { message: 'Network request failed. Check your connection.', status: 0 } };
    }

    if (response.status === 401 && allowRetry) {
      const { data } = await refreshSession();
      if (data) return request(path, options, false);
      writeSession(null);
      return { data: null, error: { message: 'Your session has expired. Please sign in again.', status: 401 } };
    }

    const body = parseBody(await response.text());

    if (!response.ok) return { data: null, error: toError(body, response.status) };
    return { data: body, error: null };
  };

  const FILTER_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike'];

  const createQuery = (table) => {
    const params = new URLSearchParams();
    let method = 'GET';
    let requestBody;

    const execute = () =>
      request(`/rest/v1/${table}?${params.toString()}`, {
        method,
        body: requestBody,
        headers: method === 'GET' ? {} : { Prefer: 'return=representation' }
      });

    const query = {
      select(columns = '*') {
        if (method === 'GET') params.set('select', columns);
        return query;
      },
      order(column, options = {}) {
        const direction = options.ascending === false ? 'desc' : 'asc';
        const nulls = options.nullsFirst ? 'nullsfirst' : options.nullsLast ? 'nullslast' : '';
        params.append('order', `${column}.${direction}${nulls ? `.${nulls}` : ''}`);
        return query;
      },
      limit(value) {
        params.set('limit', String(value));
        return query;
      },
      range(from, to) {
        params.set('offset', String(from));
        params.set('limit', String(to - from + 1));
        return query;
      },
      insert(values) {
        method = 'POST';
        requestBody = JSON.stringify(values);
        return query;
      },
      update(values) {
        method = 'PATCH';
        requestBody = JSON.stringify(values);
        return query;
      },
      delete() {
        method = 'DELETE';
        return query;
      },
      single() {
        return execute().then((result) => ({
          data: Array.isArray(result.data) ? result.data[0] || null : result.data,
          error: result.error
        }));
      },
      maybeSingle() {
        return query.single();
      },
      then(resolve, reject) {
        return execute().then(resolve, reject);
      }
    };

    FILTER_OPERATORS.forEach((operator) => {
      query[operator] = (column, value) => {
        params.append(column, `${operator}.${value}`);
        return query;
      };
    });

    query.in = (column, values) => {
      params.append(column, `in.(${values.join(',')})`);
      return query;
    };

    query.is = (column, value) => {
      params.append(column, `is.${value}`);
      return query;
    };

    return query;
  };

  const rpc = (functionName, args = {}) =>
    request(`/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(args)
    });

  const auth = {
    getSession: async () => ({ data: { session: await ensureFreshSession() }, error: null }),

    getUser: async () => {
      const session = await ensureFreshSession();
      if (!session?.access_token) return { data: { user: null }, error: null };

      const { data, error } = await request('/auth/v1/user');
      if (error && String(error.status) !== '401') {
        /* Offline or transient failure: trust the stored user so the UI can
           still render, and let the next data request surface real errors. */
        return { data: { user: session.user || null }, error: null };
      }
      if (error) {
        writeSession(null);
        return { data: { user: null }, error: null };
      }
      return { data: { user: data }, error: null };
    },

    refreshSession,

    signInWithPassword: async (credentials) => {
      const result = await request('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      if (result.data?.access_token) writeSession(result.data);
      return result;
    },

    signUp: async ({ email, password, options }) => {
      const result = await request('/auth/v1/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, data: options?.data || {} })
      });
      if (result.data?.access_token) writeSession(result.data);
      return result;
    },

    signOut: async () => {
      const session = readSession();
      if (session?.access_token) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` }
        }).catch(() => {});
      }
      writeSession(null);
      return { error: null };
    }
  };

  const client = hasRealConfig ? { auth, from: createQuery, rpc } : null;

  window.coursehubSupabase = client;
  window.coursehubSupabaseConfig = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    hasRealConfig
  };
  window.coursehubUseMockData = !client;

  window.coursehubSetSupabaseConfig = function setSupabaseConfig(nextConfig = {}) {
    window.__COURSEHUB_SUPABASE__ = {
      url: String(nextConfig.url || window.SUPABASE_URL || '').trim(),
      anonKey: String(nextConfig.anonKey || window.SUPABASE_ANON_KEY || '').trim()
    };
    window.location.reload();
  };
})();
