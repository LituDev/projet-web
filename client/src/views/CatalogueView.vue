<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import DataView from 'primevue/dataview';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Paginator from 'primevue/paginator';
import ToggleButton from 'primevue/togglebutton';
import Popover from 'primevue/popover';
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
const route = useRoute();
const router = useRouter();

async function toggleFavori(p) {
  if (!session.user) {
    toast.add({ severity: 'warn', summary: 'Connexion requise', detail: 'Connectez-vous pour gérer vos favoris.', life: 3000 });
    return;
  }
  try {
    const etait = favoris.has(p.id);
    await favoris.toggle(p.id);
    toast.add({
      severity: 'success',
      summary: etait ? 'Retiré des favoris' : 'Ajouté aux favoris',
      detail: p.nom,
      life: 1500,
    });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}

const filtres = reactive({ q: '', nature: null, bio: null, tri: 'nom_asc', favoris_only: false });
const filtreEntrepriseId = ref('');
const filtreEntrepriseNom = ref('');
const entreprises = ref([]);
const produits = ref([]);
const total = ref(0);
const listePopoverRef = ref(null);
const produitListeActif = ref(null);
const listesDisponibles = ref([]);
const listesChargees = ref(false);
const listesChargement = ref(false);
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

const bios = [
  { label: 'Tous', value: null },
  { label: 'Bio', value: true },
  { label: 'Non bio', value: false },
];

const tris = [
  { label: 'Nom (A-Z)', value: 'nom_asc' },
  { label: 'Prix croissant', value: 'prix_asc' },
  { label: 'Prix décroissant', value: 'prix_desc' },
  { label: 'Stock disponible', value: 'stock_desc' },
  { label: 'Bio en premier', value: 'bio_first' },
  { label: 'Livraison d\'abord', value: 'livraison_first' },
  { label: 'Retrait sur place d\'abord', value: 'retrait_first' },
];

async function charger() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filtres.q) params.set('q', filtres.q);
    if (filtreEntrepriseId.value) params.set('entreprise_id', filtreEntrepriseId.value);
    if (filtres.nature) params.set('nature', filtres.nature);
    if (filtres.bio !== null) params.set('bio', String(filtres.bio));
    if (filtres.tri) params.set('tri', filtres.tri);
    if (filtres.favoris_only && session.user) params.set('favoris_only', 'true');
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

watch(filtreEntrepriseId, (id) => {
  filtreEntrepriseNom.value = entreprises.value.find(e => e.id === id)?.nom ?? '';
  const nextQuery = { ...route.query };
  if (id) { nextQuery.entreprise_id = id; nextQuery.entreprise_nom = filtreEntrepriseNom.value; }
  else { delete nextQuery.entreprise_id; delete nextQuery.entreprise_nom; }
  router.replace({ query: nextQuery });
  offset.value = 0;
  charger();
});

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

function canAjouterPanier() {
  return session.user?.role !== 'seller';
}

async function ouvrirPopoverListe(event, produit) {
  if (!session.user) {
    toast.add({ severity: 'warn', summary: 'Connexion requise', detail: 'Connectez-vous pour gérer vos listes.', life: 3000 });
    return;
  }
  produitListeActif.value = produit;
  listePopoverRef.value.toggle(event);
  if (!listesChargees.value && !listesChargement.value) {
    listesChargement.value = true;
    try {
      const res = await api.get('/liste-courses');
      listesDisponibles.value = res.data;
      listesChargees.value = true;
    } catch (e) {
      toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
    } finally {
      listesChargement.value = false;
    }
  }
}

