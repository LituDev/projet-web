<script setup>
import { onMounted, ref, reactive } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { api } from '../../services/api.js';

const toast = useToast();
const alertes = ref([]);
const form = reactive({ type: 'autre', description: '' });
const types = [
  { label: 'Produit', value: 'produit' },
  { label: 'Commande', value: 'commande' },
  { label: 'Lieu de vente', value: 'lieu_de_vente' },
  { label: 'Autre', value: 'autre' },
];
const sev = { open: 'warn', in_progress: 'info', closed: 'success' };

async function charger() { alertes.value = (await api.get('/alertes/mine')).data; }

async function submit() {
  try {
    await api.post('/alertes', { type: form.type, description: form.description });
    toast.add({ severity: 'success', summary: 'Alerte envoyée', detail: 'Les administrateurs vont la traiter.', life: 3000 });
    form.description = '';
    await charger();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}

onMounted(charger);
</script>

<template>
  <h2>Signaler un dysfonctionnement</h2>

  <Card class="section">
    <template #title>Nouvelle alerte</template>
    <template #content>
      <div class="form">
        <div class="field">
          <label>Type</label>
          <Select v-model="form.type" :options="types" option-label="label" option-value="value" />
        </div>
        <div class="field">
          <label>Description</label>
          <Textarea v-model="form.description" rows="4" placeholder="Décrivez le problème rencontré…" />
        </div>
        <Button label="Envoyer" icon="pi pi-send" :disabled="form.description.length < 5" @click="submit" />
      </div>
    </template>
  </Card>

  <Card class="section">
    <template #title>Mes alertes</template>
    <template #content>
      <Message v-if="alertes.length === 0" severity="info" :closable="false">Aucune alerte envoyée.</Message>
      <DataTable v-else :value="alertes" striped-rows>
        <Column field="type" header="Type" />
        <Column field="description" header="Description" />
        <Column field="statut" header="Statut">
          <template #body="{ data }"><Tag :severity="sev[data.statut]" :value="data.statut" /></template>
        </Column>
        <Column field="created_at" header="Envoyée le">
          <template #body="{ data }">{{ new Date(data.created_at).toLocaleDateString('fr-FR') }}</template>
        </Column>
      </DataTable>
    </template>
  </Card>
</template>

<style scoped>
.section { margin-bottom: 1rem; }
.form { display: flex; flex-direction: column; gap: 1rem; max-width: 40rem; }
.field { display: flex; flex-direction: column; gap: .3rem; }
</style>
