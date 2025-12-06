// Use relative URLs in production (same domain), absolute in dev
// ALWAYS use relative URLs when frontend and backend are on the same domain
// This prevents issues with NEXT_PUBLIC_API_URL being set incorrectly
const getApiUrl = () => {
  if (typeof window === 'undefined') {
    // Server-side: use env var or default
    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    // Remove any trailing /api to avoid duplication
    return url.replace(/\/api\/?$/, '');
  }
  
  // Client-side: ALWAYS use relative URLs when on the same domain
  // This is the safest approach and works with Nginx reverse proxy
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  const currentOrigin = window.location.origin;
  
  // If no env URL set, definitely use relative
  if (!envUrl) {
    return ''; // Empty string = relative URLs
  }
  
  // Parse and compare origins
  try {
    // Remove /api from envUrl if present for comparison
    const envUrlForComparison = envUrl.replace(/\/api\/?$/, '');
    const envUrlObj = new URL(envUrlForComparison);
    const currentUrlObj = new URL(currentOrigin);
    
    // If same origin, ALWAYS use relative URLs (regardless of /api in env)
    if (envUrlObj.origin === currentUrlObj.origin) {
      return ''; // Relative URLs - Nginx will route /api/* to backend
    }
    
    // Different origin (e.g., local dev with different ports) - use absolute
    // But still remove trailing /api to be safe
    return envUrlForComparison;
  } catch (e) {
    // Invalid URL - try simple string matching
    const envUrlWithoutApi = envUrl.replace(/\/api\/?$/, '');
    if (envUrlWithoutApi === currentOrigin || envUrl.startsWith(currentOrigin)) {
      return ''; // Relative URLs
    }
    // Different origin - return without /api
    return envUrlWithoutApi;
  }
};

const API_URL = getApiUrl();

// Debug logging (always log in browser for troubleshooting)
if (typeof window !== 'undefined') {
  console.log('[API Config] Base URL:', API_URL || '(relative - same origin)');
  console.log('[API Config] Window origin:', window.location.origin);
  console.log('[API Config] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL || '(not set)');
  // Test buildApiUrl to show what it produces
  const testUrl = buildApiUrl('/api/auth/test-login');
  console.log('[API Config] buildApiUrl test:', testUrl);
  console.log('[API Config] Has double /api/api?', testUrl.includes('/api/api'));
}

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  
  const stored = localStorage.getItem('ckad-auth');
  if (!stored) return {};
  
  try {
    const { state } = JSON.parse(stored);
    if (state?.accessToken) {
      return { Authorization: `Bearer ${state.accessToken}` };
    }
  } catch {
    return {};
  }
  return {};
}

// Generic fetch wrapper with auth
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  };

  const url = buildApiUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Check if response is JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('Non-JSON response:', { 
      status: response.status, 
      contentType,
      url: url,
      preview: text.substring(0, 200)
    });
    throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
  }

  // Handle token expiry
  if (response.status === 401) {
    const data = await response.json();
    if (data.error === 'TokenExpired') {
      // Try to refresh token
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry the request
        return fetch(buildApiUrl(endpoint), {
          ...options,
          headers: {
            ...headers,
            ...getAuthHeaders(),
          },
        });
      }
    }
    throw new Error(data.message || 'Unauthorized');
  }

  return response;
}

