<script setup>
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Card from 'primevue/card';
import Button from 'primevue/button';
import RadioButton from 'primevue/radiobutton';
import Select from 'primevue/select';
import InputText from 'primevue/inputtext';
import InputMask from 'primevue/inputmask';
import Textarea from 'primevue/textarea';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api } from '../services/api.js';
import { usePanierStore } from '../stores/panier.js';
import { useSessionStore } from '../stores/session.js';

const panier = usePanierStore();
const session = useSessionStore();
const router = useRouter();
const toast = useToast();

const quote = ref(null);
const mode = ref(null);
const loadingQuote = ref(false);

// Pickup store — multi-producteur
const lieuxTous = ref([]);
const lieuxParProducteur = ref([]);
const lieuxChoisis = ref({});
const loadingLieux = ref(false);
const villeDepart = ref('');
const codePostalDepart = ref('');
const geocodeAmbiguous = ref(false);
const coordsDepart = ref(null); // { lat, lon, display_name }
const geocoding = ref(false);
const mapPickupRef = ref(null);
let mapPickup = null;
let markersLayer = null;
let routeLayer = null;
let routeWorker = null;
const trajet = ref(null);
const optimizing = ref(false);

// Pickup relay
const pointsRelais = ref([]);
const relaisId = ref(null);

// Home delivery
const adresse = ref('');
const codePostalLivraison = ref('');
const lat = ref(48.1173);
const lon = ref(-1.6778);

// Payment
const carte = ref('');
const processingPay = ref(false);
const errorMsg = ref('');

const formatPrix = (cents) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

const modeChoisi = computed(() => quote.value?.modes.find((m) => m.mode === mode.value));
const modeLabel = { pickup_store: 'Retrait en lieu de vente', pickup_relay: 'Point relais', home_delivery: 'Livraison à domicile' };
const modeIcon = { pickup_store: 'pi pi-shop', pickup_relay: 'pi pi-inbox', home_delivery: 'pi pi-truck' };

const lieuIds = computed(() => Object.values(lieuxChoisis.value).filter(Boolean));
const tousLieuxChoisis = computed(
  () => lieuxParProducteur.value.length > 0 && lieuIds.value.length === lieuxParProducteur.value.length,
);

function getLieuById(id) {
  return lieuxTous.value.find((l) => l.id === id);
}

