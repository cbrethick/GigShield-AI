import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

// Normalise Pydantic v2 validation errors (array of {msg,loc,type}) → string
api.interceptors.response.use(
  res => res,
  err => {
    const detail = err.response?.data?.detail;
    if (Array.isArray(detail)) {
      // Pydantic v2 returns [{msg, loc, type, input}] — convert to string
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
export const getPolicyQuote  = () => api.get('/policy/quote');
export const createPolicy    = (data) => api.post('/policy/create', data);
export const getMyPolicies   = () => api.get('/policy/my');
export const getZones        = () => api.get('/policy/zones');

// ── Claims ──
export const getMyClaims     = () => api.get('/claims/my');
export const getClaimStats   = () => api.get('/claims/stats');
export const simulateTrigger = (data) => api.post('/claims/simulate-trigger', data);

// ── Analytics ──
export const getInsurerDashboard = () => api.get('/analytics/insurer');
export const getLiveStats        = () => api.get('/analytics/live');

// ── Auth ──
export const sendOTP   = (phone) => api.post('/auth/send-otp', { phone });
export const verifyOTP = (phone, firebase_token) => api.post('/auth/verify-otp', { phone, firebase_token });

// ── Auth helpers ──
export const login      = (phone, firebase_token) => api.post('/auth/verify-otp', { phone, firebase_token }).then(res => res.data);
export const register   = (data) => api.post('/auth/onboarding', data).then(res => res.data);
export const setToken   = (token) => { if (typeof window !== 'undefined') localStorage.setItem('gs_token', token); };
export const saveToken  = (token) => { if (typeof window !== 'undefined') localStorage.setItem('gs_token', token); };
export const getToken   = () => { if (typeof window !== 'undefined') return localStorage.getItem('gs_token'); return null; };
export const clearToken = () => { if (typeof window !== 'undefined') { localStorage.removeItem('gs_token'); localStorage.removeItem('gs_rider_id'); } };
export const isLoggedIn = () => !!getToken();

// ── Weather (direct from backend) ──
export const getLiveWeather = () => api.get('/analytics/weather');

export default api;
