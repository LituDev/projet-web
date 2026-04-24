<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Rating from 'primevue/rating';
import Popover from 'primevue/popover';
import InputText from 'primevue/inputtext';
import { useToast } from 'primevue/usetoast';
import { api } from '../services/api.js';
import { produitImageUrl } from '../services/images.js';
import { usePanierStore } from '../stores/panier.js';
import { useFavorisStore } from '../stores/favoris.js';
import { useSessionStore } from '../stores/session.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const panier = usePanierStore();
const favoris = useFavorisStore();
const session = useSessionStore();

const produit = ref(null);
const quantite = ref(1);
const loading = ref(false);
const err = ref('');
const avis = ref([]);
const avisStats = ref({ moyenne: 0, nb_avis: 0 });
const monAvis = ref(null);
const note = ref(5);
const commentaire = ref('');
const postingAvis = ref(false);

const stockRestant = computed(() => {
  if (!produit.value) return 0;
  const dejaDansPanier = panier.quantiteProduit(produit.value.id);
  return Math.max(0, Number(produit.value.stock || 0) - dejaDansPanier);
});

const natureLabel = {
  legume: 'Légume', fruit: 'Fruit', viande: 'Viande',
  fromage: 'Fromage', epicerie: 'Épicerie', boisson: 'Boisson', autre: 'Autre',
};
const mois = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

const formatPrix = (cents) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

const canAjouterPanier = computed(() => session.user?.role !== 'seller');
const isClient = computed(() => session.user?.role === 'user' || session.user?.role === 'admin');

const listePopoverRef = ref(null);
const listesDisponibles = ref([]);
const listesChargees = ref(false);
const listesChargement = ref(false);
const nouveauNomListe = ref('');

