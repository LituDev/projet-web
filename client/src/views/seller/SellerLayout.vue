<script setup>
import { RouterView, RouterLink } from 'vue-router';
</script>

<template>
  <div class="wrap">
    <aside>
      <h3>Espace producteur</h3>
      <nav>
        <RouterLink to="/seller/compte"><i class="pi pi-user" /> Mon profil</RouterLink>
        <RouterLink to="/seller/commandes"><i class="pi pi-list" /> Commandes</RouterLink>
        <RouterLink to="/seller/entreprises"><i class="pi pi-building" /> Mes entreprises</RouterLink>
        <RouterLink to="/seller/produits"><i class="pi pi-shopping-bag" /> Mes produits</RouterLink>
      </nav>
    </aside>
    <section class="content">
      <RouterView />
    </section>
  </div>
</template>

<style scoped>
.wrap { display: grid; grid-template-columns: 16rem 1fr; gap: 1.5rem; }
aside { border-right: 1px solid var(--p-content-border-color); padding-right: 1rem; }
aside h3 { font-size: 1rem; color: var(--p-text-muted-color); margin-bottom: .75rem; }
nav { display: flex; flex-direction: column; gap: .25rem; }
nav a { padding: .5rem .75rem; border-radius: .4rem; text-decoration: none; color: inherit; display: flex; align-items: center; gap: .5rem; }
nav a.router-link-active { background: var(--p-surface-100); color: var(--p-primary-color); font-weight: 600; }
.content { min-width: 0; }
@media (max-width: 720px) {
  .wrap { grid-template-columns: 1fr; }
  aside { border-right: none; border-bottom: 1px solid var(--p-content-border-color); padding: 0 0 1rem; }
}
</style>
