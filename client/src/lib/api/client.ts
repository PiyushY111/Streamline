const PRIMARY_API = '/api';
const FALLBACK_API = 'http://localhost:5001/api';

export async function safeFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${PRIMARY_API}${endpoint}`, options);
    if (res.ok || res.status === 400 || res.status === 401) {
      return res;
    }
  } catch (err: unknown) {
    // Relative fetch failed, fallback to absolute URL
  }
  return fetch(`${FALLBACK_API}${endpoint}`, options);
}