// ─── TSP helpers ─────────────────────────────────────────────────────────────
function haversineM(a, b) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function tourLength(pts) {
  let t = 0;
  for (let i = 0; i < pts.length - 1; i++) t += haversineM(pts[i], pts[i + 1]);
  return t;
}
function nearestNeighbor(depart, etapes) {
  const restant = [...etapes];
  const ordre = [depart];
  let cur = depart;
  while (restant.length) {
    let best = 0; let bestD = Infinity;
    for (let i = 0; i < restant.length; i++) {
      const d = haversineM(cur, restant[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    cur = restant.splice(best, 1)[0];
    ordre.push(cur);
  }
  return ordre;
}
function twoOpt(tour) {
  let best = [...tour];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 2; i++) {
      for (let j = i + 1; j < best.length - 1; j++) {
        const [a, b, c, d] = [best[i - 1], best[i], best[j], best[j + 1]];
        if (haversineM(a, c) + haversineM(b, d) < haversineM(a, b) + haversineM(c, d) - 0.5) {
          best = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
          improved = true;
        }
      }
    }
  }
  return best;
}
function routeDistance(lieux) {
  if (lieux.length <= 1) return 0;
  const [dep, ...e] = lieux;
  return tourLength(twoOpt(nearestNeighbor(dep, e)));
}
function routeDistanceRoundTrip(departPt, lieux) {
  if (lieux.length === 0) return 0;
  const ordered = twoOpt(nearestNeighbor(departPt, lieux));
  return tourLength(ordered) + haversineM(ordered[ordered.length - 1], departPt);
}
function* combos(groups) {
  if (groups.length === 0) { yield []; return; }
  const [first, ...rest] = groups;
  for (const lieu of first.lieux) {
    for (const combo of combos(rest)) yield [{ entreprise_id: first.entreprise_id, lieu }, ...combo];
  }
}
function optimiserSelection(lieuxParProducteur, departPt = null) {
  const disponibles = lieuxParProducteur.filter((p) => p.lieux.length > 0);
  if (disponibles.length === 0) return {};
  let bestDist = Infinity; let bestCombo = null;
  for (const combo of combos(disponibles)) {
    const lieux = combo.map((c) => c.lieu);
    const dist = departPt ? routeDistanceRoundTrip(departPt, lieux) : routeDistance(lieux);
    if (dist < bestDist) { bestDist = dist; bestCombo = combo; }
  }
  const result = {};
  for (const { entreprise_id, lieu } of bestCombo) result[entreprise_id] = lieu.id;
  return result;
}
// ─────────────────────────────────────────────────────────────────────────────

async function fetchQuote() {
  if (panier.lignes.length === 0) return;
  loadingQuote.value = true;
  try {
    const lignes = panier.lignes.map((l) => ({ produit_id: l.produit_id, quantite: l.quantite }));
    quote.value = await api.post('/commandes/quote', { lignes });
    const premier = quote.value.modes.find((m) => m.disponible);
    if (premier) mode.value = premier.mode;
  } catch (err) {
    errorMsg.value = err.message;
  } finally {
    loadingQuote.value = false;
  }
}

async function determinerLieuxMultiProducteur() {
  if (!quote.value) return;
  loadingLieux.value = true;
  try {
    const entrepriseMap = new Map();
    for (const l of quote.value.lignes) {
      if (!entrepriseMap.has(l.entreprise_id)) {
        const panierLigne = panier.lignes.find((pl) => pl.produit_id === l.produit_id);
        entrepriseMap.set(l.entreprise_id, panierLigne?.entreprise_nom ?? l.entreprise_id);
      }
    }
    if (lieuxTous.value.length === 0) {
      const res = await api.get('/geo/lieux');
      lieuxTous.value = res.data;
    }
    const result = [];
    for (const [entreprise_id, entreprise_nom] of entrepriseMap) {
      const lieux = lieuxTous.value.filter((l) => l.entreprise_id === entreprise_id);
      result.push({ entreprise_id, entreprise_nom, lieux });
    }
    lieuxParProducteur.value = result;
    lieuxChoisis.value = optimiserSelection(result); // sélection initiale sans point de départ
  } catch (e) {
    errorMsg.value = e.message;
  } finally {
    loadingLieux.value = false;
  }
}

async function geocoderEtOptimiser() {
  const ville = villeDepart.value.trim();
  const codePostal = codePostalDepart.value.trim();
  if (!ville && !codePostal) {
    coordsDepart.value = null;
    geocodeAmbiguous.value = false;
    await initMapPickup();
    return;
  }
  geocoding.value = true;
  try {
    const params = new URLSearchParams();
    if (ville) params.set('ville', ville);
    if (codePostal) params.set('code_postal', codePostal);
    const res = await api.get(`/geo/geocode?${params}`);
    coordsDepart.value = res.result; // unique uniquement
    geocodeAmbiguous.value = Boolean(res.ambiguous);
    if (coordsDepart.value && lieuxParProducteur.value.length > 0) {
      lieuxChoisis.value = optimiserSelection(lieuxParProducteur.value, coordsDepart.value);
    }
  } catch {
    coordsDepart.value = null;
    geocodeAmbiguous.value = false;
  }
  finally { geocoding.value = false; }
  await initMapPickup();
}

async function chargerAdresseEtOptimiser() {
  let profil = session.user;
  if (!profil?.adresse && !profil?.ville && !profil?.code_postal) {
    try {
      const me = await api.get('/auth/me');
      profil = me.user;
    } catch {
      return;
    }
  }

  codePostalDepart.value = profil?.code_postal?.trim?.() ?? '';
  villeDepart.value = profil?.ville?.trim?.() ?? '';

  // Fallback legacy: derive city/postal from full address string when older profiles don't have dedicated fields.
  if ((!codePostalDepart.value || !villeDepart.value) && profil?.adresse) {
    const addr = profil.adresse;
    const cpMatch = addr.match(/\b(\d{5})\b/);
    if (!codePostalDepart.value && cpMatch) {
      codePostalDepart.value = cpMatch[1];
    }
    if (!villeDepart.value) {
      if (cpMatch) {
        const afterCp = addr.slice(cpMatch.index + cpMatch[0].length).replace(/^[\s,-]+/, '').trim();
        if (afterCp) villeDepart.value = afterCp;
      } else {
        const tail = addr.split(',').at(-1)?.trim();
        if (tail) villeDepart.value = tail;
      }
    }
  }

  if (!villeDepart.value && !codePostalDepart.value) return;
  await geocoderEtOptimiser();
}

async function initMapPickup() {
  await nextTick();
  if (!mapPickupRef.value) return;

  if (!mapPickup) {
    mapPickup = L.map(mapPickupRef.value).setView([46.8, 2.3], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(mapPickup);
    markersLayer = L.layerGroup().addTo(mapPickup);
  }

  markersLayer.clearLayers();
  if (routeLayer) { routeLayer.remove(); routeLayer = null; }
  trajet.value = null;
  if (routeWorker) { routeWorker.terminate(); routeWorker = null; }
  optimizing.value = false;

  const selectedLieux = lieuIds.value.map((id) => getLieuById(id)).filter(Boolean);
  const home = coordsDepart.value;
  const bounds = [];

  // Marqueur "maison"
  if (home) {
    const homeIcon = L.divIcon({
      className: '',
      html: `<div class="map-marker-home"><i class="pi pi-home"></i></div>`,
      iconSize: [34, 34], iconAnchor: [17, 17],
    });
    L.marker([home.lat, home.lon], { icon: homeIcon })
      .bindPopup(`<strong>Point de départ</strong><br><small>${home.display_name ?? 'Ville sélectionnée'}</small>`)
      .addTo(markersLayer);
    bounds.push([home.lat, home.lon]);
  }

  // Marqueurs lieux de retrait
  for (const lieu of selectedLieux) {
    const icon = L.divIcon({
      className: '',
      html: `<div class="map-marker-pickup"><i class="pi pi-shop"></i></div>`,
      iconSize: [34, 34], iconAnchor: [17, 17],
    });
    L.marker([Number(lieu.lat), Number(lieu.lon)], { icon })
      .bindPopup(`<strong>${lieu.nom}</strong><br><small>${lieu.adresse}</small>`)
      .addTo(markersLayer);
    bounds.push([Number(lieu.lat), Number(lieu.lon)]);
  }

  if (bounds.length > 0) mapPickup.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });

  const needsRoute = selectedLieux.length >= 2 || (selectedLieux.length >= 1 && home);
  if (!needsRoute) return;

  optimizing.value = true;
  routeWorker = new Worker(new URL('../workers/trajet.worker.js', import.meta.url), { type: 'module' });

  routeWorker.onmessage = (e) => {
    const ordre = e.data.ordre;
    let dist = e.data.distance_m;
    // Ajouter le trajet retour si aller-retour
    if (home && ordre.length > 0) {
      dist += Math.round(haversineM(ordre[ordre.length - 1], home));
    }
    trajet.value = { ordre, distance_m: dist, algo: e.data.algo, allerRetour: !!home };
    optimizing.value = false;
    routeWorker.terminate();
    routeWorker = null;
    const coordsList = ordre.map((p) => [p.lat, p.lon]);
    if (home) coordsList.push([home.lat, home.lon]); // Boucle retour
    if (routeLayer) routeLayer.remove();
    routeLayer = L.polyline(coordsList, { color: '#2563eb', weight: 3, opacity: 0.85, dashArray: '8,5' }).addTo(mapPickup);
  };
  routeWorker.onerror = () => {
    optimizing.value = false;
    routeWorker?.terminate();
    routeWorker = null;
  };

  // Objets plats pour éviter les erreurs de clonage des Proxy Vue
  const rawPoints = selectedLieux.map((l) => ({ id: l.id, nom: l.nom, lat: Number(l.lat), lon: Number(l.lon) }));
  if (home) {
    routeWorker.postMessage({ depart: { id: 'home', nom: 'Votre adresse', lat: home.lat, lon: home.lon }, etapes: rawPoints });
  } else {
    const [depart, ...etapes] = rawPoints;
    routeWorker.postMessage({ depart, etapes });
  }
}

