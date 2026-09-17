import { toast } from '@/components/ui/ToastProvider';

const PRIMARY_API = '/api';

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(^|;\s*)csrf_token=([^;]+)/);
  return match && match[2] ? decodeURIComponent(match[2]) : null;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let lastRateLimitToastTime = 0;

async function attemptSilentTokenRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${PRIMARY_API}/auth/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.token && typeof window !== 'undefined') {
          localStorage.setItem('streamline_token', data.token);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function safeFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    toast.warning('You are currently offline. Changes will sync once reconnected.', 'Offline Mode');
  }

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

  let response: Response;

  try {
    response = await fetch(`${PRIMARY_API}${endpoint}`, mergedOptions);
  } catch (err) {
    throw err;
  }

  // Handle 401 Unauthorized with single silent token refresh retry
  if (
    response.status === 401 &&
    !endpoint.includes('/auth/login') &&
    !endpoint.includes('/auth/register') &&
    !endpoint.includes('/auth/me')
  ) {
    const refreshed = await attemptSilentTokenRefresh();
    if (refreshed) {
      const freshToken = typeof window !== 'undefined' ? localStorage.getItem('streamline_token') : null;
      if (freshToken) {
        headers.set('Authorization', `Bearer ${freshToken}`);
      }
      try {
        return await fetch(`${PRIMARY_API}${endpoint}`, { ...mergedOptions, headers });
      } catch (retryErr) {
        return response;
      }
    }
  }

  // Surface rate-limiting alert (throttled to once per 10 seconds)
  if (response.status === 429) {
    const now = Date.now();
    if (now - lastRateLimitToastTime > 10000) {
      lastRateLimitToastTime = now;
      toast.warning('Rate limit exceeded. Please wait a moment before trying again.', 'Slow Down');
    }
  }

  return response;
}
