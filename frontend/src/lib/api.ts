// Use relative URLs in production (same domain), absolute in dev
// Normalize API_URL to remove trailing /api if present (to avoid double /api/api)
const getApiUrl = () => {
  if (typeof window === 'undefined') {
    // Server-side: use env var or default
    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return url.replace(/\/api\/?$/, '');
  }
  
  // Client-side: check if we should use relative URLs
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  const currentOrigin = window.location.origin;
  
  // If NEXT_PUBLIC_API_URL is not set, use relative URLs (same domain)
  if (!envUrl) {
    return ''; // Empty string = relative URLs
  }
  
  // Parse the env URL
  try {
    const envUrlObj = new URL(envUrl);
    const currentUrlObj = new URL(currentOrigin);
    
    // If same origin (hostname + port), use relative URLs
    if (envUrlObj.origin === currentUrlObj.origin) {
      return ''; // Relative URLs
    }
    
    // If env URL starts with current origin, use relative
    if (envUrl.startsWith(currentOrigin)) {
      return ''; // Relative URLs
    }
    
    // Different origin/port - use absolute URL (remove trailing /api)
    return envUrl.replace(/\/api\/?$/, '');
  } catch (e) {
    // Invalid URL format - try string matching
    if (envUrl === currentOrigin || envUrl.startsWith(currentOrigin)) {
      return ''; // Relative URLs
    }
    // Remove trailing /api and return
    return envUrl.replace(/\/api\/?$/, '');
  }
};

const API_URL = getApiUrl();

// Debug logging (always log in browser for troubleshooting)
if (typeof window !== 'undefined') {
  console.log('[API Config] Base URL:', API_URL || '(relative - same origin)');
  console.log('[API Config] Window origin:', window.location.origin);
  console.log('[API Config] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL || '(not set)');
  console.log('[API Config] Example request:', `${API_URL || ''}/api/auth/test-login`);
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

  const response = await fetch(`${API_URL}${endpoint}`, {
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
      url: `${API_URL}${endpoint}`,
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
        return fetch(`${API_URL}${endpoint}`, {
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

    const response = await fetch(`${API_URL}/api/auth/refresh`, {
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

export const authApi = {
  // Test login (hardcoded credentials)
  async testLogin(email: string, password: string) {
    const url = `${API_URL}/api/auth/test-login`;
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
    const response = await fetch(`${API_URL}/api/auth/email/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return response.json();
  },

  // Verify OTP
  async verifyOTP(email: string, otp: string) {
    const response = await fetch(`${API_URL}/api/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    return response.json();
  },

  // Google OAuth URL
  getGoogleAuthUrl() {
    return `${API_URL}/api/auth/google`;
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
    const response = await fetch(`${API_URL}/api/status`);
    return response.json();
  },

  async health() {
    const response = await fetch(`${API_URL}/healthz`);
    return response.json();
  },
};



