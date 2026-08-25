const PRIMARY_API = '/api';
const FALLBACK_API = 'http://localhost:5001/api';

export async function safeFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('streamline_token') : null;
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const mergedOptions: RequestInit = {
    credentials: 'include',
    ...options,
    headers,
  };

  try {
    const res = await fetch(`${PRIMARY_API}${endpoint}`, mergedOptions);
    if (res.ok || res.status === 400 || res.status === 401 || res.status === 404) {
      return res;
    }
  } catch (err: unknown) {
    // Relative fetch failed, fall through to absolute fallback
  }

  return fetch(`${FALLBACK_API}${endpoint}`, mergedOptions);
}
