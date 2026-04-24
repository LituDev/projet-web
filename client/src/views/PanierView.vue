<script setup>
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Select from 'primevue/select';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputNumber from 'primevue/inputnumber';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { usePanierStore } from '../stores/panier.js';
import { useSessionStore } from '../stores/session.js';
import { api } from '../services/api.js';

const panier = usePanierStore();
const session = useSessionStore();
const router = useRouter();
const toast = useToast();

const listes = ref([]);
const listeSelectionnee = ref(null);
const chargementListe = ref(false);

onMounted(async () => {
  if (session.user && session.user.role !== 'seller') {
    try {
      const res = await api.get('/liste-courses');
      listes.value = res.data;
    } catch {
      // Non bloquant: le panier reste utilisable même si les listes échouent à charger.
    }
  }
});

async function chargerListe() {
  if (!listeSelectionnee.value) return;
  chargementListe.value = true;
  try {
    const res = await api.get(`/liste-courses/${listeSelectionnee.value}`);
    const results = panier.chargerDepuisListe(res.items);
    const limites = results.filter((r) => r.quantiteAjoutee < r.quantiteDemandee);
    if (limites.length > 0) {
      toast.add({
        severity: 'warn',
        summary: 'Stock limité',
        detail: limites.map((r) => `${r.nom} : ${r.quantiteAjoutee}/${r.quantiteDemandee}`).join(', '),
        life: 5000,
      });
    } else {
      toast.add({ severity: 'success', summary: 'Panier chargé', detail: `${results.length} produit(s) ajouté(s)`, life: 2500 });
    }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  } finally {
    chargementListe.value = false;
  }
}

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

  <template v-if="panier.lignes.length === 0">
    <Message severity="info" :closable="false">
      Votre panier est vide. <RouterLink to="/catalogue">Explorer le catalogue</RouterLink>.
    </Message>
    <Card v-if="session.user && session.user.role !== 'seller' && listes.length > 0" class="liste-card">
      <template #title>Charger une liste de courses</template>
      <template #content>
        <div class="liste-form">
          <Select v-model="listeSelectionnee" :options="listes" option-label="nom" option-value="id" placeholder="Choisir une liste…" />
          <Button label="Charger dans le panier" icon="pi pi-shopping-cart" :disabled="!listeSelectionnee" :loading="chargementListe" @click="chargerListe" />
        </div>
      </template>
    </Card>
  </template>

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
.liste-card { margin-top: 1rem; }
.liste-form { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
</style>
