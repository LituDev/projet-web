<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Card from 'primevue/card';
import ToggleButton from 'primevue/togglebutton';
import Button from 'primevue/button';
import { api } from '../services/api.js';

const mapRef = ref(null);
const onlyOpen = ref(false);
const lieuxVente = ref([]);
const pointsRelais = ref([]);
const selectedLieu = ref(null);
const selectedRelais = ref(null);
const currentMapBounds = ref(null);
const router = useRouter();
let map = null;
const lieuxLayer = L.layerGroup();
const relaisLayer = L.layerGroup();
let skipNextSelectedRelaisZoom = false;
let skipNextSelectedLieuZoom = false;

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
const iconLieuSelectionne = makeIcon('#d97706'); // ambre fonce
const iconRelais = makeIcon('#2563eb'); // bleu
const iconRelaisSelectionne = makeIcon('#1d4ed8'); // bleu intense

let activeRelaisMarker = null;
let activeLieuMarker = null;

const lieuxVisibles = computed(() => {
  if (!currentMapBounds.value) return lieuxVente.value;
  return lieuxVente.value.filter((lieu) => currentMapBounds.value.contains([Number(lieu.lat), Number(lieu.lon)]));
});

const relaisVisibles = computed(() => {
  if (!currentMapBounds.value) return pointsRelais.value;
  return pointsRelais.value.filter((relais) => currentMapBounds.value.contains([Number(relais.lat), Number(relais.lon)]));
});

function synchroniserBornesCarte() {
  if (!map) return;
  currentMapBounds.value = map.getBounds();
}

function isSameRelais(a, b) {
  if (!a || !b) return false;
  if (a.id != null && b.id != null) return a.id === b.id;
  return a.nom === b.nom && a.adresse === b.adresse && a.lat === b.lat && a.lon === b.lon;
}

function setActiveRelaisMarker(relais) {
  if (activeRelaisMarker && activeRelaisMarker !== relais?._marker) {
    activeRelaisMarker.setIcon(iconRelais);
  }

  if (relais?._marker) {
    relais._marker.setIcon(iconRelaisSelectionne);
    activeRelaisMarker = relais._marker;
  } else {
    activeRelaisMarker = null;
  }
}

function isSameLieu(a, b) {
  if (!a || !b) return false;
  if (a.id != null && b.id != null) return a.id === b.id;
  return a.nom === b.nom && a.adresse === b.adresse && a.lat === b.lat && a.lon === b.lon;
}

function setActiveLieuMarker(lieu) {
  if (activeLieuMarker && activeLieuMarker !== lieu?._marker) {
    const iconNormal = onlyOpen.value ? iconLieuOuvert : iconLieu;
    activeLieuMarker.setIcon(iconNormal);
  }

  if (lieu?._marker) {
    lieu._marker.setIcon(iconLieuSelectionne);
    activeLieuMarker = lieu._marker;
  } else {
    activeLieuMarker = null;
  }
}

function catalogueUrlForLieu(lieu) {
  if (!lieu?.entreprise_id) return '/catalogue';
  const params = new URLSearchParams();
  params.set('entreprise_id', lieu.entreprise_id);
  if (lieu.entreprise_nom) params.set('entreprise_nom', lieu.entreprise_nom);
  return `/catalogue?${params.toString()}`;
}

function voirProduitsLieu(lieu) {
  if (!lieu?.entreprise_id) return;
  router.push({
    name: 'catalogue',
    query: {
      entreprise_id: lieu.entreprise_id,
      entreprise_nom: lieu.entreprise_nom ?? undefined,
    },
  });
}

async function chargerLieux() {
  lieuxLayer.clearLayers();
  const path = onlyOpen.value ? '/geo/lieux?ouverts=1' : '/geo/lieux';
  const res = await api.get(path);
  lieuxVente.value = res.data;

  for (const l of res.data) {
    const icon = onlyOpen.value ? iconLieuOuvert : iconLieu;
    const catalogueLink = catalogueUrlForLieu(l);
    const marker = L.marker([l.lat, l.lon], { icon })
      .bindPopup(
        `<strong>${l.nom}</strong><br>${l.entreprise_nom ?? ''}<br><small>${l.adresse ?? ''}</small><br>`
        + `<a href="${catalogueLink}" class="popup-link">Voir les produits</a>`,
      )
      .addTo(lieuxLayer);

    marker.on('click', () => {
      skipNextSelectedLieuZoom = true;
      selectedLieu.value = l;
      zoomerSurLieu(l);
    });

    l._marker = marker;
  }

  if (selectedLieu.value) {
    const refreshedLieu = res.data.find((l) => isSameLieu(l, selectedLieu.value));
    selectedLieu.value = refreshedLieu ?? null;
    if (refreshedLieu) setActiveLieuMarker(refreshedLieu);
  } else {
    setActiveLieuMarker(null);
  }
}

async function chargerRelais() {
  relaisLayer.clearLayers();
  const res = await api.get('/geo/points-relais');
  pointsRelais.value = res.data;

  for (const r of res.data) {
    const marker = L.marker([r.lat, r.lon], { icon: iconRelais })
      .bindPopup(`<strong>${r.nom}</strong><br><small>${r.adresse}</small>`)
      .addTo(relaisLayer);

    marker.on('click', () => {
      // Sync sidebar selection from map click, then focus immediately.
      skipNextSelectedRelaisZoom = true;
      selectedRelais.value = r;
      zoomerSurRelais(r);
    });

    r._marker = marker;
  }

  if (selectedRelais.value) {
    const refreshedRelais = res.data.find((r) => isSameRelais(r, selectedRelais.value));
    selectedRelais.value = refreshedRelais ?? null;
    if (refreshedRelais) setActiveRelaisMarker(refreshedRelais);
  } else {
    setActiveRelaisMarker(null);
  }
}