watch(mode, async (m) => {
  if (m === 'pickup_store') {
    await determinerLieuxMultiProducteur();
    await initMapPickup(); // Afficher la carte immédiatement
    chargerAdresseEtOptimiser(); // Géocodage en arrière-plan, met à jour la carte quand prêt
  }
  if (m === 'pickup_relay' && pointsRelais.value.length === 0) {
    const res = await api.get('/geo/points-relais');
    pointsRelais.value = res.data;
  }
  if (m === 'home_delivery') await preRemplirAdresseClient();
});

async function preRemplirAdresseClient() {
  if (session.user?.code_postal) {
    codePostalLivraison.value = session.user.code_postal;
  }
  if (adresse.value?.trim()) return;
  if (session.user?.adresse) {
    adresse.value = session.user.adresse;
    codePostalLivraison.value = session.user.code_postal ?? '';
    return;
  }
  try {
    const me = await api.get('/auth/me');
    if (me.user?.code_postal) {
      codePostalLivraison.value = me.user.code_postal;
    }
    if (me.user?.adresse) {
      adresse.value = me.user.adresse;
      codePostalLivraison.value = me.user.code_postal ?? '';
      if (session.user) session.user.adresse = me.user.adresse;
    }
  } catch { /* best-effort */ }
}

async function passer() {
  errorMsg.value = '';
  processingPay.value = true;
  try {
    const lignes = panier.lignes.map((l) => ({ produit_id: l.produit_id, quantite: l.quantite }));
    const payload = { mode_livraison: mode.value, lignes };
    if (mode.value === 'pickup_store') payload.lieu_ids = lieuIds.value;
    if (mode.value === 'pickup_relay') payload.relais_id = relaisId.value;
    if (mode.value === 'home_delivery') {
      Object.assign(payload, {
        adresse: adresse.value,
        code_postal: codePostalLivraison.value.trim() || undefined,
        lat: lat.value,
        lon: lon.value,
      });
    }

    const cmdRes = await api.post('/commandes', payload);
    const commandeId = cmdRes.commande.id;

    const idempotencyKey = `cli-${commandeId}-${Date.now()}`;
    const payRes = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/api'}/paiements`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ methode: 'card_fake', commande_id: commandeId, numero_carte: carte.value.replace(/\s/g, '') }),
    });
    const payload2 = await payRes.json().catch(() => null);
    if (!payRes.ok) throw new Error(payload2?.error?.message ?? 'Paiement refusé');
    const statut = payload2.paiement.statut;

    if (statut === 'success') {
      toast.add({ severity: 'success', summary: 'Paiement accepté', detail: 'Commande confirmée.', life: 3000 });
      panier.vider();
      router.push({ name: 'commande-detail', params: { id: commandeId } });
    } else if (statut === 'declined') {
      errorMsg.value = 'Paiement refusé par la banque (carte terminée par 0000).';
    } else if (statut === 'error') {
      errorMsg.value = 'Erreur réseau simulée lors du paiement (carte terminée par 9999). Réessayez.';
    } else {
      errorMsg.value = `Statut du paiement : ${statut}`;
    }
  } catch (err) {
    errorMsg.value = err.message;
  } finally {
    processingPay.value = false;
  }
}

