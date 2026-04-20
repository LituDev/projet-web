<script setup>
import Card from 'primevue/card';
import Button from 'primevue/button';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';
import { api } from '../../services/api.js';
import { useSessionStore } from '../../stores/session.js';

const session = useSessionStore();
const confirm = useConfirm();
const toast = useToast();
const router = useRouter();

function supprimerCompte() {
  confirm.require({
    header: 'Supprimer mon compte',
    message: "Cette action est irréversible. Votre email sera anonymisé et vous ne pourrez plus vous reconnecter. Confirmer ?",
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer définitivement',
    rejectLabel: 'Annuler',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.del('/auth/me');
        session.user = null;
        toast.add({ severity: 'info', summary: 'Compte supprimé', life: 3000 });
        router.push('/');
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
      }
    },
  });
}
</script>

<template>
  <h2>Mon compte</h2>

  <Card v-if="session.user" class="section">
    <template #title>Informations</template>
    <template #content>
      <p><strong>Email :</strong> {{ session.user.email }}</p>
      <p><strong>Rôle :</strong> {{ session.user.role }}</p>
    </template>
  </Card>

  <Card class="danger-zone">
    <template #title><span class="danger-title">Zone dangereuse</span></template>
    <template #content>
      <p>La suppression de votre compte est définitive. Vos commandes passées restent dans l'historique des producteurs mais votre email est anonymisé.</p>
      <Button label="Supprimer mon compte" icon="pi pi-trash" severity="danger" outlined @click="supprimerCompte" />
    </template>
  </Card>
</template>

<style scoped>
.section { margin-bottom: 1rem; }
.danger-zone { border: 1px solid var(--p-red-200); }
.danger-title { color: var(--p-red-600); }
</style>
