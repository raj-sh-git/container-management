import axios from 'axios';
import { getBasePath } from '../utils/url';
import {
  AuthResponse,
  Container,
  ComposeStack,
  DockerImage,
  DockerVolume,
  DockerNetwork,
  ScanReport,
  AuditLog,
  SystemInfo,
  User,
  RegistryAuth,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : `${getBasePath()}/api`,
});

api.interceptors.request.use((config) => {
  // Update baseURL dynamically in case it wasn't available at initialization
  if (!API_BASE_URL) {
    config.baseURL = `${getBasePath()}/api`;
  }
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);


// ==================== AUTH ====================
export const authApi = {
  login: async (credentials: { username: string; password: string }): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', credentials);
    return res.data;
  },
  me: async (): Promise<User> => {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const res = await api.post('/auth/change-password', data);
    return res.data;
  },
};

// ==================== USERS ====================
export const usersApi = {
  list: async (): Promise<User[]> => {
    const res = await api.get<User[]>('/users');
    return res.data;
  },
  create: async (data: {
    username: string;
    email?: string;
    password: string;
    role: string;
    mustChangePassword?: boolean;
  }): Promise<User> => {
    const res = await api.post<User>('/users', data);
    return res.data;
  },
  update: async (id: string, data: Partial<User> & { password?: string }) => {
    const res = await api.put(`/users/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  },
};

// ==================== CONTAINERS & STACKS ====================
export const containersApi = {
  list: async (all: boolean = true): Promise<Container[]> => {
    const res = await api.get<Container[]>('/containers', { params: { all } });
    return res.data;
  },
  listStacks: async (): Promise<ComposeStack[]> => {
    const res = await api.get<ComposeStack[]>('/containers/stacks');
    return res.data;
  },
  startStack: async (name: string) => {
    const res = await api.post(`/containers/stacks/${encodeURIComponent(name)}/start`);
    return res.data;
  },
  stopStack: async (name: string) => {
    const res = await api.post(`/containers/stacks/${encodeURIComponent(name)}/stop`);
    return res.data;
  },
  restartStack: async (name: string) => {
    const res = await api.post(`/containers/stacks/${encodeURIComponent(name)}/restart`);
    return res.data;
  },
  get: async (id: string): Promise<any> => {
    const res = await api.get(`/containers/${id}`);
    return res.data;
  },
  logs: async (id: string, tail: number = 200, timestamps: boolean = true): Promise<{ logs: string }> => {
    const res = await api.get(`/containers/${id}/logs`, { params: { tail, timestamps } });
    return res.data;
  },
  changes: async (id: string): Promise<any> => {
    const res = await api.get(`/containers/${id}/changes`);
    return res.data;
  },
  create: async (config: any): Promise<any> => {
    const res = await api.post('/containers', config);
    return res.data;
  },
  start: async (id: string) => {
    const res = await api.post(`/containers/${id}/start`);
    return res.data;
  },
  stop: async (id: string, timeout: number = 10, allowSelf: boolean = false) => {
    const res = await api.post(`/containers/${id}/stop`, { timeout, allowSelf });
    return res.data;
  },
  restart: async (id: string, timeout: number = 10, allowSelf: boolean = false) => {
    const res = await api.post(`/containers/${id}/restart`, { timeout, allowSelf });
    return res.data;
  },
  pause: async (id: string) => {
    const res = await api.post(`/containers/${id}/pause`);
    return res.data;
  },
  unpause: async (id: string) => {
    const res = await api.post(`/containers/${id}/unpause`);
    return res.data;
  },
  kill: async (id: string) => {
    const res = await api.post(`/containers/${id}/kill`);
    return res.data;
  },
  rename: async (id: string, name: string) => {
    const res = await api.post(`/containers/${id}/rename`, { name });
    return res.data;
  },
  remove: async (id: string, force: boolean = false, v: boolean = false) => {
    const res = await api.delete(`/containers/${id}`, { params: { force, v } });
    return res.data;
  },
};

// ==================== IMAGES ====================
export const imagesApi = {
  list: async (all: boolean = false): Promise<DockerImage[]> => {
    const res = await api.get<DockerImage[]>('/images', { params: { all } });
    return res.data;
  },
  inspect: async (id: string): Promise<any> => {
    const res = await api.get(`/images/${id}`);
    return res.data;
  },
  history: async (id: string): Promise<any> => {
    const res = await api.get(`/images/${id}/history`);
    return res.data;
  },
  pull: async (image: string, auth?: RegistryAuth) => {
    const res = await api.post('/images/pull', { image, auth });
    return res.data;
  },
  tag: async (id: string, repo: string, tag: string = 'latest') => {
    const res = await api.post(`/images/${id}/tag`, { repo, tag });
    return res.data;
  },
  remove: async (id: string, force: boolean = false) => {
    const res = await api.delete(`/images/${id}`, { params: { force } });
    return res.data;
  },
};

// ==================== VOLUMES ====================
export const volumesApi = {
  list: async (): Promise<DockerVolume[]> => {
    const res = await api.get<DockerVolume[]>('/volumes');
    return res.data;
  },
  inspect: async (name: string): Promise<any> => {
    const res = await api.get(`/volumes/${name}`);
    return res.data;
  },
  create: async (data: { name?: string; driver?: string }): Promise<any> => {
    const res = await api.post('/volumes', data);
    return res.data;
  },
  remove: async (name: string, force: boolean = false) => {
    const res = await api.delete(`/volumes/${name}`, { params: { force } });
    return res.data;
  },
};

// ==================== NETWORKS ====================
export const networksApi = {
  list: async (): Promise<DockerNetwork[]> => {
    const res = await api.get<DockerNetwork[]>('/networks');
    return res.data;
  },
  inspect: async (id: string): Promise<any> => {
    const res = await api.get(`/networks/${id}`);
    return res.data;
  },
  create: async (data: { name: string; driver?: string }): Promise<any> => {
    const res = await api.post('/networks', data);
    return res.data;
  },
  remove: async (id: string) => {
    const res = await api.delete(`/networks/${id}`);
    return res.data;
  },
  connect: async (networkId: string, containerId: string) => {
    const res = await api.post(`/networks/${networkId}/connect`, { containerId });
    return res.data;
  },
  disconnect: async (networkId: string, containerId: string, force: boolean = false) => {
    const res = await api.post(`/networks/${networkId}/disconnect`, { containerId, force });
    return res.data;
  },
};

// ==================== SECURITY & TRIVY ====================
export const securityApi = {
  listReports: async (): Promise<ScanReport[]> => {
    const res = await api.get<ScanReport[]>('/security/reports');
    return res.data;
  },
  getReport: async (id: string): Promise<ScanReport> => {
    const res = await api.get<ScanReport>(`/security/reports/${id}`);
    return res.data;
  },
  getReportHtmlUrl: (
    id: string,
    download: boolean = false,
    sortBy: string = 'severity',
    sortOrder: string = 'desc'
  ): string => {
    const token = localStorage.getItem('token') || '';
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (download) params.set('download', 'true');
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    const basePath = API_BASE_URL ? `${API_BASE_URL}/api` : `${getBasePath()}/api`;
    return `${basePath}/security/reports/${id}/html?${params.toString()}`;
  },
  scan: async (targetType: 'image' | 'container', targetName: string, targetId?: string) => {
    const res = await api.post('/security/scan', { targetType, targetName, targetId });
    return res.data;
  },
  deleteReport: async (id: string) => {
    const res = await api.delete(`/security/reports/${id}`);
    return res.data;
  },
};

// ==================== SYSTEM ====================
export const systemApi = {
  info: async (): Promise<SystemInfo> => {
    const res = await api.get<SystemInfo>('/system/info');
    return res.data;
  },
  version: async (): Promise<any> => {
    const res = await api.get('/system/version');
    return res.data;
  },
  df: async (): Promise<any> => {
    const res = await api.get('/system/df');
    return res.data;
  },
  prune: async (options: { all?: boolean; volumes?: boolean }) => {
    const res = await api.post('/system/prune', options);
    return res.data;
  },
  auditLogs: async (limit: number = 1000): Promise<AuditLog[]> => {
    const res = await api.get<AuditLog[]>('/system/audit', { params: { limit } });
    return res.data;
  },
  clearAuditLogs: async () => {
    const res = await api.delete('/system/audit');
    return res.data;
  },
};