onMounted(fetchQuote);
onUnmounted(() => {
  if (routeWorker) { routeWorker.terminate(); routeWorker = null; }
  if (mapPickup) { mapPickup.remove(); mapPickup = null; }
});
</script>

<template>
  <h2>Commande</h2>

  <Message v-if="panier.lignes.length === 0" severity="warn" :closable="false">
    Votre panier est vide. <RouterLink to="/catalogue">Retour au catalogue</RouterLink>.
  </Message>

  <template v-else>
    <Card class="section">
      <template #title>1. Récapitulatif</template>
      <template #content>
        <ul class="lignes">
          <li v-for="l in panier.lignes" :key="l.produit_id">
            <span>{{ l.quantite }} × {{ l.nom }}</span>
            <span>{{ formatPrix(l.quantite * l.prix_cents) }}</span>
          </li>
        </ul>
        <div class="total-row">
          <span>Sous-total produits</span>
          <strong>{{ formatPrix(panier.totalCents) }}</strong>
        </div>
      </template>
    </Card>

    <Card class="section">
      <template #title>2. Mode de livraison</template>
      <template #content>
        <div v-if="loadingQuote" class="loading"><ProgressSpinner style="width: 2rem" /></div>
        <div v-else-if="quote" class="modes">
          <label v-for="m in quote.modes" :key="m.mode" class="mode-card" :class="{ disabled: !m.disponible, active: mode === m.mode }">
            <RadioButton v-model="mode" :value="m.mode" :disabled="!m.disponible" name="mode" />
            <div class="mode-body">
              <div class="mode-head">
                <i :class="modeIcon[m.mode]" />
                <strong>{{ modeLabel[m.mode] }}</strong>
                <Tag v-if="m.frais_port_cents === 0 && m.disponible" severity="success" value="Gratuit" />
                <span v-else-if="m.disponible" class="port">{{ formatPrix(m.frais_port_cents) }}</span>
              </div>
              <small v-if="!m.disponible" class="motif">{{ m.motif }}</small>
              <small v-else class="total">Total : {{ formatPrix(m.total_ttc_cents) }}</small>
            </div>
          </label>
        </div>

        <!-- Pickup store : adresse départ + lieux pré-sélectionnés + carte -->
        <div v-if="mode === 'pickup_store'" class="detail-mode">
          <div v-if="loadingLieux" class="loading"><ProgressSpinner style="width: 1.6rem" /></div>
          <template v-else>
            <!-- Adresse de départ -->
            <div class="depart-field">
              <label class="field-label">Point de départ et de retour</label>
              <div class="depart-row">
                <InputText
                  v-model="villeDepart"
                  placeholder="Ville (ex: Rennes)"
                  class="depart-input"
                  @blur="geocoderEtOptimiser" />
                <InputText
                  v-model="codePostalDepart"
                  placeholder="Code postal"
                  class="depart-input depart-cp"
                  @blur="geocoderEtOptimiser" />
                <Button
                  icon="pi pi-map-marker"
                  text
                  severity="secondary"
                  :loading="geocoding"
                  title="Localiser"
                  @click="geocoderEtOptimiser" />
              </div>
              <small v-if="coordsDepart" class="geo-ok">
                <i class="pi pi-check-circle" /> Adresse localisée
              </small>
              <small v-else-if="!geocoding && geocodeAmbiguous" class="geo-warn">
                <i class="pi pi-exclamation-triangle" /> Ville non unique — point de départ ignoré.
              </small>
              <small v-else-if="!geocoding && (villeDepart || codePostalDepart)" class="geo-warn">
                <i class="pi pi-exclamation-triangle" /> Ville introuvable — trajet calculé sans point de départ.
              </small>
            </div>

            <!-- Lieux par producteur -->
            <p class="opt-intro"><i class="pi pi-info-circle" /> Lieux sélectionnés automatiquement pour minimiser la distance.</p>
            <div v-for="prod in lieuxParProducteur" :key="prod.entreprise_id" class="producteur-lieu">
              <div class="prod-label"><i class="pi pi-shop" /> {{ prod.entreprise_nom }}</div>
              <Message v-if="prod.lieux.length === 0" severity="warn" :closable="false">Aucun lieu de retrait disponible.</Message>
              <div v-else class="lieu-selected">
                <strong>{{ getLieuById(lieuxChoisis[prod.entreprise_id])?.nom }}</strong>
                <small>{{ getLieuById(lieuxChoisis[prod.entreprise_id])?.adresse }}</small>
              </div>
            </div>

            <!-- Carte -->
            <div ref="mapPickupRef" class="pickup-map"></div>

            <div v-if="optimizing" class="opt-status">
              <ProgressSpinner style="width: 1.2rem" /> Calcul de l'itinéraire…
            </div>
            <div v-else-if="trajet" class="opt-status">
              <i class="pi pi-compass" />
              {{ trajet.allerRetour ? 'Trajet aller-retour' : 'Trajet optimisé' }} —
              <strong>{{ (trajet.distance_m / 1000).toFixed(1) }} km</strong>
              <span class="ordre-lieux">
                {{ trajet.ordre.map((p) => p.nom).join(' → ') }}{{ trajet.allerRetour ? ' → Votre adresse' : '' }}
              </span>
            </div>
          </template>
        </div>

        <!-- Pickup relay -->
        <div v-else-if="mode === 'pickup_relay'" class="detail-mode">
          <label for="relais">Choisir un point relais</label>
          <Select id="relais" v-model="relaisId" :options="pointsRelais" option-label="nom" option-value="id" placeholder="Sélectionner…" filter />
        </div>

        <!-- Home delivery -->
        <div v-else-if="mode === 'home_delivery'" class="detail-mode">
          <label for="adr">Adresse de livraison</label>
          <Textarea id="adr" v-model="adresse" rows="2" />
          <label for="cp-livraison">Code postal</label>
          <InputText id="cp-livraison" v-model="codePostalLivraison" placeholder="35000" />
        </div>
      </template>
    </Card>

    <Card class="section">
      <template #title>3. Paiement <small class="dev-tag">simulé — aucun débit réel</small></template>
      <template #content>
        <Message severity="info" :closable="false">
          Démo : <code>…0000</code> → refusé, <code>…9999</code> → erreur réseau simulée, sinon succès après 1,5 s.
        </Message>
        <div class="form">
          <div class="field">
            <label for="carte">Numéro de carte</label>
            <InputMask id="carte" v-model="carte" mask="9999 9999 9999 9999" placeholder="1234 5678 9012 3456" />
          </div>
          <Message v-if="errorMsg" severity="error" :closable="false">{{ errorMsg }}</Message>
          <Button
            label="Payer et commander"
            icon="pi pi-credit-card"
            :loading="processingPay"
            :disabled="!mode || !modeChoisi?.disponible || !carte
                       || (mode === 'pickup_store' && !tousLieuxChoisis)
                       || (mode === 'pickup_relay' && !relaisId)
                       || (mode === 'home_delivery' && !adresse)"
            @click="passer" />
        </div>
      </template>
    </Card>
  </template>
