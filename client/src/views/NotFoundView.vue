<script setup>
import Button from 'primevue/button';
import { RouterLink } from 'vue-router';
</script>

<template>
  <section class="nf">
    <h1>404</h1>
    <p>Cette page n'existe pas (ou plus).</p>
    <RouterLink to="/"><Button label="Retour à l'accueil" icon="pi pi-home" /></RouterLink>
  </section>
</template>

<style scoped>
.nf { text-align: center; padding: 4rem 1rem; }
.nf h1 { font-size: 5rem; margin: 0; color: var(--p-primary-color); }
</style>
