import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh });
        localStorage.setItem('access_token', data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (credentials) => api.post('/auth/login/', credentials);
export const logout = (refreshToken) => api.post('/auth/logout/', { refresh: refreshToken });
export const refreshToken = (refresh) => api.post('/auth/refresh/', { refresh });

// ── Tickets ───────────────────────────────────────────────────────────────────
export const getTickets = (params = {}) => api.get('/tickets/', { params });
export const getTicket = (id) => api.get(`/tickets/${id}/`);
export const createTicket = (data) => api.post('/tickets/', data);
export const assignTicket = (id) => api.patch(`/tickets/${id}/assigner/`);
export const changeTicketStatus = (id, statut, notes = '') =>
  api.patch(`/tickets/${id}/changer_statut/`, { statut, notes_technicien: notes });

// ── IA ────────────────────────────────────────────────────────────────────────
export const suggererIA = (id) => api.post(`/tickets/${id}/suggerer_ia/`);
export const getSuggestions = (id) => api.get(`/tickets/${id}/suggestions/`);
export const feedbackSuggestion = (id, data) => api.patch(`/suggestions/${id}/feedback/`, data);

// ── Équipements ───────────────────────────────────────────────────────────────
export const getEquipements = (params = {}) => api.get('/equipements/', { params });
export const getEquipement = (id) => api.get(`/equipements/${id}/`);
export const createEquipement = (data) => api.post('/equipements/', data);
export const updateEquipement = (id, data) => api.patch(`/equipements/${id}/`, data);
export const getEquipementStats = (id) => api.get(`/equipements/${id}/statistiques/`);
export const getEquipementStatsMensuelles = (id) => api.get(`/equipements/${id}/statistiques_mensuelles/`);

/** Pannes par mois. Sans `params`, retourne les 12 mois glissants.
 *  Avec `{ annee: 2024 }`, retourne janvier–décembre de cette année. */
export const getEquipementPannesParMois = (id, params = {}) =>
  api.get(`/equipements/${id}/pannes_par_mois/`, { params });

export const getEquipementPiecesDetail = (id, params = {}) =>
  api.get(`/equipements/${id}/pieces_detail/`, { params });
export const getEquipementInterventions = (id, params = {}) =>
  api.get(`/equipements/${id}/interventions/`, { params });

// ── Analyse IA ────────────────────────────────────────────────────────────────
export const getPannesRecurrentes = (equipementId) =>
  api.get(`/equipements/${equipementId}/pannes_recurrentes/`);
export const getCasSimilaires = (equipementId, ticketId) =>
  api.get(`/equipements/${equipementId}/cas_similaires/?ticket_id=${ticketId}`);
export const getResumeIA = (equipementId) =>
  api.get(`/equipements/${equipementId}/resume_ia/`);

// ── Notifications ─────────────────────────────────────────────────────────────
export const getNotifications = () => api.get('/notifications/');
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/lire/`);

// ── Dashboard ─────────────────────────────────────────────────────────────────

/** KPIs globaux : totaux par statut, MTTR, top équipements. */
export const getDashboardStats = () => api.get('/dashboard/stats/');

/**
 * Évolution mensuelle sur les 12 derniers mois glissants.
 * Retourne : [{ mois, label, tickets_crees, tickets_resolus }, ...]
 */
export const getDashboardStatsMensuelles = () =>
  api.get('/dashboard/stats_mensuelles/');

/**
 * Répartition actuelle des tickets par statut.
 * Retourne : { ouvert, en_cours, attente_pieces, resolu }
 */
export const getDashboardStatsParStatut = (annee) =>
  api.get(`/dashboard/stats_par_statut/?annee=${annee}`);

// ── NOUVEAU : Statistiques pour un mois spécifique ───────────────────────────
export const getDashboardStatsParMois = (mois) =>
  api.get(`/dashboard/stats_par_mois/?mois=${mois}`);

// ── Utilisateurs ──────────────────────────────────────────────────────────────
export const getUtilisateurs = () => api.get('/utilisateurs/');

export default api;