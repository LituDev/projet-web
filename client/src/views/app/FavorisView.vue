<script setup>
import { onMounted, ref } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { api } from '../../services/api.js';

const toast = useToast();
const favoris = ref([]);
const loading = ref(false);
const err = ref('');

async function charger() {
  loading.value = true;
  try { favoris.value = (await api.get('/favoris')).data; }
  catch (e) { err.value = e.message; }
  finally { loading.value = false; }
}
async function retirer(entrepriseId) {
  try {
    await api.del(`/favoris/${entrepriseId}`);
    toast.add({ severity: 'success', summary: 'Retiré des favoris', life: 2000 });
    favoris.value = favoris.value.filter((f) => f.entreprise_id !== entrepriseId);
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
  }
}
onMounted(charger);
</script>

<template>
  <h2>Producteurs favoris</h2>
  <Message v-if="err" severity="error" :closable="false">{{ err }}</Message>
  <Message v-else-if="!loading && favoris.length === 0" severity="info" :closable="false">
    Aucun favori pour l'instant. Ajoutez-en depuis la fiche d'un producteur.
  </Message>
  <div class="grid">
    <Card v-for="f in favoris" :key="f.entreprise_id">
      <template #title>{{ f.entreprise_nom }}</template>
      <template #content>
        <p>{{ f.description }}</p>
      </template>
      <template #footer>
        <Button label="Retirer" icon="pi pi-times" severity="danger" text @click="retirer(f.entreprise_id)" />
      </template>
    </Card>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); gap: 1rem; margin-top: 1rem; }
</style>
