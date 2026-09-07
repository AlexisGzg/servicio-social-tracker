// API Layer con soporte de Autenticación Segura (JWT + Bcrypt) y Resiliencia Local
// Cuando despliegues tu backend (por ejemplo en Render), coloca aquí su URL pública:
export const PROD_API_URL = 'https://tu-backend.onrender.com/api';

const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.')
);

const localHost = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'localhost';
const localProtocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'https:' : 'http:';
const LOCAL_API_BASE = `${localProtocol}//${localHost}:4000/api`;

export const API_BASE = isLocalhost 
  ? LOCAL_API_BASE 
  : (localStorage.getItem('sst_api_url') || PROD_API_URL);

const TOKEN_KEY = 'sst_auth_token';
const USER_KEY = 'sst_auth_user';

let isBackendAvailable = false;
let statusListeners = [];
let authListeners = [];

// ==========================================================================
// Gestión de Estado de Conexión y Suscripciones
// ==========================================================================
function notifyStatus(status) {
  isBackendAvailable = status;
  statusListeners.forEach((fn) => {
    try {
      fn(isBackendAvailable);
    } catch (e) {
      console.error('Error en listener de status:', e);
    }
  });
}

export function onStatusChange(callback) {
  statusListeners.push(callback);
  callback(isBackendAvailable);
}

function notifyAuth(user) {
  authListeners.forEach((fn) => {
    try {
      fn(user);
    } catch (e) {
      console.error('Error en listener de auth:', e);
    }
  });
}

export function onAuthChange(callback) {
  authListeners.push(callback);
  callback(getCurrentUser());
}

// Comprobar salud del backend con timeout
export async function checkBackendHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const ok = res.ok;
    notifyStatus(ok);
    return ok;
  } catch (err) {
    notifyStatus(false);
    return false;
  }
}

// ==========================================================================
// Manejo de Tokens y Encabezados de Autenticación
// ==========================================================================
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
  notifyAuth(user);
}

export function isAuthenticated() {
  return !!getToken();
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ==========================================================================
// Métodos de Autenticación
// ==========================================================================
export async function registerUser({ nombre, email, password }) {
  const isUp = await checkBackendHealth();
  if (!isUp) {
    throw new Error('El servidor no está disponible. Por favor enciende el backend para crear tu cuenta.');
  }

  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, email, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al registrar usuario');
  }

  setToken(data.token);
  setCurrentUser(data.user);
  return data;
}

export async function loginUser({ email, password }) {
  const isUp = await checkBackendHealth();
  if (!isUp) {
    throw new Error('El servidor no está disponible. Por favor enciende el backend para iniciar sesión.');
  }

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al iniciar sesión');
  }

  setToken(data.token);
  setCurrentUser(data.user);
  return data;
}

export function logoutUser() {
  setToken(null);
  setCurrentUser(null);
}

export async function forgotPassword(email) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return res.json();
}

export async function resetPassword(token, password) {
  const res = await fetch(`${API_BASE}/auth/reset-password/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al restablecer contraseña');
  }
  return data;
}

export async function verifyEmail(token) {
  const res = await fetch(`${API_BASE}/auth/verify-email/${token}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al verificar correo');
  }
  
  if (data.token && data.user) {
    setToken(data.token);
    setCurrentUser(data.user);
  } else {
    const current = getCurrentUser();
    if (current) {
      current.isVerified = true;
      setCurrentUser(current);
    }
  }
  return data;
}

export async function resendVerification() {
  const res = await fetch(`${API_BASE}/auth/resend-verification`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Error al reenviar correo');
  }
  return data;
}

export async function fetchCurrentUserProfile() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/me?_=${Date.now()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });

    if (res.status === 401) {
      logoutUser();
      return null;
    }

    if (res.ok) {
      const freshUser = await res.json();
      const currentUser = getCurrentUser();
      if (currentUser?.isVerified && !freshUser.isVerified) {
        freshUser.isVerified = true;
      }
      setCurrentUser(freshUser);
      return freshUser;
    }
  } catch (e) {
    console.warn('No se pudo refrescar el perfil del usuario:', e);
  }
  return getCurrentUser();
}

// ==========================================================================
// Helpers de Almacenamiento Local (Aislado por Usuario)
// ==========================================================================
function getLocalKey() {
  const user = getCurrentUser();
  return user ? `sst_acts_${user._id}` : 'sst_acts_guest';
}

