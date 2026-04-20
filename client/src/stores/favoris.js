import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useFavorisStore = defineStore('favoris', {
  state: () => ({ ids: new Set(), loaded: false }),
  getters: {
    has: (s) => (entrepriseId) => s.ids.has(entrepriseId),
  },
  actions: {
    async charger() {
      try {
        const res = await api.get('/favoris');
        this.ids = new Set(res.data.map((f) => f.entreprise_id));
        this.loaded = true;
      } catch (err) {
        if (err.status !== 401) throw err;
      }
    },
    async toggle(entrepriseId) {
      if (this.ids.has(entrepriseId)) {
        await api.del(`/favoris/${entrepriseId}`);
        this.ids.delete(entrepriseId);
        // Force reactivity
        this.ids = new Set(this.ids);
      } else {
        await api.post('/favoris', { entreprise_id: entrepriseId });
        this.ids = new Set(this.ids).add(entrepriseId);
      }
    },
    vider() { this.ids = new Set(); this.loaded = false; },
  },
});
