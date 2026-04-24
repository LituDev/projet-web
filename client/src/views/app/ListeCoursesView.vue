<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Select from 'primevue/select';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';
import { api } from '../../services/api.js';
import { usePanierStore } from '../../stores/panier.js';

const toast = useToast();
const router = useRouter();
const panier = usePanierStore();

const listes = ref([]);
const listeActive = ref(null);
const nomListe = ref('');
const items = ref([]);
const loading = ref(false);
const err = ref('');
const trajet = ref(null);
const optimizing = ref(false);
let worker = null;
let nomDebounce = null;
const qtDebounces = {};

async function chargerListes() {
  listes.value = (await api.get('/liste-courses')).data;
  if (listes.value.length > 0 && !listeActive.value) {
    const first = listes.value[0];
    listeActive.value = first.id;
    nomListe.value = first.nom;
    await chargerItems();
  }
}

async function chargerItems() {
  if (!listeActive.value) return;
  loading.value = true;
  err.value = '';
  try {
    items.value = (await api.get(`/liste-courses/${listeActive.value}`)).items;
  } catch (e) { err.value = e.message; }
  finally { loading.value = false; }
}

async function changerListe() {
  const found = listes.value.find((l) => l.id === listeActive.value);
  nomListe.value = found?.nom ?? '';
  trajet.value = null;
  await chargerItems();
}

async function creerListe() {
  const { liste } = await api.post('/liste-courses', { nom: `Liste ${new Date().toLocaleDateString('fr-FR')}` });
  listes.value = [liste, ...listes.value];
  listeActive.value = liste.id;
  nomListe.value = liste.nom;
  items.value = [];
  trajet.value = null;
}

function onNomInput() {
  clearTimeout(nomDebounce);
  nomDebounce = setTimeout(sauvegarderNom, 700);
}

async function sauvegarderNom() {
  if (!listeActive.value || !nomListe.value.trim()) return;
  try {
    await api.patch(`/liste-courses/${listeActive.value}`, { nom: nomListe.value.trim() });
    const found = listes.value.find((l) => l.id === listeActive.value);
    if (found) found.nom = nomListe.value.trim();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}

function onQuantiteChange(produitId, quantite) {
  const nextQuantite = Number.isFinite(Number(quantite))
    ? Math.max(1, Math.min(99, Number(quantite)))
    : 1;
  const item = items.value.find((i) => i.produit_id === produitId);
  if (item) item.quantite = nextQuantite;
  clearTimeout(qtDebounces[produitId]);
  qtDebounces[produitId] = setTimeout(async () => {
    try {
      if (!listeActive.value) return;
      await api.patch(`/liste-courses/${listeActive.value}/items/${produitId}`, { quantite: nextQuantite });
    } catch (e) {
      toast.add({ severity: 'error', summary: 'Erreur quantité', detail: e.message, life: 3000 });
    }
  }, 500);
}

async function supprimerItem(produitId) {
  await api.del(`/liste-courses/${listeActive.value}/items/${produitId}`);
  items.value = items.value.filter((i) => i.produit_id !== produitId);
  trajet.value = null;
}

async function chargerDansLePanier() {
  if (!listeActive.value || items.value.length === 0) return;
  const results = panier.chargerDepuisListe(items.value);
  const limites = results.filter((r) => r.quantiteAjoutee < r.quantiteDemandee);
  if (limites.length > 0) {
    toast.add({
      severity: 'warn',
      summary: 'Stock limité',
      detail: limites.map((r) => `${r.nom} : ${r.quantiteAjoutee}/${r.quantiteDemandee}`).join(', '),
      life: 5000,
    });
  } else {
    toast.add({ severity: 'success', summary: 'Panier mis à jour', detail: `${results.length} produit(s) ajouté(s)`, life: 2500 });
  }
  router.push('/panier');
}

async function supprimerListe() {
  if (!listeActive.value) return;
  await api.del(`/liste-courses/${listeActive.value}`);
  listes.value = listes.value.filter((l) => l.id !== listeActive.value);
  listeActive.value = null;
  nomListe.value = '';
  items.value = [];
  trajet.value = null;
  toast.add({ severity: 'info', summary: 'Liste supprimée', life: 2000 });
  if (listes.value.length > 0) {
    listeActive.value = listes.value[0].id;
    nomListe.value = listes.value[0].nom;
    await chargerItems();
  }
}

function optimiser() {
  const points = items.value
    .filter((i) => i.lieu_lat != null && i.lieu_lon != null)
    .map((i) => ({ id: i.lieu_id, nom: i.lieu_nom, lat: i.lieu_lat, lon: i.lieu_lon }));
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
  const [depart, ...etapes] = unique;
  worker.postMessage({ depart, etapes });
}

const totalCents = computed(() => items.value.reduce((n, i) => n + i.quantite * i.prix_cents, 0));
const formatPrix = (cents) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

onMounted(chargerListes);
onUnmounted(() => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  clearTimeout(nomDebounce);
  for (const id of Object.keys(qtDebounces)) {
    clearTimeout(qtDebounces[id]);
  }
});
</script>