async function ajouterAListe(listeId) {
  const p = produitListeActif.value;
  if (!p) return;
  try {
    await api.post(`/liste-courses/${listeId}/items`, { produit_id: p.id, quantite: 1 });
    toast.add({ severity: 'success', summary: 'Ajouté à la liste', detail: p.nom, life: 2000 });
    listePopoverRef.value.hide();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}

async function creerEtAjouter() {
  try {
    const { liste } = await api.post('/liste-courses', { nom: `Liste ${new Date().toLocaleDateString('fr-FR')}` });
    listesDisponibles.value = [...listesDisponibles.value, liste];
    await ajouterAListe(liste.id);
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}

onMounted(async () => {
  if (typeof route.query.q === 'string') filtres.q = route.query.q;
  if (typeof route.query.entreprise_id === 'string') filtreEntrepriseId.value = route.query.entreprise_id;
  if (typeof route.query.entreprise_nom === 'string') filtreEntrepriseNom.value = route.query.entreprise_nom;
  await charger();
  try {
    const ents = await api.get('/entreprises');
    entreprises.value = ents.data;
  } catch {
    toast.add({
      severity: 'warn',
      summary: 'Filtre fermes indisponible',
      detail: 'Impossible de charger les fermes pour le moment.',
      life: 3000,
    });
  }
});
</script>

<template>
  <h2>Catalogue</h2>

  <div class="filtres">
    <InputText v-model="filtres.q" placeholder="Produit, producteur ou ferme…" class="search" />
    <Select v-model="filtreEntrepriseId" :options="entreprises" option-label="nom" option-value="id" placeholder="Toutes les fermes" :show-clear="true" filter filter-placeholder="Rechercher une ferme…" />
    <Select v-model="filtres.nature" :options="natures" option-label="label" option-value="value" placeholder="Nature" />
    <Select v-model="filtres.bio" :options="bios" option-label="label" option-value="value" placeholder="Bio" />
    <Select v-model="filtres.tri" :options="tris" option-label="label" option-value="value" placeholder="Trier par" />
    <ToggleButton
      v-if="session.user && session.user.role !== 'seller'"
      v-model="filtres.favoris_only"
      on-label="Favoris"
      off-label="Favoris"
      on-icon="pi pi-heart-fill"
      off-icon="pi pi-heart"
      :severity="filtres.favoris_only ? 'danger' : 'secondary'" />
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
              <Tag
                :severity="p.shippable ? 'info' : 'secondary'"
                :icon="p.shippable ? 'pi pi-truck' : 'pi pi-shop'"
                :value="p.shippable ? 'Livraison' : 'Retrait sur place'" />
              <Button
                :icon="favoris.has(p.id) ? 'pi pi-heart-fill' : 'pi pi-heart'"
                :severity="favoris.has(p.id) ? 'danger' : 'secondary'"
                text rounded
                :aria-label="favoris.has(p.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'"
                @click="toggleFavori(p)" />
              <Button
                v-if="session.user?.role !== 'seller'"
                icon="pi pi-bookmark"
                severity="secondary"
                text rounded
                aria-label="Ajouter à une liste de courses"
                @click="(e) => ouvrirPopoverListe(e, p)" />
            </div>
          </header>
          <p class="desc">{{ p.description }}</p>
          <p class="meta">
            <i class="pi pi-user" /> {{ p.producteur_nom }}<br>
            <i class="pi pi-shop" /> <RouterLink :to="`/entreprises/${p.entreprise_id}`">{{ p.entreprise_nom }}</RouterLink>
          </p>
          <p class="stock" :class="{ low: p.stock > 0 && p.stock < 5, out: p.stock === 0 }">
            <i class="pi pi-box" />
            <span v-if="p.stock === 0">Rupture de stock</span>
            <span v-else>Stock disponible: {{ p.stock }}</span>
          </p>
          <footer>
            <span class="prix">{{ formatPrix(p.prix_cents) }}</span>
            <Button
              v-if="canAjouterPanier()"
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

  <Popover ref="listePopoverRef">
    <div class="liste-pop">
      <p class="liste-pop-title">Ajouter à une liste</p>
      <p v-if="listesChargement" class="liste-pop-hint">Chargement…</p>
      <template v-else>
        <button v-for="l in listesDisponibles" :key="l.id" class="liste-pop-item" @click="ajouterAListe(l.id)">
          <i class="pi pi-list" /> {{ l.nom }}
        </button>
        <button class="liste-pop-item liste-pop-new" @click="creerEtAjouter">
          <i class="pi pi-plus" /> Nouvelle liste
        </button>
      </template>
    </div>
  </Popover>
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
.card header { display: flex; justify-content: space-between; align-items: flex-start; gap: .5rem; flex-wrap: wrap; }
.head-actions { display: flex; align-items: center; gap: .25rem; flex-wrap: wrap; justify-content: flex-end; }
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
.liste-pop { display: flex; flex-direction: column; gap: .25rem; min-width: 14rem; }
.liste-pop-title { font-weight: 600; font-size: .9rem; margin: 0 0 .4rem; }
.liste-pop-hint { font-size: .9rem; color: var(--p-text-muted-color); margin: 0; }
.liste-pop-item {
  display: flex; align-items: center; gap: .5rem;
  background: none; border: none; cursor: pointer;
  padding: .45rem .5rem; border-radius: .35rem;
  font-size: .9rem; text-align: left; width: 100%;
  transition: background-color .15s;
}
.liste-pop-item:hover { background: color-mix(in srgb, #0f172a 8%, transparent); }
.liste-pop-new { color: var(--p-primary-color); }
</style>
