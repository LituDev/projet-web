<script setup>
import { onMounted, ref } from 'vue';
import Card from 'primevue/card';
import { api } from '../../services/api.js';

const stats = ref(null);

onMounted(async () => { stats.value = await api.get('/admin/stats'); });
</script>

<template>
  <h2>Dashboard</h2>
  <div v-if="stats" class="grid">
    <Card>
      <template #title>Utilisateurs</template>
      <template #content>
        <ul>
          <li v-for="u in stats.users" :key="u.role">{{ u.role }} : <strong>{{ u.n }}</strong></li>
        </ul>
      </template>
    </Card>
    <Card>
      <template #title>Produits</template>
      <template #content><p class="big">{{ stats.produits }}</p></template>
    </Card>
    <Card>
      <template #title>Commandes par statut</template>
      <template #content>
        <ul>
          <li v-for="c in stats.commandes" :key="c.statut">{{ c.statut }} : <strong>{{ c.n }}</strong></li>
        </ul>
      </template>
    </Card>
    <Card>
      <template #title>Alertes</template>
      <template #content>
        <ul>
          <li v-for="a in stats.alertes" :key="a.statut">{{ a.statut }} : <strong>{{ a.n }}</strong></li>
        </ul>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; margin-top: 1rem; }
.big { font-size: 2.5rem; font-weight: 700; margin: 0; color: var(--p-primary-color); }
ul { list-style: none; padding: 0; margin: 0; }
ul li { padding: .25rem 0; }
</style>