// Refresh access token
async function refreshAccessToken(): Promise<boolean> {
  try {
    const stored = localStorage.getItem('ckad-auth');
    if (!stored) return false;

    const { state } = JSON.parse(stored);
    if (!state?.refreshToken) return false;

    const response = await fetch(buildApiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    
    // Update stored tokens
    const newState = {
      ...state,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
    localStorage.setItem('ckad-auth', JSON.stringify({ state: newState }));
    
    return true;
  } catch {
    return false;
  }
}

// ============ Auth API ============

// Helper to construct API URLs safely (prevents double /api)
// This function ensures we NEVER have /api/api in the final URL
const buildApiUrl = (endpoint: string): string => {
  // Ensure endpoint starts with /
  if (!endpoint.startsWith('/')) {
    endpoint = '/' + endpoint;
  }
  
  // If API_URL is empty (relative URLs), just return the endpoint
  // This is the normal case in production (same domain)
  if (!API_URL || API_URL === '') {
    return endpoint;
  }
  
  // API_URL is set (different origin, e.g., local dev)
  // Clean the base URL - remove any trailing /api or slashes
  let baseUrl = API_URL.replace(/\/api\/?$/, '').replace(/\/$/, '');
  
  // Combine baseUrl and endpoint
  let url = `${baseUrl}${endpoint}`;
  
  // Remove any double slashes (but preserve http:// or https://)
  url = url.replace(/([^:]\/)\/+/g, '$1');
  
  // CRITICAL: Remove any /api/api patterns (this is the main fix)
  url = url.replace(/\/api\/api(\/|$)/g, '/api$1');
  
  // Additional safety: if baseUrl somehow had /api and endpoint has /api, fix it
  // This handles edge cases where NEXT_PUBLIC_API_URL was set incorrectly
  while (url.includes('/api/api')) {
    url = url.replace(/\/api\/api(\/|$)/g, '/api$1');
  }
  
  return url;
};

export const authApi = {
  // Test login (hardcoded credentials)
  async testLogin(email: string, password: string) {
    const url = buildApiUrl('/api/auth/test-login');
    console.log('[API] Test login request to:', url);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      console.log('[API] Test login response status:', response.status, response.statusText);

      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[API] Login API returned non-JSON:', {
          status: response.status,
          contentType,
          url,
          preview: text.substring(0, 200)
        });
        throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      console.log('[API] Test login success');
      return data;
    } catch (error: any) {
      console.error('[API] Login request failed:', {
        error: error.message,
        url,
        apiUrl: API_URL || '(relative)',
        stack: error.stack
      });
      
      // Provide more helpful error messages
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error(`Cannot connect to backend. Check if backend is running at ${API_URL || 'same origin'}`);
      }
      
      throw error;
    }
  },

  // Send OTP to email
  async sendOTP(email: string) {
    const response = await fetch(buildApiUrl('/api/auth/email/otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return response.json();
  },

  // Verify OTP
  async verifyOTP(email: string, otp: string) {
    const response = await fetch(buildApiUrl('/api/auth/email/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    return response.json();
  },

  // Google OAuth URL
  getGoogleAuthUrl() {
    return buildApiUrl('/api/auth/google');
  },

  // Get current user
  async getMe() {
    const response = await fetchWithAuth('/api/auth/me');
    return response.json();
  },

  // Logout
  async logout() {
    const response = await fetchWithAuth('/api/auth/logout', {
      method: 'POST',
    });
    return response.json();
  },
};

// ============ Session API ============

export const sessionApi = {
  // Start session
  async start() {
    try {
      const response = await fetchWithAuth('/api/session/start', {
        method: 'POST',
      });

      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Session start returned HTML:', {
          status: response.status,
          contentType,
          preview: text.substring(0, 300)
        });
        throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      
      // Check if response indicates an error
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${data.error || 'Unknown error'}`);
      }

      return data;
    } catch (error: any) {
      console.error('Session start failed:', error);
      throw error;
    }
  },

  // Get session status
  async status() {
    try {
      const response = await fetchWithAuth('/api/session/status');
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Session status failed:', error);
      throw error;
    }
  },

  // Extend session
  async extend() {
    try {
      const response = await fetchWithAuth('/api/session/extend', {
        method: 'POST',
      });
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Session extend failed:', error);
      throw error;
    }
  },

  // Stop session
  async stop() {
    try {
      const response = await fetchWithAuth('/api/session/stop', {
        method: 'POST',
      });
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('Session stop failed:', error);
      throw error;
    }
  },
};

// ============ Tasks API ============

export const tasksApi = {
  // Get all tasks
  async list(difficulty?: string, category?: string) {
    const params = new URLSearchParams();
    if (difficulty) params.append('difficulty', difficulty);
    if (category) params.append('category', category);
    
    const query = params.toString() ? `?${params}` : '';
    const response = await fetchWithAuth(`/api/tasks${query}`);
    return response.json();
  },

  // Get task by ID
  async get(id: number) {
    const response = await fetchWithAuth(`/api/tasks/${id}`);
    return response.json();
  },

  // Get categories
  async categories() {
    const response = await fetchWithAuth('/api/tasks/categories');
    return response.json();
  },
};

// ============ Platform Status ============

export const platformApi = {
  async status() {
    const response = await fetch(buildApiUrl('/api/status'));
    return response.json();
  },

  async health() {
    const response = await fetch(buildApiUrl('/healthz'));
    return response.json();
  },
};



