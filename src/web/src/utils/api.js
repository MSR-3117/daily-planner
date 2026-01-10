// API URL - uses relative paths on Vercel, absolute for local dev
const API_URL = import.meta.env.VITE_API_URL || (
    window.location.hostname === 'localhost'
        ? `http://${window.location.hostname}:3000`
        : '/api'
);

async function request(endpoint, options = {}) {
    // On Vercel, prepend /api to endpoints
    const url = API_URL === '/api'
        ? `/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`
        : `${API_URL}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// Auth API
export const auth = {
    register: (email, password) =>
        request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
    login: (email, password) =>
        request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () =>
        request('/auth/logout', { method: 'POST' }),
    me: () =>
        request('/auth/me'),
};

// Tasks API
export const tasks = {
    getByDate: (date) => request(`/tasks?date=${date}`),
    create: (taskData) =>
        request('/tasks', { method: 'POST', body: JSON.stringify(taskData) }),
    update: (id, updates) =>
        request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    delete: (id) =>
        request(`/tasks/${id}`, { method: 'DELETE' }),
};

// Metrics API
export const metrics = {
    getMonthly: () => request('/metrics/monthly'),
    getStreaks: () => request('/metrics/streaks'),
    getAnalytics: () => request('/metrics/analytics'),
};

// Settings API
export const settings = {
    get: () => request('/settings'),
    update: (settingsData) =>
        request('/settings', { method: 'PUT', body: JSON.stringify(settingsData) }),
};

// Time Blocks API
export const timeblocks = {
    list: () => request('/timeblocks'),
    create: (data) =>
        request('/timeblocks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
        request(`/timeblocks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) =>
        request(`/timeblocks/${id}`, { method: 'DELETE' }),
};
