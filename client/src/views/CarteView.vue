<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Card from 'primevue/card';
import ToggleButton from 'primevue/togglebutton';
import { api } from '../services/api.js';

const mapRef = ref(null);
const onlyOpen = ref(false);
let map = null;
const lieuxLayer = L.layerGroup();
const relaisLayer = L.layerGroup();

function makeIcon(color) {
  return L.divIcon({
    className: 'gumes-marker',
    html: `<span class="pin" style="background:${color}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}
const iconLieu = makeIcon('#15803d');   // vert
const iconLieuOuvert = makeIcon('#eab308'); // ambre
const iconRelais = makeIcon('#2563eb'); // bleu

async function chargerLieux() {
  lieuxLayer.clearLayers();
  const path = onlyOpen.value ? '/geo/lieux?ouverts=1' : '/geo/lieux';
  const res = await api.get(path);
  for (const l of res.data) {
    const icon = onlyOpen.value ? iconLieuOuvert : iconLieu;
    L.marker([l.lat, l.lon], { icon })
      .bindPopup(`<strong>${l.nom}</strong><br>${l.entreprise_nom ?? ''}<br><small>${l.adresse ?? ''}</small>`)
      .addTo(lieuxLayer);
  }
}

async function chargerRelais() {
  relaisLayer.clearLayers();
  const res = await api.get('/geo/points-relais');
  for (const r of res.data) {
    L.marker([r.lat, r.lon], { icon: iconRelais })
      .bindPopup(`<strong>${r.nom}</strong><br><small>${r.adresse}</small>`)
      .addTo(relaisLayer);
  }
}

onMounted(async () => {
  map = L.map(mapRef.value).setView([48.2, -2.9], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  lieuxLayer.addTo(map);
  relaisLayer.addTo(map);
  await Promise.all([chargerLieux(), chargerRelais()]);
});

onBeforeUnmount(() => { map?.remove(); });

watch(onlyOpen, chargerLieux);
</script>

<template>
  <h2>Carte des producteurs et points relais</h2>

  <div class="controls">
    <ToggleButton v-model="onlyOpen" on-label="Ouverts maintenant" off-label="Tous les lieux" on-icon="pi pi-clock" off-icon="pi pi-map-marker" />
    <div class="legende">
      <span><span class="dot" style="background:#15803d" /> Lieu de vente</span>
      <span><span class="dot" style="background:#eab308" /> Lieu ouvert</span>
      <span><span class="dot" style="background:#2563eb" /> Point relais</span>
    </div>
  </div>

  <Card>
    <template #content>
      <div ref="mapRef" class="map" />
    </template>
  </Card>
</template>

<style>
.gumes-marker .pin {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 3px solid white;
  box-shadow: 0 0 2px rgba(0,0,0,.5);
}
</style>

<style scoped>
.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: .75rem;
  flex-wrap: wrap;
}
.legende { display: flex; gap: 1rem; font-size: .9rem; color: var(--p-text-muted-color); }
.legende span { display: inline-flex; align-items: center; gap: .3rem; }
.dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 1px rgba(0,0,0,.5); }
.map { height: 70vh; border-radius: .5rem; z-index: 0; }
</style>