function zoomerSurLieu(lieu) {
  if (!map || !lieu) return;

  setActiveLieuMarker(lieu);

  map.flyTo([lieu.lat, lieu.lon], 14, {
    duration: 0.8,
  });

  if (lieu._marker) {
    map.once('moveend', () => {
      lieu._marker.openPopup();
    });
  }
}

function zoomerSurRelais(relais) {
  if (!map || !relais) return;

  setActiveRelaisMarker(relais);

  map.flyTo([relais.lat, relais.lon], 14, {
    duration: 0.8,
  });

  if (relais._marker) {
    map.once('moveend', () => {
      relais._marker.openPopup();
    });
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
  synchroniserBornesCarte();
  map.on('moveend', synchroniserBornesCarte);
});

onBeforeUnmount(() => {
  map?.off('moveend', synchroniserBornesCarte);
  map?.remove();
});

watch(onlyOpen, chargerLieux);
watch(selectedLieu, (lieu) => {
  if (skipNextSelectedLieuZoom) {
    skipNextSelectedLieuZoom = false;
    return;
  }
  if (!lieu) {
    setActiveLieuMarker(null);
    return;
  }
  zoomerSurLieu(lieu);
});
watch(selectedRelais, (relais) => {
  if (skipNextSelectedRelaisZoom) {
    skipNextSelectedRelaisZoom = false;
    return;
  }
  if (!relais) {
    setActiveRelaisMarker(null);
    return;
  }
  zoomerSurRelais(relais);
});
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
      <div class="map-layout">
        <div class="sidebar-panel">
          <div class="list-section">
            <h3 class="section-title">
              <span class="dot" style="background:#15803d" />
              Produits / lieux de vente
            </h3>
            <Button
              v-if="selectedLieu?.entreprise_id"
              label="Voir les produits de cette ferme"
              icon="pi pi-arrow-right"
              text
              class="go-catalogue"
              @click="voirProduitsLieu(selectedLieu)"
            />
            <div class="list-scroll">
              <button
                v-for="lieu in lieuxVisibles"
                :key="lieu.id"
                type="button"
                class="list-item"
                :class="{ 'is-selected': isSameLieu(lieu, selectedLieu) }"
                @click="selectedLieu = lieu"
              >
                <strong>{{ lieu.nom }}</strong>
                <small>{{ lieu.entreprise_nom ?? 'Producteur local' }}</small>
                <small>{{ lieu.adresse }}</small>
              </button>
              <p v-if="!lieuxVisibles.length" class="empty-state">Aucun lieu dans la zone visible.</p>
            </div>
          </div>

          <div class="list-section">
            <h3 class="section-title">
              <span class="dot" style="background:#2563eb" />
              Points relais
            </h3>
            <div class="list-scroll">
              <button
                v-for="relais in relaisVisibles"
                :key="relais.id"
                type="button"
                class="list-item list-item--relais"
                :class="{ 'is-selected': isSameRelais(relais, selectedRelais) }"
                @click="selectedRelais = relais"
              >
                <strong>{{ relais.nom }}</strong>
                <small>{{ relais.adresse }}</small>
              </button>
              <p v-if="!relaisVisibles.length" class="empty-state">Aucun point relais dans la zone visible.</p>
            </div>
          </div>
        </div>
        <div ref="mapRef" class="map" />
      </div>
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
.map-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1rem;
  align-items: start;
}
.sidebar-panel {
  display: flex;
  flex-direction: column;
  gap: .9rem;
  max-height: 70vh;
}
.list-section {
  border: 1px solid color-mix(in srgb, var(--p-content-border-color) 75%, transparent);
  border-radius: .6rem;
  padding: .55rem;
  background: color-mix(in srgb, var(--p-surface-0) 92%, #f8fafc);
  min-height: 0;
}
.section-title {
  display: flex;
  align-items: center;
  gap: .4rem;
  font-size: .9rem;
  font-weight: 600;
  margin: 0 0 .45rem 0;
}
.go-catalogue {
  padding: 0 .1rem;
  margin-bottom: .4rem;
}
.list-scroll {
  display: flex;
  flex-direction: column;
  gap: .35rem;
  max-height: 28vh;
  overflow: auto;
}
.list-item {
  border: 0;
  text-align: left;
  cursor: pointer;
  background: transparent;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  gap: .1rem;
  padding: .4rem .45rem;
  border-radius: .35rem;
  transition: background-color .2s ease, transform .15s ease;
}
.list-item:hover {
  background: color-mix(in srgb, #0f172a 8%, transparent);
}
.list-item:active {
  transform: scale(.995);
}
.list-item small {
  color: var(--p-text-muted-color);
}
.list-item.is-selected {
  background: color-mix(in srgb, #15803d 16%, transparent);
}
.list-item.is-selected strong {
  color: #166534;
}
.list-item--relais.is-selected {
  background: color-mix(in srgb, #1d4ed8 15%, transparent);
}
.list-item--relais.is-selected strong {
  color: #1e40af;
}
.empty-state {
  margin: .25rem 0 .1rem;
  font-size: .85rem;
  color: var(--p-text-muted-color);
}
.map { height: 70vh; border-radius: .5rem; z-index: 0; }

@media (max-width: 900px) {
  .map-layout {
    grid-template-columns: 1fr;
  }
}
</style>
