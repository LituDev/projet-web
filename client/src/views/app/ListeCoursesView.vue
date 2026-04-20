<script setup>
import { onMounted, ref, computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Select from 'primevue/select';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import { api } from '../../services/api.js';

const toast = useToast();

const listes = ref([]);
const listeActive = ref(null);
const items = ref([]);
const loading = ref(false);
const err = ref('');

const trajet = ref(null);
const optimizing = ref(false);
let worker = null;

async function chargerListes() {
  listes.value = (await api.get('/liste-courses')).data;
  if (listes.value.length > 0 && !listeActive.value) {
    listeActive.value = listes.value[0].id;
    await chargerItems();
  }
}
async function chargerItems() {
  if (!listeActive.value) return;
  loading.value = true;
  err.value = '';
  try { items.value = (await api.get(`/liste-courses/${listeActive.value}`)).items; }
  catch (e) { err.value = e.message; }
  finally { loading.value = false; }
}
async function creerListe() {
  const { liste } = await api.post('/liste-courses', { nom: `Liste ${new Date().toLocaleDateString('fr-FR')}` });
  await chargerListes();
  listeActive.value = liste.id;
  await chargerItems();
}
async function supprimerItem(produitId) {
  await api.del(`/liste-courses/${listeActive.value}/items/${produitId}`);
  await chargerItems();
  trajet.value = null;
}

function optimiser() {
  const points = items.value
    .filter((i) => i.lieu_lat != null && i.lieu_lon != null)
    .map((i) => ({ id: i.lieu_id, nom: i.lieu_nom, lat: i.lieu_lat, lon: i.lieu_lon }));
  // Dédoublonnage par lieu (inutile de repasser au même lieu deux fois)
  const unique = [...new Map(points.map((p) => [p.id, p])).values()];
  if (unique.length < 2) {
    toast.add({ severity: 'warn', summary: 'Pas assez de points', detail: 'Il faut au moins 2 lieux distincts.', life: 3000 });
    return;
  }
  optimizing.value = true;
  worker = new Worker(new URL('../../workers/trajet.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    trajet.value = e.data;
    optimizing.value = false;
    worker.terminate();
    toast.add({ severity: 'success', summary: 'Trajet optimisé', detail: `${(e.data.distance_m / 1000).toFixed(1)} km`, life: 3000 });
  };
  // Départ arbitraire : premier point (en vrai on utiliserait la position du client)
  const [depart, ...etapes] = unique;
  worker.postMessage({ depart, etapes });
}

const totalCents = computed(() => items.value.reduce((n, i) => n + i.quantite * i.prix_cents, 0));
const formatPrix = (cents) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

onMounted(chargerListes);
</script>

<template>
  <header class="head">
    <h2>Liste de courses</h2>
    <div class="ctl">
      <Select v-model="listeActive" :options="listes" option-label="nom" option-value="id" placeholder="Choisir une liste…" @change="chargerItems" />
      <Button icon="pi pi-plus" label="Nouvelle liste" text @click="creerListe" />
    </div>
  </header>

  <Message v-if="err" severity="error" :closable="false">{{ err }}</Message>
  <Message v-if="!loading && listes.length === 0" severity="info" :closable="false">
    Aucune liste. Créez votre première liste, puis ajoutez des produits depuis le catalogue.
  </Message>

  <DataTable v-if="listeActive" :value="items" :loading="loading" striped-rows>
    <Column field="nom" header="Produit" />
    <Column field="lieu_nom" header="Lieu de retrait" />
    <Column field="quantite" header="Qté" />
    <Column header="Prix">
      <template #body="{ data }">{{ formatPrix(data.quantite * data.prix_cents) }}</template>
    </Column>
    <Column header="">
      <template #body="{ data }">
        <Button icon="pi pi-trash" text severity="danger" @click="supprimerItem(data.produit_id)" />
      </template>
    </Column>
  </DataTable>

  <div v-if="items.length > 0" class="totaux">
    <span>Estimation</span>
    <strong>{{ formatPrix(totalCents) }}</strong>
  </div>

  <Card v-if="items.length > 1" class="opt">
    <template #title>Trajet optimisé (Web Worker)</template>
    <template #content>
      <Button label="Calculer l'itinéraire" icon="pi pi-compass" :loading="optimizing" @click="optimiser" />
      <div v-if="optimizing" class="opt-body"><ProgressSpinner style="width: 2rem" /></div>
      <div v-else-if="trajet" class="opt-body">
        <p>Distance totale : <strong>{{ (trajet.distance_m / 1000).toFixed(1) }} km</strong> <small>({{ trajet.algo }})</small></p>
        <ol>
          <li v-for="p in trajet.ordre" :key="p.id">{{ p.nom }}</li>
        </ol>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap; }
.ctl { display: flex; gap: .5rem; align-items: center; }
.totaux { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; }
.opt { margin-top: 1.5rem; }
.opt-body { margin-top: 1rem; }
.opt-body ol { margin: .5rem 0 0 1.2rem; }
</style>