function getLocalStore() {
  try {
    const raw = localStorage.getItem(getLocalKey());
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalStore(items) {
  try {
    localStorage.setItem(getLocalKey(), JSON.stringify(items));
  } catch (e) {
    console.warn('Error guardando en localStorage:', e);
  }
}

// ==========================================================================
// Operaciones CRUD de Actividades (Protegidas por JWT)
// ==========================================================================
export async function getActivities() {
  const backendUp = await checkBackendHealth();
  const token = getToken();

  if (backendUp && token) {
    try {
      const res = await fetch(`${API_BASE}/activities`, {
        headers: getAuthHeaders()
      });

      if (res.status === 401) {
        // Sesión expirada
        logoutUser();
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
      }

      if (res.ok) {
        const data = await res.json();
        // Mantener actividades locales pendientes si existen
        const local = getLocalStore();
        const pending = local.filter((it) => it._id && it._id.startsWith('local_'));
        const combined = [...pending, ...data];
        saveLocalStore(combined);
        return combined.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      }
    } catch (e) {
      if (e.message.includes('Sesión expirada')) throw e;
      console.warn('Fallo al obtener del backend, recurriendo a local:', e);
    }
  }

  // Fallback a localStorage
  notifyStatus(false);
  const items = getLocalStore();
  return items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

export async function createActivity(data) {
  const token = getToken();

  if (isBackendAvailable && token) {
    try {
      const res = await fetch(`${API_BASE}/activities`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });

      if (res.status === 401) {
        logoutUser();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
      }

      if (res.ok) {
        const created = await res.json();
        const local = getLocalStore();
        local.unshift(created);
        saveLocalStore(local);
        return created;
      }
    } catch (e) {
      if (e.message.includes('Sesión expirada')) throw e;
      console.warn('Fallo al crear en backend, guardando localmente:', e);
    }
  }

  // Guardado local
  notifyStatus(false);
  const local = getLocalStore();
  const newActivity = {
    _id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    ...data,
    createdAt: new Date().toISOString()
  };
  local.unshift(newActivity);
  saveLocalStore(local);
  return newActivity;
}

export async function updateActivity(id, updatedData) {
  const token = getToken();

  if (isBackendAvailable && token && !id.startsWith('local_')) {
    try {
      const res = await fetch(`${API_BASE}/activities/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedData)
      });

      if (res.status === 401) {
        logoutUser();
        throw new Error('Sesión expirada');
      }

      if (res.ok) {
        const updated = await res.json();
        const local = getLocalStore().map((item) => (item._id === id ? updated : item));
        saveLocalStore(local);
        return updated;
      }
    } catch (e) {
      if (e.message.includes('Sesión expirada')) throw e;
      console.warn('Fallo al actualizar en backend, actualizando localmente:', e);
    }
  }

  // Actualización local
  const local = getLocalStore().map((item) => {
    if (item._id === id) {
      return { ...item, ...updatedData, updatedAt: new Date().toISOString() };
    }
    return item;
  });
  saveLocalStore(local);
  return { _id: id, ...updatedData };
}

export async function deleteActivity(id) {
  const token = getToken();

  if (isBackendAvailable && token && !id.startsWith('local_')) {
    try {
      const res = await fetch(`${API_BASE}/activities/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.status === 401) {
        logoutUser();
        throw new Error('Sesión expirada');
      }

      if (res.ok) {
        const local = getLocalStore().filter((item) => item._id !== id);
        saveLocalStore(local);
        return { message: 'Eliminado con éxito' };
      }
    } catch (e) {
      if (e.message.includes('Sesión expirada')) throw e;
      console.warn('Fallo al eliminar en backend, eliminando localmente:', e);
    }
  }

  // Eliminación local
  const local = getLocalStore().filter((item) => item._id !== id);
  saveLocalStore(local);
  return { message: 'Eliminado con éxito en modo local' };
}

// ==========================================================================
// Sincronización Manual de Pendientes a MongoDB
// ==========================================================================
export function getPendingSyncCount() {
  const local = getLocalStore();
  return local.filter((it) => it._id && String(it._id).startsWith('local_')).length;
}

export async function syncPendingActivities() {
  const isUp = await checkBackendHealth();
  const token = getToken();

  if (!isUp || !token) {
    throw new Error('Debes tener el servidor activo y haber iniciado sesión para sincronizar.');
  }

  const local = getLocalStore();
  const pending = local.filter((it) => it._id && String(it._id).startsWith('local_'));

  if (pending.length === 0) {
    return { synced: 0 };
  }

  let successCount = 0;
  for (const act of pending) {
    try {
      const payload = {
        fecha: act.fecha,
        horas: Number(act.horas),
        descripcion: act.descripcion,
        lugar: act.lugar || '',
        evidenciaUrl: act.evidenciaUrl || ''
      };
      const res = await fetch(`${API_BASE}/activities`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        successCount++;
      }
    } catch (e) {
      console.error('Error al sincronizar actividad:', act, e);
    }
  }

  // Obtener actividades actualizadas desde el backend
  const res = await fetch(`${API_BASE}/activities`, {
    headers: getAuthHeaders()
  });
  if (res.ok) {
    const freshData = await res.json();
    saveLocalStore(freshData);
  }

  return { synced: successCount };
}

export function getStatus() {
  return isBackendAvailable;
}