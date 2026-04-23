<script setup>
import { onMounted, ref, reactive } from 'vue';
import { RouterLink } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import Checkbox from 'primevue/checkbox';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { api } from '../../services/api.js';
import { useSessionStore } from '../../stores/session.js';

const session = useSessionStore();
const confirm = useConfirm();
const toast = useToast();

const produits = ref([]);
const mesEntreprises = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editing = ref(false);
const err = ref('');

const natures = [
  { label: 'Légume', value: 'legume' },
  { label: 'Fruit', value: 'fruit' },
  { label: 'Viande', value: 'viande' },
  { label: 'Fromage', value: 'fromage' },
  { label: 'Épicerie', value: 'epicerie' },
  { label: 'Boisson', value: 'boisson' },
  { label: 'Autre', value: 'autre' },
];
const visibilites = [
  { label: 'Visible', value: 'visible' },
  { label: 'Masqué', value: 'hidden' },
  { label: 'Hors stock', value: 'out_of_stock' },
];

const vide = () => ({
  id: null,
  entreprise_id: null,
  nom: '', description: '', nature: 'legume',
  bio: false, prix_cents: 0, stock: 0,
  shippable: false, visibilite: 'visible',
  est_saisonnier: false, mois_debut: null, mois_fin: null,
});
const form = reactive(vide());

async function charger() {
  loading.value = true;
  try {
    const ent = await api.get('/entreprises');
    mesEntreprises.value = ent.data.filter((e) => e.owner_id === session.user.id);
    const res = await api.get('/produits?limit=100');
    // Vue publique : on filtre côté client sur celles de nos entreprises
    const myIds = new Set(mesEntreprises.value.map((e) => e.id));
    produits.value = res.data.filter((p) => myIds.has(p.entreprise_id));
  } catch (e) { err.value = e.message; }
  finally { loading.value = false; }
}

function ouvrirCreation() {
  Object.assign(form, vide());
  if (mesEntreprises.value.length === 1) form.entreprise_id = mesEntreprises.value[0].id;
  editing.value = false;
  dialogVisible.value = true;
}

async function ouvrirEdition(p) {
  try {
    const res = await api.get(`/produits/${p.id}`);
    Object.assign(form, {
      id: res.produit.id,
      entreprise_id: res.produit.entreprise_id,
      nom: res.produit.nom,
      description: res.produit.description,
      nature: res.produit.nature,
      bio: res.produit.bio,
      prix_cents: res.produit.prix_cents,
      stock: res.produit.stock,
      shippable: res.produit.shippable,
      visibilite: res.produit.visibilite,
      est_saisonnier: res.produit.est_saisonnier,
      mois_debut: res.produit.mois_debut ?? null,
      mois_fin: res.produit.mois_fin ?? null,
    });
    editing.value = true;
    dialogVisible.value = true;
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}

async function sauver() {
  try {
    if (editing.value) {
      await api.patch(`/produits/${form.id}`, {
        nom: form.nom, description: form.description, nature: form.nature, bio: form.bio,
        prix_cents: form.prix_cents, stock: form.stock, shippable: form.shippable,
        visibilite: form.visibilite,
      });
    } else {
      await api.post('/produits', {
        entreprise_id: form.entreprise_id, nom: form.nom, description: form.description,
        nature: form.nature, bio: form.bio, prix_cents: form.prix_cents, stock: form.stock,
        shippable: form.shippable, visibilite: form.visibilite,
        est_saisonnier: form.est_saisonnier,
        mois_debut: form.mois_debut, mois_fin: form.mois_fin,
        lieu_ids: [],
      });
    }
    dialogVisible.value = false;
    toast.add({ severity: 'success', summary: 'Enregistré', life: 2000 });
    await charger();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 4000 });
  }
}

function supprimer(p) {
  confirm.require({
    message: `Supprimer "${p.nom}" ?`,
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.del(`/produits/${p.id}`);
        toast.add({ severity: 'success', summary: 'Supprimé', life: 2000 });
        await charger();
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
      }
    },
  });
}

