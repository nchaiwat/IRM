import axios from 'axios';

// In browser, use relative path '' so requests go to current origin (/api/...)
// On server-side (SSR), use internal container URL
const API_BASE = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://irm-backend:8000');

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token & Anti-Cache for GET requests
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('irm_access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Anti-Cache Guard: Ensure browsers/proxies always fetch fresh data on GET requests
      if (!config.method || config.method.toLowerCase() === 'get') {
        config.headers = config.headers || {};
        config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        config.headers['Pragma'] = 'no-cache';
        config.headers['Expires'] = '0';
        config.params = {
          ...config.params,
          _t: Date.now(),
        };
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const isLoginPage = window.location.pathname === '/login';
      const isAuthCallback = window.location.pathname === '/auth/callback';
      if (!isLoginPage && !isAuthCallback) {
        const authProvider = localStorage.getItem('irm_auth_provider');
        const portalUrl = localStorage.getItem('irm_ciam_portal_url') || 'https://ciam.windowasia.com/portal';

        localStorage.removeItem('irm_access_token');
        localStorage.removeItem('irm_refresh_token');
        localStorage.removeItem('irm_auth_provider');

        if (authProvider === 'sso') {
          // SSO session expired -> return seamlessly to Central IAM Portal
          window.location.href = portalUrl;
        } else {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
