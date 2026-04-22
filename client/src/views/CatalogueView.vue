<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import DataView from 'primevue/dataview';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import ToggleButton from 'primevue/togglebutton';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Paginator from 'primevue/paginator';
import { useToast } from 'primevue/usetoast';
import { api } from '../services/api.js';
import { produitImageUrl } from '../services/images.js';
import { usePanierStore } from '../stores/panier.js';
import { useFavorisStore } from '../stores/favoris.js';
import { useSessionStore } from '../stores/session.js';

const panier = usePanierStore();
const favoris = useFavorisStore();
const session = useSessionStore();
const toast = useToast();

async function toggleFavori(p) {
  if (!session.user) {
    toast.add({ severity: 'warn', summary: 'Connexion requise', detail: 'Connectez-vous pour gérer vos favoris.', life: 3000 });
    return;
  }
  try {
    const etait = favoris.has(p.entreprise_id);
    await favoris.toggle(p.entreprise_id);
    toast.add({
      severity: 'success',
      summary: etait ? 'Retiré des favoris' : 'Ajouté aux favoris',
      detail: p.entreprise_nom,
      life: 1500,
    });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}

const filtres = reactive({ q: '', nature: null, bio: null });
const produits = ref([]);
const total = ref(0);
const limit = ref(24);
const offset = ref(0);
const loading = ref(false);

const natures = [
  { label: 'Toutes', value: null },
  { label: 'Légumes', value: 'legume' },
  { label: 'Fruits', value: 'fruit' },
  { label: 'Viande', value: 'viande' },
  { label: 'Fromage', value: 'fromage' },
  { label: 'Épicerie', value: 'epicerie' },
  { label: 'Boisson', value: 'boisson' },
];

async function charger() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filtres.q) params.set('q', filtres.q);
    if (filtres.nature) params.set('nature', filtres.nature);
    if (filtres.bio !== null) params.set('bio', String(filtres.bio));
    params.set('limit', String(limit.value));
    params.set('offset', String(offset.value));
    const res = await api.get(`/produits?${params}`);
    produits.value = res.data;
    total.value = res.total;
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: err.message, life: 4000 });
  } finally {
    loading.value = false;
  }
}

let debounce;
watch(filtres, () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { offset.value = 0; charger(); }, 250);
}, { deep: true });

function onPage(e) { offset.value = e.first; charger(); }

function ajouter(p) {
  const result = panier.ajouter(p, 1);
  if (!result.ok) {
    toast.add({ severity: 'warn', summary: 'Stock maximum atteint', detail: `Stock disponible: ${p.stock}`, life: 2200 });
    return;
  }

  if (result.quantiteAjoutee < 1) {
    toast.add({ severity: 'warn', summary: 'Stock insuffisant', detail: p.nom, life: 2000 });
    return;
  }

  toast.add({ severity: 'success', summary: 'Ajouté au panier', detail: p.nom, life: 1500 });
}

function stockRestantPourAjout(p) {
  const dejaDansPanier = panier.quantiteProduit(p.id);
  const stock = Number.isFinite(Number(p.stock)) ? Number(p.stock) : Infinity;
  return Math.max(0, stock - dejaDansPanier);
}

function formatPrix(cents) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

onMounted(charger);
</script>

<template>
  <h2>Catalogue</h2>

  <div class="filtres">
    <InputText v-model="filtres.q" placeholder="Rechercher…" class="search" />
    <Select v-model="filtres.nature" :options="natures" option-label="label" option-value="value" placeholder="Nature" />
    <ToggleButton v-model="filtres.bio" on-label="Bio" off-label="Tous" on-icon="pi pi-check" off-icon="pi pi-circle" />
  </div>

  <DataView :value="produits" :loading="loading" layout="grid">
    <template #empty>
      <p class="empty">Aucun produit ne correspond aux critères.</p>
    </template>
    <template #grid="slotProps">
      <div class="grid">
        <article v-for="p in slotProps.items" :key="p.id" class="card">
          <RouterLink :to="`/produits/${p.id}`" class="thumb-link" :aria-label="p.nom">
            <img :src="produitImageUrl(p, 400, 260)" :alt="p.nom" class="thumb" loading="lazy" referrerpolicy="no-referrer" />
          </RouterLink>
          <header>
            <h3><RouterLink :to="`/produits/${p.id}`">{{ p.nom }}</RouterLink></h3>
            <div class="head-actions">
              <Tag v-if="p.bio" severity="success" value="Bio" icon="pi pi-leaf" />
              <Button
                :icon="favoris.has(p.entreprise_id) ? 'pi pi-heart-fill' : 'pi pi-heart'"
                :severity="favoris.has(p.entreprise_id) ? 'danger' : 'secondary'"
                text rounded
                :aria-label="favoris.has(p.entreprise_id) ? 'Retirer des favoris' : 'Ajouter aux favoris'"
                @click="toggleFavori(p)" />
            </div>
          </header>
          <p class="desc">{{ p.description }}</p>
          <p class="meta">
            <i class="pi pi-user" /> {{ p.producteur_nom }}<br>
            <i class="pi pi-shop" /> {{ p.entreprise_nom }}
          </p>
          <p class="stock" :class="{ low: p.stock > 0 && p.stock < 5, out: p.stock === 0 }">
            <i class="pi pi-box" />
            <span v-if="p.stock === 0">Rupture de stock</span>
            <span v-else>Stock disponible: {{ p.stock }}</span>
          </p>
          <footer>
            <span class="prix">{{ formatPrix(p.prix_cents) }}</span>
            <Button
              label="Ajouter"
              icon="pi pi-shopping-cart"
              size="small"
              :disabled="stockRestantPourAjout(p) === 0"
              @click="ajouter(p)" />
          </footer>
        </article>
      </div>
    </template>
  </DataView>

  <Paginator v-if="total > limit" :rows="limit" :totalRecords="total" :first="offset" @page="onPage" />
</template>

<style scoped>
.filtres {
  display: flex;
  gap: .75rem;
  margin-bottom: 1rem;
  align-items: center;
  flex-wrap: wrap;
}
.search { flex: 1 1 18rem; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 1rem;
}
.card {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: .6rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: .6rem;
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
.card h3 { margin: 0; font-size: 1.05rem; }
.card h3 a { color: inherit; text-decoration: none; }
.card h3 a:hover { color: var(--p-primary-color); }
.card .desc { color: var(--p-text-muted-color); font-size: .9rem; margin: 0; flex: 1; }
.card .meta { color: var(--p-text-muted-color); font-size: .85rem; margin: 0; line-height: 1.5; }
.stock {
  margin: 0;
  font-size: .88rem;
  color: #166534;
  display: inline-flex;
  align-items: center;
  gap: .35rem;
}
.stock.low { color: #b45309; }
.stock.out { color: #b91c1c; }
.card footer { display: flex; justify-content: space-between; align-items: center; }
.prix { font-weight: 700; font-size: 1.1rem; color: var(--p-primary-color); }
.empty { text-align: center; padding: 3rem; color: var(--p-text-muted-color); }
</style>