<template>
  <header class="head">
    <h2>Listes de courses</h2>
    <div class="ctl">
      <Select
        v-model="listeActive"
        :options="listes"
        option-label="nom"
        option-value="id"
        placeholder="Choisir une liste…"
        @change="changerListe" />
      <Button icon="pi pi-plus" label="Nouvelle liste" text @click="creerListe" />
    </div>
  </header>

  <Message v-if="err" severity="error" :closable="false">{{ err }}</Message>
  <Message v-if="!loading && listes.length === 0" severity="info" :closable="false">
    Aucune liste. Créez votre première liste, puis ajoutez des produits depuis la page d'un produit.
  </Message>

  <template v-if="listeActive">
    <div class="toolbar">
      <div class="nom-field">
        <label for="nom-liste">Nom de la liste</label>
        <InputText
          id="nom-liste"
          v-model="nomListe"
          placeholder="Nom de la liste"
          @input="onNomInput"
          @blur="sauvegarderNom" />
      </div>
      <div class="toolbar-actions">
        <Button
          v-if="items.length > 0"
          icon="pi pi-shopping-cart"
          label="Charger dans le panier"
          @click="chargerDansLePanier" />
        <Button
          icon="pi pi-trash"
          severity="danger"
          outlined
          label="Supprimer la liste"
          @click="supprimerListe" />
      </div>
    </div>

    <DataTable :value="items" :loading="loading" striped-rows>
      <template #empty>
        <p class="empty">Aucun produit dans cette liste. Ajoutez-en depuis la page d'un produit.</p>
      </template>
      <Column field="nom" header="Produit" />
      <Column field="entreprise_nom" header="Producteur" />
      <Column field="lieu_nom" header="Lieu de retrait" />
      <Column header="Quantité" style="width: 11rem">
        <template #body="{ data }">
          <InputNumber
            :model-value="data.quantite"
            :min="1"
            :max="99"
            show-buttons
            button-layout="horizontal"
            @update:model-value="(v) => onQuantiteChange(data.produit_id, v)" />
        </template>
      </Column>
      <Column header="Prix">
        <template #body="{ data }">{{ formatPrix(data.quantite * data.prix_cents) }}</template>
      </Column>
      <Column header="" style="width: 3.5rem">
        <template #body="{ data }">
          <Button icon="pi pi-trash" text severity="danger" @click="supprimerItem(data.produit_id)" />
        </template>
      </Column>
    </DataTable>

    <div v-if="items.length > 0" class="totaux">
      <span>Estimation totale</span>
      <strong>{{ formatPrix(totalCents) }}</strong>
    </div>

    <Card v-if="items.length > 1" class="opt">
      <template #title>Trajet optimisé</template>
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
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap; }
.ctl { display: flex; gap: .5rem; align-items: center; }
.toolbar { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
.nom-field { display: flex; flex-direction: column; gap: .3rem; }
.nom-field label { font-size: .85rem; color: var(--p-text-muted-color); }
.toolbar-actions { display: flex; gap: .5rem; align-items: center; }
.empty { text-align: center; padding: 2rem; color: var(--p-text-muted-color); margin: 0; }
.totaux { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1rem; font-size: 1.05rem; align-items: center; }
.opt { margin-top: 1.5rem; }
.opt-body { margin-top: 1rem; }
.opt-body ol { margin: .5rem 0 0 1.2rem; }
</style>
