<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputNumber from 'primevue/inputnumber';
import Message from 'primevue/message';
import { usePanierStore } from '../stores/panier.js';
import { useSessionStore } from '../stores/session.js';

const panier = usePanierStore();
const session = useSessionStore();
const router = useRouter();

const formatPrix = (cents) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

const total = computed(() => panier.totalCents);

function passerCommande() {
  if (!session.user) {
    router.push({ name: 'connexion', query: { redirect: '/checkout' } });
    return;
  }
  router.push('/checkout');
}
</script>

<template>
  <h2>Mon panier</h2>

  <Message v-if="panier.lignes.length === 0" severity="info" :closable="false">
    Votre panier est vide. <RouterLink to="/catalogue">Explorer le catalogue</RouterLink>.
  </Message>

  <Card v-else>
    <template #content>
      <DataTable :value="panier.lignes" data-key="produit_id">
        <Column field="nom" header="Produit" />
        <Column field="entreprise_nom" header="Producteur" />
        <Column header="Quantité" style="width: 10rem">
          <template #body="{ data }">
            <InputNumber
              v-model="data.quantite"
              show-buttons
              :min="1"
              :max="Number.isFinite(Number(data.stock)) ? Number(data.stock) : 99"
              button-layout="horizontal"
              @update:model-value="(value) => panier.setQuantite(data.produit_id, value)" />
            <small v-if="Number.isFinite(Number(data.stock))" class="stock-note">Stock max: {{ data.stock }}</small>
          </template>
        </Column>
        <Column header="Prix" style="width: 8rem">
          <template #body="{ data }">{{ formatPrix(data.prix_cents * data.quantite) }}</template>
        </Column>
        <Column header="" style="width: 5rem">
          <template #body="{ data }">
            <Button icon="pi pi-trash" severity="danger" text @click="panier.retirer(data.produit_id)" />
          </template>
        </Column>
      </DataTable>

      <div class="totaux">
        <span>Total articles :</span>
        <strong>{{ formatPrix(total) }}</strong>
      </div>

      <div class="actions">
        <Button label="Vider" icon="pi pi-times" severity="secondary" text @click="panier.vider()" />
        <Button label="Passer commande" icon="pi pi-arrow-right" icon-pos="right" @click="passerCommande" />
      </div>
    </template>
  </Card>
</template>

<style scoped>
.totaux {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
  font-size: 1.1rem;
}
.actions {
  display: flex;
  justify-content: space-between;
  margin-top: 1.5rem;
}
.stock-note {
  display: block;
  margin-top: .3rem;
  color: var(--p-text-muted-color);
}
</style>
