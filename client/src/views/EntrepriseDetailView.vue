<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Rating from 'primevue/rating';
import Divider from 'primevue/divider';
import { api } from '../services/api.js';
import { produitImageUrl } from '../services/images.js';

const route = useRoute();
const loading = ref(false);
const err = ref('');
const entreprise = ref(null);

const moyenne = computed(() => Number(entreprise.value?.avis_stats?.moyenne ?? 0));
const nbAvis = computed(() => Number(entreprise.value?.avis_stats?.nb_avis ?? 0));

function formatPrix(cents) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function formatDate(dt) {
  return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function charger() {
  loading.value = true;
  err.value = '';
  try {
    const res = await api.get(`/entreprises/${route.params.id}`);
    entreprise.value = res.entreprise;
  } catch (e) {
    err.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(charger);
</script>

<template>
  <div v-if="err" class="error">{{ err }}</div>
  <div v-else-if="loading" class="loading">Chargement…</div>
  <template v-else-if="entreprise">
    <section class="hero">
      <h1>{{ entreprise.nom }}</h1>
      <p class="desc">{{ entreprise.description || 'Aucune description.' }}</p>
      <div class="hero-meta">
        <span><i class="pi pi-user" /> {{ entreprise.producteur_nom }}</span>
        <span><i class="pi pi-phone" /> {{ entreprise.producteur_tel }}</span>
        <span><i class="pi pi-hashtag" /> SIRET {{ entreprise.siret }}</span>
      </div>
      <div class="rating-wrap">
        <Rating :modelValue="moyenne" :cancel="false" readonly />
        <strong>{{ moyenne.toFixed(2) }}/5</strong>
        <small>({{ nbAvis }} avis)</small>
      </div>
    </section>

    <Divider />

    <section>
      <h2>Produits du vendeur</h2>
      <p v-if="entreprise.produits.length === 0" class="muted">Aucun produit visible pour le moment.</p>
      <div v-else class="grid">
        <article v-for="p in entreprise.produits" :key="p.id" class="card">
          <RouterLink :to="`/produits/${p.id}`" class="thumb-link" :aria-label="p.nom">
            <img :src="produitImageUrl(p, 400, 260)" :alt="p.nom" class="thumb" loading="lazy" referrerpolicy="no-referrer" />
          </RouterLink>
          <header>
            <h3><RouterLink :to="`/produits/${p.id}`">{{ p.nom }}</RouterLink></h3>
            <Tag v-if="p.bio" severity="success" value="Bio" icon="pi pi-leaf" />
          </header>
          <p class="desc-small">{{ p.description }}</p>
          <footer>
            <span class="prix">{{ formatPrix(p.prix_cents) }}</span>
            <Tag :severity="p.shippable ? 'info' : 'secondary'" :value="p.shippable ? 'Livraison' : 'Retrait'" />
          </footer>
        </article>
      </div>
    </section>

    <Divider />

    <section>
      <h2>Derniers avis</h2>
      <p v-if="entreprise.avis_recents.length === 0" class="muted">Pas encore d’avis pour ce vendeur.</p>
      <div v-else class="avis-list">
        <article v-for="a in entreprise.avis_recents" :key="a.id" class="avis-card">
          <div class="avis-top">
            <strong>{{ a.auteur }}</strong>
            <Rating :modelValue="a.note" :cancel="false" readonly />
          </div>
          <p class="muted">Sur <RouterLink :to="`/produits/${a.produit_id}`">{{ a.produit_nom }}</RouterLink> • {{ formatDate(a.created_at) }}</p>
          <p>{{ a.commentaire }}</p>
        </article>
      </div>
    </section>
  </template>
</template>

<style scoped>
.hero h1 { margin: 0 0 .4rem; font-size: 2rem; }
.desc { margin: 0; color: var(--p-text-muted-color); }
.hero-meta { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: .8rem; color: var(--p-text-muted-color); }
.rating-wrap { display: flex; align-items: center; gap: .5rem; margin-top: .8rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: 1rem; }
.card { border: 1px solid var(--p-content-border-color); border-radius: .6rem; padding: 1rem; display: flex; flex-direction: column; gap: .6rem; }
.thumb-link { display: block; margin: -1rem -1rem 0; aspect-ratio: 4 / 3; overflow: hidden; }
.thumb { width: 100%; height: 100%; object-fit: cover; }
.card header { display: flex; justify-content: space-between; align-items: flex-start; gap: .5rem; }
.card h3 { margin: 0; font-size: 1rem; }
.card h3 a { color: inherit; text-decoration: none; }
.desc-small { color: var(--p-text-muted-color); margin: 0; font-size: .9rem; }
.card footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
.prix { font-weight: 700; color: var(--p-primary-color); }
.avis-list { display: grid; gap: .75rem; }
.avis-card { border: 1px solid var(--p-content-border-color); border-radius: .5rem; padding: .75rem; }
.avis-top { display: flex; justify-content: space-between; align-items: center; gap: .5rem; }
.muted { color: var(--p-text-muted-color); margin: 0; }
.loading, .error { padding: 1rem 0; }
</style>
