<script setup>
import { onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { api } from '../../services/api.js';

const toast = useToast();
const alertes = ref([]);
const loading = ref(false);
const sev = { open: 'warn', in_progress: 'info', closed: 'success' };

async function charger() {
  loading.value = true;
  try { alertes.value = (await api.get('/alertes')).data; }
  finally { loading.value = false; }
}

async function patch(a, statut) {
  try {
    await api.patch(`/alertes/${a.id}`, { statut });
    toast.add({ severity: 'success', summary: 'Statut mis à jour', life: 2000 });
    await charger();
  } catch (e) { toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 }); }
}

onMounted(charger);
</script>

<template>
  <h2>Alertes</h2>
  <DataTable :value="alertes" :loading="loading" paginator :rows="20" striped-rows>
    <Column field="created_at" header="Date">
      <template #body="{ data }">{{ new Date(data.created_at).toLocaleDateString('fr-FR') }}</template>
    </Column>
    <Column field="type" header="Type" />
    <Column field="emetteur_email" header="Émetteur" />
    <Column field="description" header="Description" />
    <Column field="statut" header="Statut">
      <template #body="{ data }"><Tag :severity="sev[data.statut]" :value="data.statut" /></template>
    </Column>
    <Column header="" style="width: 14rem">
      <template #body="{ data }">
        <Button v-if="data.statut === 'open'" icon="pi pi-play" label="Prendre" size="small" @click="patch(data, 'in_progress')" />
        <Button v-if="data.statut !== 'closed'" icon="pi pi-check" label="Clore" size="small" severity="success" @click="patch(data, 'closed')" />
      </template>
    </Column>
  </DataTable>
</template>
