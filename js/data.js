/*
 * CourseHub catalogue data.
 *
 * Every read goes through here so that a missing Supabase project, an RLS
 * rejection or a dropped connection degrades to the bundled demo content
 * instead of rendering empty grids.
 */
(function () {
  const demo = window.coursehubDemoData || {
    courses: [],
    tutors: [],
    categories: [],
    platformSnapshot: {}
  };

  const COURSE_COLUMNS =
    'id, title, slug, category, level, lessons, lesson_count, price, rating, short_description, description, tutor_id, is_featured';

  let dataSource = 'demo';

  const getClient = () => window.coursehubSupabase || null;

  const isLive = () => Boolean(window.coursehubSupabaseConfig?.hasRealConfig && getClient());

  const getDataSource = () => dataSource;

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeCourse = (row) => ({
    id: row.id ?? row.slug ?? '',
    title: row.title || 'Untitled course',
    slug: row.slug || '',
    category: row.category || 'General',
    level: row.level || 'Beginner',
    lessons: toNumber(row.lessons || row.lesson_count),
    price: toNumber(row.price),
    rating: toNumber(row.rating, 4.7),
    description: row.short_description || row.description || '',
    tutor: row.tutor || ''
  });

  const fetchCourses = async (options = {}) => {
    const limit = options.limit || 60;

    if (!isLive()) {
      dataSource = 'demo';
      return demo.courses.slice(0, limit);
    }

    try {
      const { data, error } = await getClient()
        .from('courses')
        .select(COURSE_COLUMNS)
        .eq('is_published', true)
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      dataSource = 'live';
      return (data || []).map(normalizeCourse);
    } catch (error) {
      console.warn('[CourseHub] Using demo courses:', error.message || error);
      dataSource = 'demo';
      return demo.courses.slice(0, limit);
    }
  };

  const fetchCourseById = async (identifier) => {
    if (!identifier) return null;

    if (!isLive()) {
      dataSource = 'demo';
      return demo.courses.find((course) => course.id === identifier || course.slug === identifier) || null;
    }

    try {
      const client = getClient();
      let { data, error } = await client
        .from('courses')
        .select(COURSE_COLUMNS)
        .eq('id', identifier)
        .maybeSingle();

      /* A slug was supplied instead of a UUID: PostgREST rejects the value,
         so retry against the slug column. */
      if (error) {
        const fallback = await client
          .from('courses')
          .select(COURSE_COLUMNS)
          .eq('slug', identifier)
          .maybeSingle();
        data = fallback.data;
        error = fallback.error;
      }

      if (error || !data) throw error || new Error('Course not found');

      dataSource = 'live';
      return normalizeCourse(data);
    } catch (error) {
      dataSource = 'demo';
      return demo.courses.find((course) => course.id === identifier || course.slug === identifier) || null;
    }
  };

  /* Tutors are profiles, which are private by RLS. The public.tutor_directory
     view exposes only the columns that are safe to publish. */
  const fetchTutors = async (options = {}) => {
    const limit = options.limit || 6;

    if (!isLive()) {
      dataSource = 'demo';
      return demo.tutors.slice(0, limit);
    }

    try {
      const { data, error } = await getClient()
        .from('tutor_directory')
        .select('id, full_name, avatar_url, bio')
        .limit(limit);

      if (error) throw error;

      dataSource = 'live';
      return (data || []).map((row) => ({
        id: row.id,
        name: row.full_name || 'CourseHub tutor',
        specialty: row.bio ? row.bio.split('.')[0] : 'Course tutor',
        bio: row.bio || ''
      }));
    } catch (error) {
      console.warn('[CourseHub] Using demo tutors:', error.message || error);
      dataSource = 'demo';
      return demo.tutors.slice(0, limit);
    }
  };

  const fetchCategories = async () => {
    if (!isLive()) return demo.categories;

    try {
      const { data, error } = await getClient().from('categories').select('name, description').order('name');
      if (error) throw error;
      if (!data || !data.length) return demo.categories;

      return data.map((row) => ({ name: row.name, text: row.description || '' }));
    } catch (error) {
      return demo.categories;
    }
  };

  /* Aggregate counts come from public.platform_stats so anonymous visitors can
     display totals without access to the profiles table. */
  const fetchPlatformSnapshot = async () => {
    if (!isLive()) return demo.platformSnapshot;

    try {
      const { data, error } = await getClient().from('platform_stats').select('*').maybeSingle();
      if (error || !data) throw error || new Error('No platform stats');

      return {
        students: toNumber(data.students),
        tutors: toNumber(data.tutors),
        courses: toNumber(data.courses)
      };
    } catch (error) {
      return demo.platformSnapshot;
    }
  };

  window.coursehubData = {
    COURSE_COLUMNS,
    isLive,
    getDataSource,
    normalizeCourse,
    fetchCourses,
    fetchCourseById,
    fetchTutors,
    fetchCategories,
    fetchPlatformSnapshot
  };
})();
