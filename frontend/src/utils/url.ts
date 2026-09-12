declare global {
  interface Window {
    __BASE_PATH__?: string;
  }
}

/**
 * Returns the sanitized base path prefix for API and asset routing (e.g., '/cce' or '').
 * Guarantees no trailing slash.
 */
export function getBasePath(): string {
  // 1. Check if backend injected runtime __BASE_PATH__
  if (typeof window !== 'undefined' && typeof window.__BASE_PATH__ === 'string') {
    return normalizePath(window.__BASE_PATH__);
  }

  // 2. Check build-time environment variable
  const envBase = import.meta.env.VITE_BASE_PATH;
  if (typeof envBase === 'string' && envBase.trim() !== '') {
    return normalizePath(envBase);
  }

  // 3. Dynamic fallback based on window.location.pathname
  if (typeof window !== 'undefined' && window.location) {
    const pathname = window.location.pathname || '';
    // Strip trailing slash and trailing index.html if present
    const cleanPath = pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '');
    if (cleanPath && cleanPath !== '/') {
      return normalizePath(cleanPath);
    }
  }

  return '';
}

function normalizePath(rawPath: string): string {
  if (!rawPath || rawPath.trim() === '' || rawPath.trim() === '/') {
    return '';
  }
  let p = rawPath.trim();
  if (!p.startsWith('/')) {
    p = '/' + p;
  }
  if (p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p;
}

/**
 * Construct an absolute or prefix-aware API URL.
 */
export function getApiUrl(subpath: string = ''): string {
  const base = getBasePath();
  const cleanSubpath = subpath ? (subpath.startsWith('/') ? subpath : `/${subpath}`) : '';
  return `${base}/api${cleanSubpath}`;
}

/**
 * Construct WebSocket URL respecting host, protocol, sub-path prefix, and query params.
 */
export function getWsUrl(
  endpoint: 'exec' | 'logs' | 'stats',
  params: Record<string, string | number | boolean | undefined | null> = {}
): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const base = getBasePath();

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      searchParams.set(key, String(val));
    }
  });

  const queryString = searchParams.toString();
  return `${protocol}//${host}${base}/ws/${endpoint}${queryString ? `?${queryString}` : ''}`;
}