async function ouvrirPopoverListe(event) {
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
  try {
    await api.post(`/liste-courses/${listeId}/items`, { produit_id: produit.value.id, quantite: 1 });
    toast.add({ severity: 'success', summary: 'Ajouté à la liste', detail: produit.value.nom, life: 2000 });
    listePopoverRef.value.hide();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}

async function creerEtAjouter() {
  const nom = nouveauNomListe.value.trim();
  if (!nom) {
    toast.add({ severity: 'warn', summary: 'Nom requis', detail: 'Choisissez un nom pour la nouvelle liste.', life: 2500 });
    return;
  }
  try {
    const { liste } = await api.post('/liste-courses', { nom });
    listesDisponibles.value = [...listesDisponibles.value, liste];
    nouveauNomListe.value = '';
    await ajouterAListe(liste.id);
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}

async function charger() {
  loading.value = true;
  err.value = '';
  try {
    const res = await api.get(`/produits/${route.params.id}`);
    produit.value = res.produit;
    await chargerAvis();
  } catch (e) { err.value = e.message; }
  finally { loading.value = false; }
}

async function chargerAvis() {
  const res = await api.get(`/avis/produits/${route.params.id}?limit=8&offset=0`);
  avis.value = res.data ?? [];
  avisStats.value = res.stats ?? { moyenne: 0, nb_avis: 0 };
  monAvis.value = res.mon_avis ?? null;
  if (monAvis.value) {
    note.value = monAvis.value.note;
    commentaire.value = monAvis.value.commentaire;
  }
}

function ajouterPanier() {
  const result = panier.ajouter({
    id: produit.value.id,
    nom: produit.value.nom,
    prix_cents: produit.value.prix_cents,
    entreprise_nom: produit.value.entreprise_nom,
    stock: produit.value.stock,
  }, quantite.value);
  if (!result.ok) {
    toast.add({ severity: 'warn', summary: 'Stock maximum atteint', detail: `Stock disponible: ${produit.value.stock}`, life: 2200 });
    return;
  }
  toast.add({ severity: 'success', summary: 'Ajouté au panier', detail: `${result.quantiteAjoutee} × ${produit.value.nom}`, life: 1500 });
}

async function toggleFavori() {
  if (!session.user) {
    toast.add({ severity: 'warn', summary: 'Connexion requise', life: 2000 });
    return;
  }
  try {
    const etait = favoris.has(produit.value.id);
    await favoris.toggle(produit.value.id);
    toast.add({
      severity: 'success',
      summary: etait ? 'Retiré des favoris' : 'Ajouté aux favoris',
      life: 1500,
    });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}

async function publierAvis() {
  if (!session.user) {
    toast.add({ severity: 'warn', summary: 'Connexion requise', detail: 'Connectez-vous pour publier un avis.', life: 2200 });
    return;
  }
  if (session.user.role === 'seller') {
    toast.add({ severity: 'warn', summary: 'Action non autorisée', detail: 'Les producteurs ne peuvent pas publier d’avis.', life: 2200 });
    return;
  }
  postingAvis.value = true;
  try {
    await api.post(`/avis/produits/${route.params.id}`, {
      note: Number(note.value),
      commentaire: commentaire.value,
    });
    toast.add({ severity: 'success', summary: monAvis.value ? 'Avis mis à jour' : 'Avis publié', life: 1800 });
    await chargerAvis();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 2800 });
  } finally {
    postingAvis.value = false;
  }
}

onMounted(charger);
</script>

<template>
  <Button icon="pi pi-arrow-left" label="Retour au catalogue" text @click="router.push('/catalogue')" />

  <Message v-if="err" severity="error" :closable="false">{{ err }}</Message>

  <div v-if="produit" class="detail">
    <Card class="main">
      <template #title>
        <div class="title-row">
          <h1>{{ produit.nom }}</h1>
          <div class="tags">
            <Tag v-if="produit.bio" severity="success" value="Bio" icon="pi pi-leaf" />
            <Tag v-if="produit.est_saisonnier" severity="warn" value="Saisonnier" icon="pi pi-sun" />
            <Tag v-if="produit.stock === 0" severity="danger" value="Épuisé" />
            <Tag v-else-if="produit.stock < 5" severity="warn" :value="`Plus que ${produit.stock}`" />
          </div>
        </div>
      </template>
      <template #content>
        <img :src="produitImageUrl(produit, 800, 500)" :alt="produit.nom" class="hero" loading="lazy" referrerpolicy="no-referrer" />
        <p class="description">{{ produit.description || 'Aucune description.' }}</p>

        <dl class="meta">
          <dt>Nature</dt><dd>{{ natureLabel[produit.nature] }}</dd>
          <dt>Producteur</dt><dd>
            <RouterLink :to="`/entreprises/${produit.entreprise_id}`">{{ produit.entreprise_nom }}</RouterLink>
          </dd>
          <dt v-if="produit.est_saisonnier">Saison</dt>
          <dd v-if="produit.est_saisonnier">De {{ mois[produit.mois_debut - 1] }} à {{ mois[produit.mois_fin - 1] }}</dd>
          <dt>Expédition</dt><dd>{{ produit.shippable ? 'Possible' : 'Retrait uniquement' }}</dd>
          <dt v-if="produit.lieux?.length">Disponible en</dt>
          <dd v-if="produit.lieux?.length">
            <ul class="lieux">
              <li v-for="l in produit.lieux" :key="l.id">
                <i class="pi pi-map-marker" /> {{ l.nom }} <small>— {{ l.adresse }}</small>
              </li>
            </ul>
          </dd>
        </dl>
      </template>
    </Card>

    <Card class="achat">
      <template #content>
        <div class="prix">{{ formatPrix(produit.prix_cents) }}</div>
        <div v-if="canAjouterPanier" class="achat-row">
          <InputNumber v-model="quantite" :min="1" :max="Math.max(1, stockRestant)" show-buttons button-layout="horizontal" :disabled="stockRestant === 0" />
          <Button
            label="Ajouter au panier"
            icon="pi pi-shopping-cart"
            :disabled="stockRestant === 0"
            @click="ajouterPanier" />
        </div>
        <small v-if="canAjouterPanier" class="stock-info" :class="{ out: stockRestant === 0 }">
          <span v-if="stockRestant === 0">Stock déjà atteint dans votre panier</span>
          <span v-else>Encore {{ stockRestant }} disponible(s)</span>
        </small>
        <Button
          :label="favoris.has(produit.id) ? 'Retirer ce produit des favoris' : 'Ajouter ce produit aux favoris'"
          :icon="favoris.has(produit.id) ? 'pi pi-heart-fill' : 'pi pi-heart'"
          :severity="favoris.has(produit.id) ? 'danger' : 'secondary'"
          outlined
          @click="toggleFavori" />
        <Button
          v-if="isClient"
          label="Ajouter à une liste de courses"
          icon="pi pi-bookmark"
          severity="secondary"
          outlined
          @click="ouvrirPopoverListe" />
      </template>
    </Card>

    <Card class="avis-section">
      <template #title>
        <div class="avis-header">
          <h2>Avis</h2>
          <div class="rating-wrap">
            <Rating :modelValue="Number(avisStats.moyenne) || 0" :cancel="false" readonly />
            <strong>{{ (Number(avisStats.moyenne) || 0).toFixed(2) }}/5</strong>
            <small>({{ avisStats.nb_avis }} avis)</small>
          </div>
        </div>
      </template>
      <template #content>
        <div v-if="isClient" class="avis-form">
          <h3>{{ monAvis ? 'Modifier mon avis' : 'Laisser un avis' }}</h3>
          <Rating v-model="note" :cancel="false" />
          <Textarea v-model="commentaire" rows="3" placeholder="Votre commentaire (optionnel)" />
          <Button
            :label="monAvis ? 'Mettre à jour' : 'Publier'"
            icon="pi pi-send"
            :loading="postingAvis"
            @click="publierAvis" />
        </div>
        <Message v-else-if="session.user?.role === 'seller'" severity="info" :closable="false">
          Les producteurs ne peuvent pas publier d'avis.
        </Message>
        <Message v-else severity="info" :closable="false">
          Connectez-vous pour laisser un avis.
        </Message>

        <p v-if="avis.length === 0" class="muted">Pas encore d'avis pour ce produit.</p>
        <div v-else class="avis-list">
          <article v-for="a in avis" :key="a.id" class="avis-card">
            <div class="avis-top">
              <strong>{{ a.auteur }}</strong>
              <Rating :modelValue="a.note" :cancel="false" readonly />
            </div>
            <p class="muted avis-date">{{ new Date(a.created_at).toLocaleDateString('fr-FR') }}</p>
            <p v-if="a.commentaire">{{ a.commentaire }}</p>
          </article>
        </div>
      </template>
    </Card>
  </div>

  <Popover ref="listePopoverRef">
    <div class="liste-pop">
      <p class="liste-pop-title">Ajouter à une liste</p>
      <p v-if="listesChargement" class="liste-pop-hint">Chargement…</p>
      <template v-else>
        <button
          v-for="l in listesDisponibles"
          :key="l.id"
          class="liste-pop-item"
          @click="ajouterAListe(l.id)">
          <i class="pi pi-list" /> {{ l.nom }}
        </button>
        <p v-if="!listesDisponibles.length" class="liste-pop-hint">Aucune liste pour le moment.</p>
        <div class="liste-pop-new-row">
          <InputText v-model="nouveauNomListe" placeholder="Nouvelle liste…" @keyup.enter="creerEtAjouter" />
          <Button icon="pi pi-plus" severity="secondary" @click="creerEtAjouter" aria-label="Créer et ajouter" />
        </div>
      </template>
    </div>
  </Popover>
</template>

<style scoped>
.detail { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-top: 1rem; }
@media (max-width: 720px) { .detail { grid-template-columns: 1fr; } }
.title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
.title-row h1 { margin: 0; font-size: 1.8rem; }
.tags { display: flex; gap: .4rem; flex-wrap: wrap; }
.hero {
  width: 100%;
  max-height: 380px;
  object-fit: cover;
  border-radius: .5rem;
  margin-bottom: 1rem;
  background: var(--p-surface-100);
}
.description { font-size: 1rem; color: var(--p-text-color); line-height: 1.5; }
.meta { display: grid; grid-template-columns: auto 1fr; gap: .5rem 1.5rem; margin-top: 1rem; }
.meta dt { color: var(--p-text-muted-color); font-weight: 600; }
.meta dd { margin: 0; }
.lieux { list-style: none; padding: 0; margin: 0; }
.lieux li { padding: .2rem 0; }
.achat .prix { font-size: 2rem; font-weight: 700; color: var(--p-primary-color); margin-bottom: 1rem; }
.achat-row { display: flex; gap: .5rem; align-items: center; margin-bottom: 1rem; }
.stock-info { display: block; margin-bottom: 1rem; color: #166534; }
.stock-info.out { color: #b91c1c; }
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
.liste-pop-new-row { display: flex; gap: .35rem; margin-top: .4rem; }
.liste-pop-new-row :deep(.p-inputtext) { flex: 1; min-width: 0; }

.avis-section { grid-column: 1 / -1; }
.avis-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.avis-header h2 { margin: 0; font-size: 1.4rem; }
.rating-wrap { display: flex; align-items: center; gap: .5rem; }
.avis-form { display: flex; flex-direction: column; gap: .6rem; align-items: flex-start; margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--p-content-border-color); }
.avis-form h3 { margin: 0; font-size: 1rem; }
.avis-form :deep(.p-textarea) { width: 100%; }
.avis-list { display: grid; gap: .75rem; }
.avis-card { border: 1px solid var(--p-content-border-color); border-radius: .5rem; padding: .75rem; }
.avis-top { display: flex; justify-content: space-between; align-items: center; gap: .5rem; }
.avis-date { font-size: .85rem; margin: .25rem 0; }
.muted { color: var(--p-text-muted-color); }
</style>
