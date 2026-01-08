export type User = {
  id: number;
  name: string;
  email: string;
  role: 'SENDER' | 'DISPATCHER' | 'COURIER' | 'ADMIN';
};

export type Delivery = {
  id: number;
  trackingCode: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: string;
  senderId: number;
  receiverName: string;
  receiverPhone: string;
  destinationAddress: string;
  pdfUrl?: string | null;
  createdAt: string;
};

export type DeliveryEvent = {
  id: number;
  type: string;
  note?: string | null;
  locationText?: string | null;
  proofImageUrl?: string | null;
  createdAt: string;
  createdBy?: { name: string; role: string };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Request failed');
  }
  return res.json();
}

export const authApi = {
  login: (data: { email: string; password: string }) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: { name: string; email: string; password: string; role: User['role'] }) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: (token: string) => apiFetch('/auth/logout', { method: 'POST' }, token)
};

export const deliveryApi = {
  create: (token: string, data: Partial<Delivery>) => apiFetch('/deliveries', { method: 'POST', body: JSON.stringify(data) }, token),
  mine: (token: string) => apiFetch('/me/deliveries', { method: 'GET' }, token),
  adminAll: (token: string) => apiFetch('/deliveries', { method: 'GET' }, token),
  adminStats: (token: string) => apiFetch('/stats', { method: 'GET' }, token),
  getCouriers: (token: string) => apiFetch('/couriers', { method: 'GET' }, token),
  assign: (token: string, id: string, courierId: string) =>
    apiFetch(`/deliveries/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ courierId }) }, token),
  updateStatus: (token: string, id: string, payload: { status: string; note?: string; locationText?: string; proofImageUrl?: string }) =>
    apiFetch(`/deliveries/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  addEvent: (token: string, id: string, payload: { type: string; note?: string; locationText?: string }) =>
    apiFetch(`/deliveries/${id}/events`, { method: 'POST', body: JSON.stringify(payload) }, token),
  publicTrack: (trackingCode: string) => apiFetch(`/deliveries/${trackingCode}/public`),
  downloadPDF: async (token: string, id: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    try {
      const res = await fetch(`${API_URL}/deliveries/${id}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(error.message || 'Failed to download PDF');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `delivery-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('PDF download error:', error);
      throw error;
    }
  }
};

export type Integration = {
  _id?: string;
  role?: 'SENDER' | 'DISPATCHER' | 'COURIER' | 'PUBLIC' | 'ADMIN' | null;
  name: string;
  contextualKey: string;
  iframeScriptTag: string;
  createdAt?: string;
  updatedAt?: string;
};

export const integrationApi = {
  getAll: (role?: 'SENDER' | 'DISPATCHER' | 'COURIER' | 'PUBLIC' | 'ADMIN') => {
    const url = role ? `/integration?role=${role}` : '/integration';
    return apiFetch(url, { method: 'GET' });
  },
  getById: (id: string) => apiFetch(`/integration/${id}`, { method: 'GET' }),
  getByKey: (key: string) => apiFetch(`/integration/key/${key}`, { method: 'GET' }),
  create: (data: { contextualKey: string; iframeScriptTag: string; name?: string; role?: 'SENDER' | 'DISPATCHER' | 'COURIER' | 'PUBLIC' | 'ADMIN' }) =>
    apiFetch('/integration', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { contextualKey: string; iframeScriptTag: string; name?: string; role?: 'SENDER' | 'DISPATCHER' | 'COURIER' | 'PUBLIC' | 'ADMIN' }) =>
    apiFetch(`/integration/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/integration/${id}`, { method: 'DELETE' })
};
