import { createRouter, createWebHistory } from 'vue-router';
import { useSessionStore } from '../stores/session.js';

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/catalogue', name: 'catalogue', component: () => import('../views/CatalogueView.vue') },
  { path: '/produits/:id', name: 'produit-detail', component: () => import('../views/ProduitDetailView.vue') },
  { path: '/carte', name: 'carte', component: () => import('../views/CarteView.vue') },
  { path: '/panier', name: 'panier', component: () => import('../views/PanierView.vue') },
  {
    path: '/checkout',
    name: 'checkout',
    component: () => import('../views/CheckoutView.vue'),
    meta: { requiresAuth: true, roles: ['user', 'admin'] },
  },
  {
    path: '/commandes/:id',
    name: 'commande-detail',
    component: () => import('../views/CommandeDetailView.vue'),
    meta: { requiresAuth: true },
  },
  { path: '/connexion', name: 'connexion', component: () => import('../views/LoginView.vue'), meta: { guestOnly: true } },
  { path: '/inscription', name: 'inscription', component: () => import('../views/RegisterView.vue'), meta: { guestOnly: true } },
  {
    path: '/app',
    component: () => import('../views/app/AppLayout.vue'),
    meta: { requiresAuth: true, roles: ['user', 'admin'] },
    children: [
      { path: 'compte', name: 'compte', component: () => import('../views/app/CompteView.vue') },
      { path: 'historique', name: 'historique', component: () => import('../views/app/HistoriqueView.vue') },
      { path: 'favoris', name: 'favoris', component: () => import('../views/app/FavorisView.vue') },
      { path: 'liste-courses', name: 'liste-courses', component: () => import('../views/app/ListeCoursesView.vue') },
      { path: 'alertes', name: 'alertes', component: () => import('../views/app/AlertesView.vue') },
    ],
  },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'admin-dashboard', component: () => import('../views/admin/AdminDashboardView.vue') },
      { path: 'users', name: 'admin-users', component: () => import('../views/admin/AdminUsersView.vue') },
      { path: 'alertes', name: 'admin-alertes', component: () => import('../views/admin/AdminAlertesView.vue') },
      { path: 'audit', name: 'admin-audit', component: () => import('../views/admin/AdminAuditView.vue') },
    ],
  },
  {
    path: '/seller',
    component: () => import('../views/seller/SellerLayout.vue'),
    meta: { requiresAuth: true, roles: ['seller', 'admin'] },
    children: [
      { path: '', redirect: '/seller/commandes' },
      { path: 'commandes', name: 'seller-commandes', component: () => import('../views/seller/SellerCommandesView.vue') },
      { path: 'produits', name: 'seller-produits', component: () => import('../views/seller/SellerProduitsView.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const session = useSessionStore();
  if (!session.loaded) {
    await session.fetchMe();
  }
  if (to.name === 'panier' && session.user?.role === 'seller') {
    return { name: 'home' };
  }
  if (to.meta.requiresAuth && !session.user) {
    return { name: 'connexion', query: { redirect: to.fullPath } };
  }
  if (to.meta.roles && session.user && !to.meta.roles.includes(session.user.role)) {
    return { name: 'home' };
  }
  if (to.meta.guestOnly && session.user) {
    return { name: 'home' };
  }
  return true;
});

export default router;
