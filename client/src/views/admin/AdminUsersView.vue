<script setup>
import { onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { api } from '../../services/api.js';

const confirm = useConfirm();
const toast = useToast();
const users = ref([]);
const loading = ref(false);
const roles = [
  { label: 'Client', value: 'user' },
  { label: 'Producteur', value: 'seller' },
  { label: 'Admin', value: 'admin' },
];

async function charger() {
  loading.value = true;
  try { users.value = (await api.get('/admin/users')).data; }
  finally { loading.value = false; }
}

async function changerRole(u, role) {
  try {
    await api.patch(`/admin/users/${u.id}/role`, { role });
    u.role = role;
    toast.add({ severity: 'success', summary: 'Rôle mis à jour', life: 2000 });
  } catch (e) { toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 }); }
}

function supprimer(u) {
  confirm.require({
    message: `Anonymiser le compte ${u.email} ? Cette action est irréversible.`,
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.del(`/admin/users/${u.id}`);
        toast.add({ severity: 'success', summary: 'Compte anonymisé', life: 2000 });
        await charger();
      } catch (e) { toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 }); }
    },
  });
}

onMounted(charger);
</script>

<template>
  <h2>Utilisateurs</h2>
  <DataTable :value="users" :loading="loading" paginator :rows="20" striped-rows>
    <Column field="email" header="Email" :sortable="true" />
    <Column field="role" header="Rôle">
      <template #body="{ data }">
        <Select :model-value="data.role" :options="roles" option-label="label" option-value="value"
                :disabled="data.deleted_at != null"
                @update:model-value="(v) => changerRole(data, v)" />
      </template>
    </Column>
    <Column field="created_at" header="Créé le">
      <template #body="{ data }">{{ new Date(data.created_at).toLocaleDateString('fr-FR') }}</template>
    </Column>
    <Column field="last_login_at" header="Dernière connexion">
      <template #body="{ data }">{{ data.last_login_at ? new Date(data.last_login_at).toLocaleDateString('fr-FR') : '—' }}</template>
    </Column>
    <Column header="Statut">
      <template #body="{ data }">
        <Tag v-if="data.deleted_at" severity="danger" value="Supprimé" />
        <Tag v-else severity="success" value="Actif" />
      </template>
    </Column>
    <Column header="">
      <template #body="{ data }">
        <Button v-if="!data.deleted_at" icon="pi pi-trash" severity="danger" text @click="supprimer(data)" />
      </template>
    </Column>
  </DataTable>
</template>
