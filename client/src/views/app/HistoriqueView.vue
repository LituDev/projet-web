<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { api } from '../../services/api.js';

const commandes = ref([]);
const loading = ref(false);
const err = ref('');

const statutSeverity = {
  pending: 'warn', accepted: 'info', preparing: 'info',
  ready_for_pickup: 'success', shipped: 'info', delivered: 'success',
  refused: 'danger', cancelled: 'danger',
};

async function charger() {
  loading.value = true;
  try {
    const res = await api.get('/commandes');
    commandes.value = res.data;
  } catch (e) { err.value = e.message; }
  finally { loading.value = false; }
}

const formatPrix = (cents) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR');

onMounted(charger);
</script>

<template>
  <h2>Historique de commandes</h2>
  <Message v-if="err" severity="error" :closable="false">{{ err }}</Message>

  <DataTable :value="commandes" :loading="loading" paginator :rows="15" striped-rows>
    <Column field="date_commande" header="Date">
      <template #body="{ data }">{{ formatDate(data.date_commande) }}</template>
    </Column>
    <Column field="produits_apercu" header="Articles" />
    <Column field="mode_livraison" header="Mode" />
    <Column field="total_ttc_cents" header="Total">
      <template #body="{ data }">{{ formatPrix(data.total_ttc_cents) }}</template>
    </Column>
    <Column field="statut" header="Statut">
      <template #body="{ data }"><Tag :severity="statutSeverity[data.statut]" :value="data.statut" /></template>
    </Column>
    <Column header="">
      <template #body="{ data }">
        <RouterLink :to="`/commandes/${data.commande_id ?? data.id}`">
          <Button icon="pi pi-arrow-right" text />
        </RouterLink>
      </template>
    </Column>
  </DataTable>
</template>
