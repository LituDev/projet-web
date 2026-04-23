<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { api } from '../services/api.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const commande = ref(null);
const err = ref('');
const cancelling = ref(false);

const formatPrix = (cents) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const formatDate = (iso) => new Date(iso).toLocaleString('fr-FR');

const modeLabel = { pickup_store: 'Retrait en lieu de vente', pickup_relay: 'Point relais', home_delivery: 'Livraison à domicile' };
const statutSeverity = { pending: 'warn', accepted: 'info', preparing: 'info', ready_for_pickup: 'success', shipped: 'info', delivered: 'success', refused: 'danger', cancelled: 'danger' };

function canCancel(c) {
  if (!c) return false;
  return c.statut !== 'delivered' && c.statut !== 'cancelled' && c.statut !== 'refused';
}

async function annulerCommande() {
  if (!commande.value || !canCancel(commande.value)) return;
  cancelling.value = true;
  try {
    const res = await api.post(`/commandes/${commande.value.id}/cancel`, {});
    commande.value.statut = res.commande.statut;
    toast.add({ severity: 'success', summary: 'Commande annulée', life: 2500 });
    router.push('/app/historique');
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Annulation impossible', detail: e.message, life: 3500 });
  } finally {
    cancelling.value = false;
  }
}

onMounted(async () => {
  try {
    const res = await api.get(`/commandes/${route.params.id}`);
    commande.value = res.commande;
  } catch (e) { err.value = e.message; }
});
</script>

<template>
  <RouterLink to="/app/historique"><Button label="Mes commandes" icon="pi pi-arrow-left" text /></RouterLink>
  <h2>Commande</h2>

  <Message v-if="err" severity="error" :closable="false">{{ err }}</Message>

  <template v-if="commande">
    <Card class="section">
      <template #title>
        <span>Commande du {{ formatDate(commande.date_commande) }}</span>
        <Tag :severity="statutSeverity[commande.statut]" :value="commande.statut" class="ml" />
      </template>
      <template #content>
        <p><strong>Mode :</strong> {{ modeLabel[commande.mode_livraison] }}</p>
        <p><strong>Paiement :</strong> {{ commande.paiement_statut ?? 'en attente' }} ({{ commande.paiement_methode ?? '—' }})</p>
        <div v-if="canCancel(commande)" class="actions">
          <Button
            label="Annuler la commande"
            icon="pi pi-times"
            severity="danger"
            outlined
            :loading="cancelling"
            @click="annulerCommande" />
        </div>

        <h4>Articles</h4>
        <ul class="lignes">
          <li v-for="l in commande.lignes" :key="l.produit_id">
            <span>{{ l.quantite }} × {{ l.nom }}</span>
            <span>{{ formatPrix(l.quantite * l.prix_unitaire_cents) }}</span>
          </li>
        </ul>

        <div class="totaux">
          <div><span>Produits</span><span>{{ formatPrix(commande.total_produits_cents) }}</span></div>
          <div><span>Frais de port</span><span>{{ formatPrix(commande.frais_port_cents) }}</span></div>
          <div class="total"><strong>Total TTC</strong><strong>{{ formatPrix(commande.total_ttc_cents) }}</strong></div>
        </div>
      </template>
    </Card>
  </template>
</template>

<style scoped>
.section { margin-bottom: 1rem; }
.ml { margin-left: .5rem; }
.actions { margin: .8rem 0 1rem; }
.lignes { list-style: none; padding: 0; margin: .5rem 0 1rem; }
.lignes li { display: flex; justify-content: space-between; padding: .3rem 0; border-bottom: 1px solid var(--p-content-border-color); }
.totaux { display: flex; flex-direction: column; gap: .3rem; margin-top: 1rem; max-width: 20rem; margin-left: auto; }
.totaux div { display: flex; justify-content: space-between; }
.totaux .total { border-top: 1px solid var(--p-content-border-color); padding-top: .3rem; font-size: 1.1rem; }
</style>
