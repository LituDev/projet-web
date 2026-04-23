<script setup>
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

const mapRef = ref(null);
let map = null;
let truckMarker = null;
let animationFrame = null;

function iconHtml(icon, color) {
  return L.divIcon({
    className: 'livraison-marker',
    html: `<span class="pin" style="background:${color}"><i class="pi ${icon}"></i></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function truckIcon(angleDeg) {
  return L.divIcon({
    className: 'livraison-truck',
    html: `<span class="truck" style="transform: rotate(${angleDeg}deg)"><i class="pi pi-truck"></i></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function lerp(a, b, t) { return a + (b - a) * t; }

function haversine(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const la1 = toRad(a[0]);
  const la2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingDeg(a, b) {
  // renvoie un angle CSS (0 = vers la droite) basé sur lon/lat
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
}

async function fetchRoute(origine, destination) {
  try {
    const params = new URLSearchParams({
      from_lat: origine.lat,
      from_lon: origine.lon,
      to_lat: destination.lat,
      to_lon: destination.lon,
    });
    const res = await api.get(`/geo/route?${params}`);
    // OSRM renvoie [lon, lat] — on bascule en [lat, lon] pour Leaflet
    return res.coordinates.map(([lon, lat]) => [lat, lon]);
  } catch {
    return null;
  }
}

async function initMap(livraison) {
  if (!mapRef.value || map) return;
  const o = [Number(livraison.origine.lat), Number(livraison.origine.lon)];
  const d = [Number(livraison.destination.lat), Number(livraison.destination.lon)];

  map = L.map(mapRef.value, { zoomControl: true, scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);

  L.marker(o, { icon: iconHtml('pi-shop', '#15803d') }).addTo(map).bindPopup(livraison.origine.nom);
  L.marker(d, { icon: iconHtml('pi-home', '#1d4ed8') }).addTo(map).bindPopup(livraison.destination.adresse);

  const realRoute = await fetchRoute(livraison.origine, livraison.destination);
  if (!map) return; // composant démonté pendant le fetch
  const path = realRoute && realRoute.length >= 2 ? realRoute : [o, d];
  const isStraight = path.length === 2;

  L.polyline(path, {
    color: '#2563eb',
    weight: 4,
    opacity: isStraight ? 0.5 : 0.85,
    dashArray: isStraight ? '6 8' : null,
  }).addTo(map);

  map.fitBounds(L.latLngBounds(path).pad(0.2));

  // Pré-calcul des longueurs de segments pour animer à vitesse constante
  const segments = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const len = haversine(path[i], path[i + 1]);
    segments.push({ from: path[i], to: path[i + 1], len, start: total });
    total += len;
  }

  const initialAngle = bearingDeg(path[0], path[1]);
  truckMarker = L.marker(path[0], { icon: truckIcon(initialAngle), interactive: false }).addTo(map);

  const DURATION = 4000; // ms — trajet complet en accéléré
  const PAUSE = 700;
  let lastAngle = initialAngle;
  let start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    const cycle = DURATION + PAUSE;
    const phase = elapsed % cycle;
    const t = Math.min(1, phase / DURATION);
    const distTarget = t * total;

    let seg = segments[0];
    for (const s of segments) {
      if (distTarget <= s.start + s.len) { seg = s; break; }
    }
    const localT = seg.len === 0 ? 0 : (distTarget - seg.start) / seg.len;
    const lat = lerp(seg.from[0], seg.to[0], localT);
    const lon = lerp(seg.from[1], seg.to[1], localT);
    truckMarker.setLatLng([lat, lon]);

    const angle = bearingDeg(seg.from, seg.to);
    if (Math.abs(angle - lastAngle) > 2) {
      truckMarker.setIcon(truckIcon(angle));
      lastAngle = angle;
    }
    animationFrame = requestAnimationFrame(frame);
  }
  animationFrame = requestAnimationFrame(frame);
}

watch(commande, async (c) => {
  if (c?.mode_livraison === 'home_delivery' && c.livraison) {
    await nextTick();
    initMap(c.livraison);
  }
});

onBeforeUnmount(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  if (map) { map.remove(); map = null; }
});

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

        <div v-if="commande.mode_livraison === 'home_delivery' && commande.livraison" class="livraison-bloc">
          <h4><i class="pi pi-truck" /> Suivi de livraison</h4>
          <div class="livraison-meta">
            <span><i class="pi pi-shop" /> {{ commande.livraison.origine.nom }}</span>
            <i class="pi pi-arrow-right" />
            <span><i class="pi pi-home" /> {{ commande.livraison.destination.adresse }}</span>
          </div>
          <div ref="mapRef" class="livraison-map" />
        </div>
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
.livraison-bloc { margin-top: 1rem; }
.livraison-bloc h4 { display: flex; align-items: center; gap: .4rem; margin: 0 0 .5rem; }
.livraison-meta { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; color: var(--p-text-muted-color); font-size: .9rem; margin-bottom: .5rem; }
.livraison-map {
  height: 280px;
  border-radius: .5rem;
  overflow: hidden;
  border: 1px solid var(--p-content-border-color);
}
</style>
<style>
.livraison-marker, .livraison-truck {
  background: transparent !important;
  border: none !important;
}
.livraison-marker .pin {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  color: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.3);
  border: 2px solid #fff;
}
.livraison-marker .pin i { font-size: .85rem; }
.livraison-truck .truck {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 50%;
  background: #f59e0b; color: #fff;
  border: 2px solid #fff;
  box-shadow: 0 3px 8px rgba(0,0,0,.35);
  transition: transform .1s linear;
}
.livraison-truck .truck i { font-size: 1rem; }
</style>
