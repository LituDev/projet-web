<script setup>
import { onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { api } from '../../services/api.js';

const rows = ref([]);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try { rows.value = (await api.get('/admin/audit')).data; }
  finally { loading.value = false; }
});
</script>

<template>
  <h2>Journal d'audit</h2>
  <DataTable :value="rows" :loading="loading" paginator :rows="30" striped-rows>
    <Column field="created_at" header="Date">
      <template #body="{ data }">{{ new Date(data.created_at).toLocaleString('fr-FR') }}</template>
    </Column>
    <Column field="actor_email" header="Acteur" />
    <Column field="action" header="Action" />
    <Column field="target_type" header="Cible" />
    <Column field="target_id" header="ID">
      <template #body="{ data }"><code>{{ data.target_id?.slice(0, 12) }}…</code></template>
    </Column>
    <Column field="ip" header="IP" />
  </DataTable>
</template>
