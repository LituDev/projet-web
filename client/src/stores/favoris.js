import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useFavorisStore = defineStore('favoris', {
  state: () => ({ ids: new Set(), loaded: false }),
  getters: {
    has: (s) => (produitId) => s.ids.has(produitId),
  },
  actions: {
    async charger() {
      try {
        const res = await api.get('/favoris');
        this.ids = new Set(res.data.map((f) => f.produit_id));
        this.loaded = true;
      } catch (err) {
        if (err.status !== 401) throw err;
      }
    },
    async toggle(produitId) {
      if (this.ids.has(produitId)) {
        await api.del(`/favoris/${produitId}`);
        this.ids.delete(produitId);
        // Force reactivity
        this.ids = new Set(this.ids);
      } else {
        await api.post('/favoris', { produit_id: produitId });
        this.ids = new Set(this.ids).add(produitId);
      }
    },
    vider() { this.ids = new Set(); this.loaded = false; },
  },
});
