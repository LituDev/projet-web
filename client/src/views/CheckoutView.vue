<script setup>
import { onMounted, ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
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

const step = ref('quote'); // quote | pay | done
const quote = ref(null);
const mode = ref(null);
const loadingQuote = ref(false);

const pointsRelais = ref([]);
const lieuId = ref(null);
const lieuNom = ref('');
const lieuAdresse = ref('');
const loadingLieu = ref(false);
const relaisId = ref(null);
const adresse = ref('');
const lat = ref(48.1173);
const lon = ref(-1.6778);

const carte = ref('');
const processingPay = ref(false);
const errorMsg = ref('');

const formatPrix = (cents) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

const modeChoisi = computed(() => quote.value?.modes.find((m) => m.mode === mode.value));
const modeLabel = { pickup_store: 'Retrait en lieu de vente', pickup_relay: 'Point relais', home_delivery: 'Livraison à domicile' };
const modeIcon  = { pickup_store: 'pi pi-shop', pickup_relay: 'pi pi-inbox', home_delivery: 'pi pi-truck' };

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

async function determinerLieuRetraitAuto() {
  if (!panier.lignes.length) return;
  loadingLieu.value = true;
  try {
    const firstProduitId = panier.lignes[0]?.produit_id;
    if (!firstProduitId) return;

    const produitRes = await api.get(`/produits/${firstProduitId}`);
    const entrepriseId = produitRes.produit?.entreprise_id;
    if (!entrepriseId) {
      throw new Error('Impossible de déterminer le producteur du panier.');
    }

    const geoRes = await api.get('/geo/lieux');
    const lieuxEntreprise = geoRes.data.filter((l) => l.entreprise_id === entrepriseId);
    const choisi = lieuxEntreprise[0] ?? null;

    if (!choisi) {
      lieuId.value = null;
      lieuNom.value = '';
      lieuAdresse.value = '';
      throw new Error('Aucun lieu de retrait disponible pour ce producteur.');
    }

    lieuId.value = choisi.id;
    lieuNom.value = choisi.nom;
    lieuAdresse.value = choisi.adresse;
  } catch (e) {
    errorMsg.value = e.message;
  } finally {
    loadingLieu.value = false;
  }
}

async function preRemplirAdresseClient() {
  if (adresse.value?.trim()) return;
  if (session.user?.adresse) {
    adresse.value = session.user.adresse;
    return;
  }
  try {
    const me = await api.get('/auth/me');
    if (me.user?.adresse) {
      adresse.value = me.user.adresse;
      if (session.user) session.user.adresse = me.user.adresse;
    }
  } catch {
    // best-effort prefill only
  }
}

watch(mode, async (m) => {
  if (m === 'pickup_store') {
    await determinerLieuRetraitAuto();
  }
  if (m === 'pickup_relay' && pointsRelais.value.length === 0) {
    const res = await api.get('/geo/points-relais');
    pointsRelais.value = res.data;
  }
  if (m === 'home_delivery') {
    await preRemplirAdresseClient();
  }
});

async function passer() {
  errorMsg.value = '';
  processingPay.value = true;
  try {
    const lignes = panier.lignes.map((l) => ({ produit_id: l.produit_id, quantite: l.quantite }));
    const payload = { mode_livraison: mode.value, lignes };
    if (mode.value === 'pickup_store') payload.lieu_id = lieuId.value;
    if (mode.value === 'pickup_relay') payload.relais_id = relaisId.value;
    if (mode.value === 'home_delivery') Object.assign(payload, { adresse: adresse.value, lat: lat.value, lon: lon.value });

    const cmdRes = await api.post('/commandes', payload);
    const commandeId = cmdRes.commande.id;

    const idempotencyKey = `cli-${commandeId}-${Date.now()}`;
    const payRes = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/api'}/paiements`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        methode: 'card_fake',
        commande_id: commandeId,
        numero_carte: carte.value.replace(/\s/g, ''),
      }),
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

        <div v-if="mode === 'pickup_store'" class="detail-mode">
          <label>Lieu de retrait</label>
          <div v-if="loadingLieu" class="loading"><ProgressSpinner style="width: 1.4rem" /></div>
          <div v-else-if="lieuId" class="auto-lieu">
            <strong>{{ lieuNom }}</strong>
            <small>{{ lieuAdresse }}</small>
          </div>
          <Message v-else severity="warn" :closable="false">Aucun lieu de retrait automatique trouvé.</Message>
        </div>
        <div v-else-if="mode === 'pickup_relay'" class="detail-mode">
          <label for="relais">Choisir un point relais</label>
          <Select id="relais" v-model="relaisId" :options="pointsRelais" option-label="nom" option-value="id" placeholder="Sélectionner…" filter />
        </div>
        <div v-else-if="mode === 'home_delivery'" class="detail-mode">
          <label for="adr">Adresse de livraison</label>
          <Textarea id="adr" v-model="adresse" rows="2" />
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
                       || (mode === 'pickup_store' && !lieuId)
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
.mode-card.active { border-color: var(--p-primary-color); background: var(--p-primary-50); }
.mode-card.disabled { opacity: .5; cursor: not-allowed; }
.mode-body { flex: 1; display: flex; flex-direction: column; gap: .3rem; }
.mode-head { display: flex; align-items: center; gap: .5rem; }
.mode-head strong { flex: 1; }
.motif { color: var(--p-red-600); }
.detail-mode { margin-top: 1rem; display: flex; flex-direction: column; gap: .3rem; }
.auto-lieu {
  display: flex;
  flex-direction: column;
  gap: .15rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: .45rem;
  padding: .55rem .65rem;
}
.auto-lieu small { color: var(--p-text-muted-color); }
.form { display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; }
.field { display: flex; flex-direction: column; gap: .3rem; max-width: 20rem; }
.dev-tag { color: var(--p-text-muted-color); font-weight: 400; font-size: .85rem; margin-left: .4rem; }
.port { font-weight: 600; }
</style>
