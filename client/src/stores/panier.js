import { defineStore } from 'pinia';

const STORAGE_KEY = 'gumes.panier.v1';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export const usePanierStore = defineStore('panier', {
  state: () => ({ lignes: loadFromStorage() }),
  getters: {
    totalArticles: (s) => s.lignes.reduce((n, l) => n + l.quantite, 0),
    totalCents: (s) => s.lignes.reduce((n, l) => n + l.quantite * l.prix_cents, 0),
  },
  actions: {
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lignes));
    },
    ajouter(produit, quantite = 1) {
      const existing = this.lignes.find((l) => l.produit_id === produit.id);
      if (existing) existing.quantite += quantite;
      else this.lignes.push({
        produit_id: produit.id,
        nom: produit.nom,
        prix_cents: produit.prix_cents,
        entreprise_nom: produit.entreprise_nom,
        quantite,
      });
      this.persist();
    },
    retirer(produitId) {
      this.lignes = this.lignes.filter((l) => l.produit_id !== produitId);
      this.persist();
    },
    vider() { this.lignes = []; this.persist(); },
  },
});
