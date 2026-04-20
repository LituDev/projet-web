<script setup>
import { onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { api } from '../../services/api.js';

const confirm = useConfirm();
const toast = useToast();
const commandes = ref([]);
const loading = ref(false);
const err = ref('');

const statutSeverity = {
  pending: 'warn', accepted: 'info', preparing: 'info',
  ready_for_pickup: 'success', shipped: 'info', delivered: 'success',
  refused: 'danger', cancelled: 'danger',
};
const modeLabel = { pickup_store: 'Lieu de vente', pickup_relay: 'Point relais', home_delivery: 'Livraison' };

async function charger() {
  loading.value = true;
  err.value = '';
  try {
    const res = await api.get('/commandes');
    commandes.value = res.data;
  } catch (e) { err.value = e.message; }
  finally { loading.value = false; }
}

async function patchStatut(commande, statut, label) {
  confirm.require({
    message: `Passer cette commande en "${label}" ?`,
    header: 'Confirmation',
    accept: async () => {
      try {
        await api.patch(`/commandes/${commande.id}`, { statut });
        toast.add({ severity: 'success', summary: 'Statut mis à jour', life: 2000 });
        await charger();
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
      }
    },
  });
}

const formatPrix = (cents) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR');

onMounted(charger);
</script>

<template>
  <h2>Commandes entrantes</h2>
  <Message v-if="err" severity="error" :closable="false">{{ err }}</Message>

  <DataTable :value="commandes" :loading="loading" paginator :rows="15" striped-rows>
    <Column field="date_commande" header="Date" :sortable="true">
      <template #body="{ data }">{{ formatDate(data.date_commande) }}</template>
    </Column>
    <Column field="id" header="Commande">
      <template #body="{ data }"><code>{{ data.id.slice(0, 8) }}…</code></template>
    </Column>
    <Column field="mode_livraison" header="Mode">
      <template #body="{ data }">{{ modeLabel[data.mode_livraison] }}</template>
    </Column>
    <Column field="total_ttc_cents" header="Total" :sortable="true">
      <template #body="{ data }">{{ formatPrix(data.total_ttc_cents) }}</template>
    </Column>
    <Column field="statut" header="Statut">
      <template #body="{ data }"><Tag :severity="statutSeverity[data.statut]" :value="data.statut" /></template>
    </Column>
    <Column header="Actions" style="width: 20rem">
      <template #body="{ data }">
        <div class="actions">
          <Button v-if="data.statut === 'pending'" icon="pi pi-check" label="Accepter" size="small" severity="success"
                  @click="patchStatut(data, 'accepted', 'acceptée')" />
          <Button v-if="data.statut === 'pending'" icon="pi pi-times" label="Refuser" size="small" severity="danger" outlined
                  @click="patchStatut(data, 'refused', 'refusée')" />
          <Button v-if="data.statut === 'accepted'" icon="pi pi-box" label="En préparation" size="small"
                  @click="patchStatut(data, 'preparing', 'en préparation')" />
          <Button v-if="data.statut === 'preparing' && data.mode_livraison === 'pickup_store'"
                  icon="pi pi-shop" label="Prête" size="small" severity="success"
                  @click="patchStatut(data, 'ready_for_pickup', 'prête à retirer')" />
          <Button v-if="data.statut === 'preparing' && data.mode_livraison !== 'pickup_store'"
                  icon="pi pi-truck" label="Expédier" size="small"
                  @click="patchStatut(data, 'shipped', 'expédiée')" />
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.actions { display: flex; gap: .4rem; flex-wrap: wrap; }
</style>
