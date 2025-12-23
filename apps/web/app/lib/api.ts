const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    cache: 'no-store'
  });
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const body = await res.json();
      message = body.message || JSON.stringify(body);
    } catch (e) {}
    throw new Error(message);
  }
  return res.json();
}

export function authHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(email: string, password: string) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export async function register(data: { name: string; email: string; password: string; role: string }) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(data) });
}

export async function createDelivery(token: string, payload: any) {
  return request('/deliveries', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(payload) });
}

export async function getMyDeliveries(token: string) {
  return request('/me/deliveries', { headers: authHeaders(token) });
}

export async function assignDelivery(token: string, id: number, courierId: number) {
  return request(`/deliveries/${id}/assign`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ courierId })
  });
}

export async function updateStatus(token: string, id: number, status: string, note?: string, locationText?: string) {
  return request(`/deliveries/${id}/status`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status, note, locationText })
  });
}

export async function addEvent(token: string, id: number, payload: any) {
  return request(`/deliveries/${id}/events`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(payload) });
}

export async function getPublicTracking(trackingCode: string) {
  return request(`/deliveries/${trackingCode}/public`, { cache: 'no-store' });
}

export async function getAdminData(token: string) {
  const [stats, deliveries] = await Promise.all([
    request('/stats', { headers: authHeaders(token) }),
    request('/deliveries', { headers: authHeaders(token) })
  ]);
  return { stats, deliveries };
}

export { API_URL };
