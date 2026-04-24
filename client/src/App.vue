<script setup>
import { computed, onMounted } from "vue";
import { RouterLink, RouterView, useRouter } from "vue-router";
import Menubar from "primevue/menubar";
import Button from "primevue/button";
import Toast from "primevue/toast";
import ConfirmDialog from "primevue/confirmdialog";
import { useSessionStore } from "./stores/session.js";
import { usePanierStore } from "./stores/panier.js";

const session = useSessionStore();
const panier = usePanierStore();
const router = useRouter();

const canUsePanier = computed(
  () => !session.user || session.user.role !== "seller",
);
const canUseListes = computed(
  () => session.user && (session.user.role === "user" || session.user.role === "admin"),
);
const accountLabel = computed(() => {
  const prenom = session.user?.prenom?.trim();
  return prenom || "Mon compte";
});
const accountRoute = computed(() => {
  if (session.user?.role === "seller") return "/seller/compte";
  return "/app/compte";
});

onMounted(async () => {
  await session.fetchMe();
});

const items = computed(() => {
  const base = [
    { label: "Accueil", icon: "pi pi-home", route: "/" },
    { label: "Catalogue", icon: "pi pi-shopping-bag", route: "/catalogue" },
    { label: "Carte", icon: "pi pi-map", route: "/carte" },
  ];
  if (session.isClient || session.isAdmin) {
    base.push({
      label: "Mon espace",
      icon: "pi pi-list",
      route: "/app/historique",
    });
  }
  if (session.isSeller || session.isAdmin) {
    base.push({
      label: "Espace producteur",
      icon: "pi pi-wrench",
      route: "/seller/commandes",
    });
  }
  if (session.isAdmin) {
    base.push({ label: "Admin", icon: "pi pi-cog", route: "/admin/dashboard" });
  }
  return base;
});

async function logout() {
  await session.logout();
  router.push("/");
}
</script>

<template>
  <Toast />
  <ConfirmDialog />

  <Menubar :model="items">
    <template #start>
      <RouterLink to="/" class="brand"> Gumes Marketplace </RouterLink>
    </template>
    <template #item="{ item, props }">
      <RouterLink
        v-if="item.route"
        :to="item.route"
        custom
        v-slot="{ navigate, isActive }"
      >
        <a
          :class="['p-menubar-item-link', { 'is-active': isActive }]"
          v-bind="props.action"
          @click="navigate"
        >
          <span :class="item.icon" />
          <span class="p-menubar-item-label">{{ item.label }}</span>
        </a>
      </RouterLink>
    </template>
    <template #end>
      <div class="nav-end">
        <RouterLink
          v-if="canUsePanier"
          to="/panier"
          class="panier-link"
          aria-label="Voir le panier"
        >
          <Button
            icon="pi pi-shopping-cart"
            text
            :badge="
              panier.totalArticles ? String(panier.totalArticles) : undefined
            "
            badge-severity="contrast"
          />
        </RouterLink>
        <RouterLink
          v-if="canUseListes"
          to="/app/liste-courses"
          class="panier-link"
          aria-label="Voir les listes de courses"
        >
          <Button icon="pi pi-bookmark" text />
        </RouterLink>
        <template v-if="session.user">
          <RouterLink :to="accountRoute">
            <Button :label="accountLabel" icon="pi pi-user" text />
          </RouterLink>
          <Button
            label="Déconnexion"
            icon="pi pi-sign-out"
            severity="secondary"
            text
            @click="logout"
          />
        </template>
        <template v-else>
          <RouterLink to="/connexion"
            ><Button label="Connexion" icon="pi pi-sign-in" text
          /></RouterLink>
          <RouterLink to="/inscription"
            ><Button label="Créer un compte" icon="pi pi-user-plus"
          /></RouterLink>
        </template>
      </div>
    </template>
  </Menubar>

  <main class="app-container">
    <RouterView />
  </main>
</template>

<style scoped>
.brand {
  font-weight: 700;
  font-size: 1.2rem;
  text-decoration: none;
  color: var(--p-primary-color);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.5rem;
}
.nav-end {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.p-menubar-item-link.is-active {
  color: var(--p-primary-color);
  font-weight: 600;
}
</style>
