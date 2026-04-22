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
    quantiteProduit: (s) => (produitId) => {
      const ligne = s.lignes.find((l) => l.produit_id === produitId);
      return ligne ? ligne.quantite : 0;
    },
  },
  actions: {
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lignes));
    },
    ajouter(produit, quantite = 1) {
      const maxStock = Number.isFinite(Number(produit.stock)) ? Math.max(0, Number(produit.stock)) : Infinity;
      if (maxStock === 0 || quantite <= 0) return { ok: false, quantiteAjoutee: 0, quantiteFinale: this.quantiteProduit(produit.id) };

      const existing = this.lignes.find((l) => l.produit_id === produit.id);
      const quantiteActuelle = existing ? existing.quantite : 0;
      const quantiteFinale = Math.min(maxStock, quantiteActuelle + quantite);
      const quantiteAjoutee = Math.max(0, quantiteFinale - quantiteActuelle);

      if (existing) {
        existing.quantite = quantiteFinale;
        if (maxStock !== Infinity) existing.stock = maxStock;
      } else {
        this.lignes.push({
          produit_id: produit.id,
          nom: produit.nom,
          prix_cents: produit.prix_cents,
          entreprise_nom: produit.entreprise_nom,
          quantite: quantiteFinale,
          stock: maxStock === Infinity ? undefined : maxStock,
        });
      }

      this.persist();
      return { ok: quantiteAjoutee > 0, quantiteAjoutee, quantiteFinale };
    },
    setQuantite(produitId, quantite) {
      const ligne = this.lignes.find((l) => l.produit_id === produitId);
      if (!ligne) return;

      const maxStock = Number.isFinite(Number(ligne.stock)) ? Math.max(1, Number(ligne.stock)) : 99;
      const quantiteSecurisee = Math.max(1, Math.min(maxStock, Number(quantite) || 1));
      ligne.quantite = quantiteSecurisee;
      this.persist();
    },
    retirer(produitId) {
      this.lignes = this.lignes.filter((l) => l.produit_id !== produitId);
      this.persist();
    },
    vider() { this.lignes = []; this.persist(); },
  },
});