const formatPrix = (cents) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

onMounted(charger);
</script>

<template>
  <header class="head">
    <h2>Mes produits</h2>
    <Button label="Ajouter" icon="pi pi-plus" @click="ouvrirCreation" :disabled="mesEntreprises.length === 0" />
  </header>

  <Message v-if="err" severity="error" :closable="false">{{ err }}</Message>

  <Message v-if="!loading && mesEntreprises.length === 0" severity="warn" :closable="false">
    Vous devez d'abord créer une entreprise avant de pouvoir ajouter des produits.
    <RouterLink to="/seller/entreprises">Créer une entreprise</RouterLink>
  </Message>

  <DataTable :value="produits" :loading="loading" paginator :rows="15" striped-rows>
    <Column field="nom" header="Nom" :sortable="true" />
    <Column field="nature" header="Nature" />
    <Column field="prix_cents" header="Prix" :sortable="true">
      <template #body="{ data }">{{ formatPrix(data.prix_cents) }}</template>
    </Column>
    <Column field="stock" header="Stock" :sortable="true" />
    <Column field="bio" header="Bio">
      <template #body="{ data }"><Tag v-if="data.bio" severity="success" value="Bio" /></template>
    </Column>
    <Column header="Actions" style="width: 9rem">
      <template #body="{ data }">
        <Button icon="pi pi-pencil" text @click="ouvrirEdition(data)" aria-label="Modifier" />
        <Button icon="pi pi-trash" text severity="danger" @click="supprimer(data)" aria-label="Supprimer" />
      </template>
    </Column>
  </DataTable>

  <Dialog v-model:visible="dialogVisible" :header="editing ? 'Modifier le produit' : 'Nouveau produit'" modal style="width: 36rem">
    <div class="form">
      <div v-if="!editing" class="field">
        <label>Entreprise</label>
        <Select v-model="form.entreprise_id" :options="mesEntreprises" option-label="nom" option-value="id" placeholder="Choisir…" />
      </div>
      <div class="field">
        <label>Nom</label>
        <InputText v-model="form.nom" />
      </div>
      <div class="field">
        <label>Description</label>
        <Textarea v-model="form.description" rows="2" />
      </div>
      <div class="row">
        <div class="field">
          <label>Nature</label>
          <Select v-model="form.nature" :options="natures" option-label="label" option-value="value" />
        </div>
        <div class="field">
          <label>Visibilité</label>
          <Select v-model="form.visibilite" :options="visibilites" option-label="label" option-value="value" />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>Prix (centimes)</label>
          <InputNumber v-model="form.prix_cents" :min="0" />
        </div>
        <div class="field">
          <label>Stock</label>
          <InputNumber v-model="form.stock" :min="0" />
        </div>
      </div>
      <div class="checks">
        <label><Checkbox v-model="form.bio" :binary="true" /> Bio</label>
        <label><Checkbox v-model="form.shippable" :binary="true" /> Expédiable</label>
        <label v-if="!editing"><Checkbox v-model="form.est_saisonnier" :binary="true" /> Saisonnier</label>
      </div>
      <div v-if="!editing && form.est_saisonnier" class="row">
        <div class="field">
          <label>Mois début (1-12)</label>
          <InputNumber v-model="form.mois_debut" :min="1" :max="12" />
        </div>
        <div class="field">
          <label>Mois fin (1-12)</label>
          <InputNumber v-model="form.mois_fin" :min="1" :max="12" />
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Annuler" text @click="dialogVisible = false" />
      <Button label="Enregistrer" icon="pi pi-check" @click="sauver" />
    </template>
  </Dialog>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.form { display: flex; flex-direction: column; gap: .8rem; }
.field { display: flex; flex-direction: column; gap: .3rem; flex: 1; }
.row { display: flex; gap: .75rem; }
.checks { display: flex; gap: 1rem; }
.checks label { display: inline-flex; align-items: center; gap: .35rem; }
</style>
