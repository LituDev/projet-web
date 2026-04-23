<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api } from '../../services/api.js';
import { produitImageUrl } from '../../services/images.js';
import { usePanierStore } from '../../stores/panier.js';
import { useFavorisStore } from '../../stores/favoris.js';

const toast = useToast();
const panier = usePanierStore();
const favorisStore = useFavorisStore();
const favoris = ref([]);
const loading = ref(false);
const err = ref('');

async function charger() {
  loading.value = true;
  try { favoris.value = (await api.get('/favoris')).data; }
  catch (e) { err.value = e.message; }
  finally { loading.value = false; }
}

async function retirer(produitId) {
  try {
    await favorisStore.toggle(produitId);
    toast.add({ severity: 'success', summary: 'Retiré des favoris', life: 2000 });
    favoris.value = favoris.value.filter((f) => f.produit_id !== produitId);
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}

function ajouter(p) {
  const result = panier.ajouter(p, 1);
  if (!result.ok) {
    toast.add({ severity: 'warn', summary: 'Stock maximum atteint', detail: `Stock disponible: ${p.stock}`, life: 2200 });
    return;
  }
  toast.add({ severity: 'success', summary: 'Ajouté au panier', detail: p.nom, life: 1500 });
}

function quantitePanier(p) {
  const deja = panier.quantiteProduit(p.id);
  return Math.max(0, Number(p.stock) - deja);
}

function formatPrix(cents) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

onMounted(charger);
</script>

<template>
  <h2>Produits favoris</h2>
  <Message v-if="err" severity="error" :closable="false">{{ err }}</Message>
  <Message v-else-if="!loading && favoris.length === 0" severity="info" :closable="false">
    Aucun favori pour l'instant. Ajoutez-en depuis le catalogue.
  </Message>

  <section class="produits-grid">
      <article v-for="p in favoris" :key="p.produit_id" class="card">
        <RouterLink :to="`/produits/${p.id}`" class="thumb-link" :aria-label="p.nom">
          <img :src="produitImageUrl(p, 400, 260)" :alt="p.nom" class="thumb" loading="lazy" referrerpolicy="no-referrer" />
        </RouterLink>
        <header>
          <h4><RouterLink :to="`/produits/${p.id}`">{{ p.nom }}</RouterLink></h4>
          <div class="head-actions">
            <Tag v-if="p.bio" severity="success" value="Bio" icon="pi pi-leaf" />
            <Button icon="pi pi-heart-fill" severity="danger" text rounded aria-label="Retirer des favoris" @click="retirer(p.produit_id)" />
          </div>
        </header>
        <p class="meta"><i class="pi pi-user" /> {{ p.producteur_nom }}</p>
        <p class="meta"><i class="pi pi-shop" /> {{ p.entreprise_nom }}</p>
        <p class="stock" :class="{ low: p.stock > 0 && p.stock < 5, out: p.stock === 0 }">
          <i class="pi pi-box" />
          <span v-if="p.stock === 0">Rupture de stock</span>
          <span v-else>Stock: {{ p.stock }}</span>
        </p>
        <footer>
          <span class="prix">{{ formatPrix(p.prix_cents) }}</span>
          <Button
            label="Ajouter"
            icon="pi pi-shopping-cart"
            size="small"
            :disabled="quantitePanier(p) === 0"
            @click="ajouter(p)" />
        </footer>
      </article>
  </section>
</template>

<style scoped>
.produits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1rem;
}
.card {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: .6rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: .5rem;
  overflow: hidden;
}
.thumb-link {
  display: block;
  margin: -1rem -1rem 0;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--p-surface-100);
}
.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform .3s ease;
}
.thumb-link:hover .thumb { transform: scale(1.04); }
.card header { display: flex; justify-content: space-between; align-items: flex-start; gap: .5rem; }
.head-actions { display: flex; align-items: center; gap: .25rem; }
.card h4 { margin: 0; font-size: 1rem; }
.card h4 a { color: inherit; text-decoration: none; }
.card h4 a:hover { color: var(--p-primary-color); }
.meta { color: var(--p-text-muted-color); font-size: .85rem; margin: 0; }
.stock { margin: 0; font-size: .88rem; color: #166534; display: inline-flex; align-items: center; gap: .35rem; }
.stock.low { color: #b45309; }
.stock.out { color: #b91c1c; }
.card footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
.prix { font-weight: 700; font-size: 1.05rem; color: var(--p-primary-color); }
</style>
