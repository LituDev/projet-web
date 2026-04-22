<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import InputNumber from 'primevue/inputnumber';
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

async function charger() {
  loading.value = true;
  err.value = '';
  try {
    const res = await api.get(`/produits/${route.params.id}`);
    produit.value = res.produit;
  } catch (e) { err.value = e.message; }
  finally { loading.value = false; }
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
    const etait = favoris.has(produit.value.entreprise_id);
    await favoris.toggle(produit.value.entreprise_id);
    toast.add({
      severity: 'success',
      summary: etait ? 'Retiré des favoris' : 'Ajouté aux favoris',
      life: 1500,
    });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
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
        <div class="achat-row">
          <InputNumber v-model="quantite" :min="1" :max="Math.max(1, stockRestant)" show-buttons button-layout="horizontal" :disabled="stockRestant === 0" />
          <Button
            label="Ajouter au panier"
            icon="pi pi-shopping-cart"
            :disabled="stockRestant === 0"
            @click="ajouterPanier" />
        </div>
        <small class="stock-info" :class="{ out: stockRestant === 0 }">
          <span v-if="stockRestant === 0">Stock déjà atteint dans votre panier</span>
          <span v-else>Encore {{ stockRestant }} disponible(s)</span>
        </small>
        <Button
          :label="favoris.has(produit.entreprise_id) ? 'Retirer le producteur des favoris' : 'Ajouter le producteur aux favoris'"
          :icon="favoris.has(produit.entreprise_id) ? 'pi pi-heart-fill' : 'pi pi-heart'"
          :severity="favoris.has(produit.entreprise_id) ? 'danger' : 'secondary'"
          outlined
          @click="toggleFavori" />
      </template>
    </Card>
  </div>
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
</style>