</template>

<style scoped>
.section { margin-bottom: 1rem; }
.lignes { list-style: none; padding: 0; margin: 0; }
.lignes li { display: flex; justify-content: space-between; padding: 0.3rem 0; border-bottom: 1px solid var(--p-content-border-color); }
.total-row { display: flex; justify-content: space-between; margin-top: 0.8rem; font-size: 1.05rem; }
.loading { display: flex; justify-content: center; padding: 1rem; }
.modes { display: flex; flex-direction: column; gap: .6rem; }
.mode-card { display: flex; align-items: flex-start; gap: .75rem; padding: .75rem; border: 1px solid var(--p-content-border-color); border-radius: .5rem; cursor: pointer; }
.mode-card.active { border-color: var(--p-primary-color); background: color-mix(in srgb, var(--p-primary-color) 6%, transparent); }
.mode-card.disabled { opacity: .5; cursor: not-allowed; }
.mode-body { flex: 1; display: flex; flex-direction: column; gap: .3rem; }
.mode-head { display: flex; align-items: center; gap: .5rem; }
.mode-head strong { flex: 1; }
.motif { color: var(--p-red-600); }
.detail-mode { margin-top: 1rem; display: flex; flex-direction: column; gap: .75rem; }
.depart-field { display: flex; flex-direction: column; gap: .3rem; }
.field-label { font-size: .85rem; font-weight: 600; color: var(--p-text-muted-color); }
.depart-row { display: flex; gap: .4rem; align-items: center; }
.depart-input { flex: 1; }
.depart-cp { max-width: 9rem; }
.geo-ok { color: #166534; font-size: .82rem; display: flex; align-items: center; gap: .3rem; }
.geo-warn { color: #b45309; font-size: .82rem; display: flex; align-items: center; gap: .3rem; }
.opt-intro { font-size: .85rem; color: var(--p-text-muted-color); margin: 0; display: flex; align-items: center; gap: .4rem; }
.producteur-lieu { display: flex; flex-direction: column; gap: .3rem; padding: .65rem .75rem; border: 1px solid var(--p-content-border-color); border-radius: .45rem; }
.prod-label { font-weight: 600; font-size: .9rem; display: flex; align-items: center; gap: .4rem; }
.lieu-selected { display: flex; flex-direction: column; gap: .15rem; padding: .4rem .5rem; background: color-mix(in srgb, var(--p-primary-color) 6%, transparent); border-radius: .35rem; }
.lieu-selected small { color: var(--p-text-muted-color); font-size: .82rem; }
.pickup-map { height: 280px; border-radius: .5rem; border: 1px solid var(--p-content-border-color); overflow: hidden; }
.opt-status { display: flex; align-items: center; gap: .5rem; font-size: .9rem; flex-wrap: wrap; }
.ordre-lieux { color: var(--p-text-muted-color); font-size: .85rem; }
.form { display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; }
.field { display: flex; flex-direction: column; gap: .3rem; max-width: 20rem; }
.dev-tag { color: var(--p-text-muted-color); font-weight: 400; font-size: .85rem; margin-left: .4rem; }
.port { font-weight: 600; }
</style>

<style>
.map-marker-pickup {
  width: 34px; height: 34px;
  background: var(--p-primary-color, #2563eb);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: .9rem;
  box-shadow: 0 2px 6px rgba(0,0,0,.3);
}
.map-marker-home {
  width: 34px; height: 34px;
  background: #16a34a;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: .9rem;
  box-shadow: 0 2px 6px rgba(0,0,0,.3);
}
</style>
