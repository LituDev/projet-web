<script setup>
import Card from 'primevue/card';
import Button from 'primevue/button';
import { RouterLink } from 'vue-router';
</script>

<template>
  <section class="hero">
    <h1>Les produits de vos fermes voisines, en un clic.</h1>
    <p>gumes rassemble les productrices et producteurs locaux et vous permet de commander au plus près&nbsp;— en retrait sur place, en point relais ou livraison.</p>
    <div class="cta">
      <RouterLink to="/catalogue"><Button label="Parcourir le catalogue" icon="pi pi-shopping-bag" /></RouterLink>
      <RouterLink to="/carte"><Button label="Voir la carte" icon="pi pi-map" severity="secondary" outlined /></RouterLink>
    </div>
  </section>

  <section class="tiles">
    <Card>
      <template #title>Circuits courts</template>
      <template #content>De la ferme au panier, sans intermédiaire.</template>
    </Card>
    <Card>
      <template #title>Saisonnalité</template>
      <template #content>Ne vous affichons que ce qui est de saison près de chez vous.</template>
    </Card>
    <Card>
      <template #title>Trois modes de retrait</template>
      <template #content>Sur le lieu de vente, en point relais, ou livraison à domicile.</template>
    </Card>
  </section>
</template>

<style scoped>
.hero {
  padding: 3rem 0 2rem;
  text-align: center;
}
.hero h1 { font-size: 2.2rem; margin: 0 0 .8rem; }
.hero p  { color: var(--p-text-muted-color); max-width: 42rem; margin: 0 auto 1.5rem; }
.cta { display: flex; gap: .75rem; justify-content: center; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 1rem; margin-top: 2rem; }
</style>
