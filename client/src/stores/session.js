import { defineStore } from 'pinia';
import { api } from '../services/api.js';
import { useFavorisStore } from './favoris.js';
import { usePanierStore } from './panier.js';

function applyRoleTheme(role) {
  const html = document.documentElement;
  html.classList.remove('role-user', 'role-seller', 'role-admin');
  if (role) html.classList.add(`role-${role}`);
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    user: null,
    loaded: false,
  }),
  getters: {
    isAuthenticated: (s) => Boolean(s.user),
    isAdmin: (s) => s.user?.role === 'admin',
    isSeller: (s) => s.user?.role === 'seller',
    isClient: (s) => s.user?.role === 'user',
  },
  actions: {
    async fetchMe() {
      try {
        const { user } = await api.get('/auth/me');
        this.user = user;
        applyRoleTheme(user?.role);
        if (user?.role === 'seller') {
          usePanierStore().vider();
        }
        if (user?.role === 'user' || user?.role === 'admin') {
          await useFavorisStore().charger();
        }
      } catch (err) {
        if (err.status === 401) {
          this.user = null;
          applyRoleTheme(null);
        } else {
          console.error('fetchMe', err);
        }
      } finally {
        this.loaded = true;
      }
    },
    async login(email, password) {
      const { user } = await api.post('/auth/login', { email, password });
      this.user = user;
      applyRoleTheme(user.role);
      if (user.role === 'seller') {
        usePanierStore().vider();
      }
      if (user.role === 'user' || user.role === 'admin') {
        await useFavorisStore().charger();
      }
      return user;
    },
    async register(payload) {
      const { user } = await api.post('/auth/register', payload);
      this.user = user;
      applyRoleTheme(user.role);
      if (user.role === 'seller') {
        usePanierStore().vider();
      }
      if (user.role === 'user' || user.role === 'admin') {
        await useFavorisStore().charger();
      }
      return user;
    },
    async logout() {
      await api.post('/auth/logout');
      this.user = null;
      applyRoleTheme(null);
      useFavorisStore().vider();
    },
  },
});
