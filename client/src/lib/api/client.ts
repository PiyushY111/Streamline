const PRIMARY_API = '/api';
const FALLBACK_API = 'http://127.0.0.1:5001/api';


function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(^|;\s*)csrf_token=([^;]+)/);
  return match && match[2] ? decodeURIComponent(match[2]) : null;
}

export async function safeFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('streamline_token') : null;
  const csrfToken = getCsrfTokenFromCookie();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const method = (options.method || 'GET').toUpperCase();
  if (csrfToken && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const mergedOptions: RequestInit = {
    credentials: 'include',
    ...options,
    headers,
  };

  try {
    const res = await fetch(`${PRIMARY_API}${endpoint}`, mergedOptions);
    if (res.ok || res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
      return res;
    }
  } catch (err: unknown) {
    // Relative fetch failed, fall through to absolute fallback
  }

  return fetch(`${FALLBACK_API}${endpoint}`, mergedOptions);
}
