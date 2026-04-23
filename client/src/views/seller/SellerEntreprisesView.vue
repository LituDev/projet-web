<script setup>
import { onMounted, ref, reactive } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Message from 'primevue/message';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { api } from '../../services/api.js';
import { useSessionStore } from '../../stores/session.js';

const session = useSessionStore();
const confirm = useConfirm();
const toast = useToast();

const entreprises = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editing = ref(false);
const err = ref('');

const vide = () => ({ id: null, nom: '', siret: '', description: '' });
const form = reactive(vide());

async function charger() {
  loading.value = true;
  err.value = '';
  try {
    const res = await api.get('/entreprises');
    entreprises.value = res.data.filter((e) => e.owner_id === session.user.id);
  } catch (e) {
    err.value = e.message;
  } finally {
    loading.value = false;
  }
}

function ouvrirCreation() {
  Object.assign(form, vide());
  editing.value = false;
  dialogVisible.value = true;
}

function ouvrirEdition(e) {
  Object.assign(form, { id: e.id, nom: e.nom, siret: e.siret, description: e.description ?? '' });
  editing.value = true;
  dialogVisible.value = true;
}

async function sauver() {
  if (!form.nom.trim()) {
    toast.add({ severity: 'warn', summary: 'Champ requis', detail: 'Le nom est obligatoire.', life: 3000 });
    return;
  }
  if (!/^\d{14}$/.test(form.siret)) {
    toast.add({ severity: 'warn', summary: 'SIRET invalide', detail: 'Le SIRET doit contenir exactement 14 chiffres.', life: 3000 });
    return;
  }
  try {
    if (editing.value) {
      await api.patch(`/entreprises/${form.id}`, {
        nom: form.nom,
        siret: form.siret,
        description: form.description,
      });
      toast.add({ severity: 'success', summary: 'Entreprise modifiée', life: 2000 });
    } else {
      await api.post('/entreprises', {
        nom: form.nom,
        siret: form.siret,
        description: form.description,
      });
      toast.add({ severity: 'success', summary: 'Entreprise créée', life: 2000 });
    }
    dialogVisible.value = false;
    await charger();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 4000 });
  }
}

function supprimer(e) {
  confirm.require({
    message: `Supprimer l'entreprise "${e.nom}" ? Tous ses produits seront aussi supprimés.`,
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.del(`/entreprises/${e.id}`);
        toast.add({ severity: 'success', summary: 'Supprimée', life: 2000 });
        await charger();
      } catch (ex) {
        toast.add({ severity: 'error', summary: 'Erreur', detail: ex.message, life: 3000 });
      }
    },
  });
}

const formatDate = (d) => new Date(d).toLocaleDateString('fr-FR');

onMounted(charger);
</script>

<template>
  <header class="head">
    <h2>Mes entreprises</h2>
    <Button label="Ajouter une entreprise" icon="pi pi-plus" @click="ouvrirCreation" />
  </header>

  <Message v-if="err" severity="error" :closable="false">{{ err }}</Message>

  <Message v-if="!loading && entreprises.length === 0" severity="info" :closable="false">
    Vous n'avez pas encore d'entreprise. Créez-en une pour pouvoir ajouter des produits.
  </Message>

  <DataTable :value="entreprises" :loading="loading" striped-rows>
    <Column field="nom" header="Nom" :sortable="true" />
    <Column field="siret" header="SIRET" />
    <Column field="description" header="Description">
      <template #body="{ data }">
        <span class="desc">{{ data.description || '—' }}</span>
      </template>
    </Column>
    <Column field="created_at" header="Créée le" :sortable="true">
      <template #body="{ data }">{{ formatDate(data.created_at) }}</template>
    </Column>
    <Column header="Actions" style="width: 9rem">
      <template #body="{ data }">
        <Button icon="pi pi-pencil" text @click="ouvrirEdition(data)" aria-label="Modifier" />
        <Button icon="pi pi-trash" text severity="danger" @click="supprimer(data)" aria-label="Supprimer" />
      </template>
    </Column>
  </DataTable>

  <Dialog
    v-model:visible="dialogVisible"
    :header="editing ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'"
    modal
    style="width: 34rem"
  >
    <div class="form">
      <div class="field">
        <label>Nom <span class="req">*</span></label>
        <InputText v-model="form.nom" placeholder="Ex : Ferme du Soleil" />
      </div>
      <div class="field">
        <label>SIRET <span class="req">*</span></label>
        <InputText v-model="form.siret" placeholder="14 chiffres" maxlength="14" />
      </div>
      <div class="field">
        <label>Description</label>
        <Textarea v-model="form.description" rows="3" placeholder="Présentation de votre entreprise…" />
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
.form { display: flex; flex-direction: column; gap: .85rem; }
.field { display: flex; flex-direction: column; gap: .3rem; }
.req { color: var(--p-red-500); }
.desc { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 28ch; }
</style>
