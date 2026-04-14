import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('gs_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalise Pydantic v2 validation errors and handle network errors
api.interceptors.response.use(
  res => res,
  err => {
    if (!err.response) {
      // Network error or timeout
      console.error("Network Error: Could not connect to API at", API_URL);
      err.message = `Network Error: Backend unreachable at ${API_URL}. Ensure uvicorn is running on port 8001.`;
      return Promise.reject(err);
    }
    const detail = err.response?.data?.detail;
    if (Array.isArray(detail)) {
      const msg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
      err.response.data.detail = msg;
    }
    return Promise.reject(err);
  }
);

// ── Auth ──
// Handled below in the Supabase section
export const getProfile    = () => api.get('/riders/me');
export const updateProfile = (data) => api.post('/riders/profile', data);
export const updateGPS     = (lat, lng) => api.post('/riders/gps', { lat, lng });

// ── Policy ──
export const getPolicyQuote   = () => api.get('/policy/quote');
export const createPolicy     = (data) => api.post('/policy/create', data);
export const getMyPolicies    = () => api.get('/policy/my');
export const getZones         = () => api.get('/policy/zones');
export const updatePolicyZone = (zone) => api.patch('/policy/active/zone', { zone });

// ── Claims ──
export const getMyClaims     = () => api.get('/api/claims/my');
export const getClaimStats   = () => api.get('/api/claims/stats');
export const simulateTrigger = (data) => api.post('/api/claims/simulate-trigger', data);
export const verifyNoGpsClaim = (id) => api.post(`/api/claims/${id}/verify-no-gps`);

// ── Analytics ──
export const getInsurerDashboard = () => api.get('/api/analytics/insurer');
export const getLiveStats        = () => api.get('/api/analytics/live');

// ── Auth ──
export const sendOTP      = (phone) => api.post('/auth/send-otp', { phone });
export const sendEmailOTP = (email) => api.post('/auth/send-email-otp', { email });

// Generic verify function to handle phone, email, and firebase tokens
export const verifyOTP = (data) => api.post('/auth/verify-otp', data);

// ── Auth helpers ──
export const login      = (data) => api.post('/auth/verify-otp', data).then(res => res.data);
export const register   = (data) => api.post('/auth/onboarding', data).then(res => res.data);
export const setToken   = (token) => { if (typeof window !== 'undefined') localStorage.setItem('gs_token', token); };
export const saveToken  = (token) => { if (typeof window !== 'undefined') localStorage.setItem('gs_token', token); };
export const getToken   = () => { if (typeof window !== 'undefined') return localStorage.getItem('gs_token'); return null; };
export const clearToken = () => { if (typeof window !== 'undefined') { localStorage.removeItem('gs_token'); localStorage.removeItem('gs_rider_id'); } };
export const isLoggedIn = () => !!getToken();

// ── Weather (direct from backend) ──
export const getLiveWeather = () => api.get('/api/analytics/weather');

export default api;
