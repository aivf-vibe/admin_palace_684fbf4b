







import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth service
export const authService = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data.user;
  },

  updateProfile: async (userData) => {
    const response = await api.put('/auth/profile', userData);
    return response.data;
  },

  changePassword: async (passwordData) => {
    const response = await api.post('/auth/change-password', passwordData);
    return response.data;
  },
};

// Visitor service
export const visitorService = {
  getVisitors: async (params = {}) => {
    const response = await api.get('/visitors', { params });
    return response.data;
  },

  getTodayVisitors: async () => {
    const response = await api.get('/visitors/today');
    return response.data;
  },

  getVisitor: async (id) => {
    const response = await api.get(`/visitors/${id}`);
    return response.data;
  },

  createVisitor: async (visitorData) => {
    const response = await api.post('/visitors', visitorData);
    return response.data;
  },

  updateVisitor: async (id, visitorData) => {
    const response = await api.put(`/visitors/${id}`, visitorData);
    return response.data;
  },

  deleteVisitor: async (id) => {
    const response = await api.delete(`/visitors/${id}`);
    return response.data;
  },

  checkInVisitor: async (id) => {
    const response = await api.put(`/visitors/${id}/checkin`);
    return response.data;
  },

  checkOutVisitor: async (id) => {
    const response = await api.put(`/visitors/${id}/checkout`);
    return response.data;
  },

  approveVisitor: async (id, approved, reason) => {
    const response = await api.put(`/visitors/${id}/approve`, { approved, reason });
    return response.data;
  },

  getVisitorByQR: async (qrCode) => {
    const response = await api.get(`/visitors/qr/${qrCode}`);
    return response.data;
  },
};

// Analytics service
export const analyticsService = {
  getDashboardAnalytics: async (period = '7d') => {
    const response = await api.get(`/analytics/dashboard?period=${period}`);
    return response.data;
  },

  getVisitorAnalytics: async (startDate, endDate, groupBy = 'day') => {
    const response = await api.get(`/analytics/visitors`, {
      params: { startDate, endDate, groupBy }
    });
    return response.data;
  },

  getHostAnalytics: async (startDate, endDate) => {
    const response = await api.get(`/analytics/hosts`, {
      params: { startDate, endDate }
    });
    return response.data;
  },

  getSecurityAnalytics: async (startDate, endDate) => {
    const response = await api.get(`/analytics/security`, {
      params: { startDate, endDate }
    });
    return response.data;
  },

  exportAnalytics: async (startDate, endDate, format = 'json') => {
    const response = await api.get(`/analytics/export`, {
      params: { startDate, endDate, format },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response.data;
  },
};

// Hosts service
export const hostsService = {
  getHosts: async (params = {}) => {
    const response = await api.get('/hosts', { params });
    return response.data;
  },

  getHostVisitors: async (hostId, params = {}) => {
    const response = await api.get(`/hosts/${hostId}/visitors`, { params });
    return response.data;
  },
};

// Approvals service
export const approvalsService = {
  getPendingApprovals: async (params = {}) => {
    const response = await api.get('/approvals/pending', { params });
    return response.data;
  },

  getApprovalHistory: async (params = {}) => {
    const response = await api.get('/approvals/history', { params });
    return response.data;
  },

  approveVisitor: async (id, approved, reason) => {
    const response = await api.put(`/approvals/${id}/approve`, { approved, reason });
    return response.data;
  },

  getApprovalStats: async (params = {}) => {
    const response = await api.get('/approvals/stats', { params });
    return response.data;
  },
};

export default api;








