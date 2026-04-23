<script setup>
import { ref, watch, onMounted } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Message from 'primevue/message';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';
import { api } from '../../services/api.js';
import { useSessionStore } from '../../stores/session.js';

const session = useSessionStore();
const confirm = useConfirm();
const toast = useToast();
const router = useRouter();

const prenom = ref('');
const nom = ref('');
const tel = ref('');
const adresse = ref('');
const profilePending = ref(false);
const profileError = ref('');

const resetPending = ref(false);
const resetSent = ref(false);

onMounted(() => session.fetchMe());

watch(
  () => session.user,
  (u) => {
    if (!u) return;
    prenom.value = u.prenom ?? '';
    nom.value = u.nom ?? '';
    tel.value = u.tel ?? '';
    adresse.value = u.adresse ?? '';
  },
  { immediate: true },
);

async function saveProfile() {
  profileError.value = '';
  profilePending.value = true;
  try {
    const body = { prenom: prenom.value, nom: nom.value, tel: tel.value };
    if (session.user?.role === 'user') body.adresse = adresse.value;
    await api.patch('/auth/me/profile', body);
    await session.fetchMe();
    toast.add({ severity: 'success', summary: 'Profil mis à jour', life: 2500 });
  } catch (e) {
    profileError.value = e.message;
  } finally {
    profilePending.value = false;
  }
}

async function sendResetLink() {
  resetPending.value = true;
  try {
    await api.post('/auth/password-reset/request', { email: session.user.email });
    resetSent.value = true;
    toast.add({ severity: 'info', summary: 'Lien envoyé', detail: 'Vérifiez votre boîte mail (ou la console serveur en mode dev).', life: 5000 });
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible d\'envoyer le lien.', life: 3000 });
  } finally {
    resetPending.value = false;
  }
}

function supprimerCompte() {
  confirm.require({
    header: 'Supprimer mon compte',
    message: "Cette action est irréversible. Votre email sera anonymisé et vous ne pourrez plus vous reconnecter. Confirmer ?",
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer définitivement',
    rejectLabel: 'Annuler',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.del('/auth/me');
        session.user = null;
        toast.add({ severity: 'info', summary: 'Compte supprimé', life: 3000 });
        router.push('/');
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Erreur', detail: e.message, life: 3000 });
      }
    },
  });
}
</script>

<template>
  <h2>Mon compte</h2>

  <Card v-if="session.user" class="section">
    <template #title>Informations du profil</template>
    <template #content>
      <Message v-if="profileError" severity="error" :closable="false">{{ profileError }}</Message>
      <form class="form" @submit.prevent="saveProfile">
        <div class="row">
          <div class="field">
            <label for="prenom">Prénom</label>
            <InputText id="prenom" v-model="prenom" required />
          </div>
          <div class="field">
            <label for="nom">Nom</label>
            <InputText id="nom" v-model="nom" required />
          </div>
        </div>
        <div class="field">
          <label for="email-ro">Email</label>
          <InputText id="email-ro" :value="session.user.email" readonly disabled />
        </div>
        <div class="field">
          <label for="tel">Téléphone</label>
          <InputText id="tel" v-model="tel" type="tel" required />
        </div>
        <div v-if="session.user.role === 'user'" class="field">
          <label for="adresse">Adresse</label>
          <Textarea id="adresse" v-model="adresse" rows="2" auto-resize />
        </div>
        <Button type="submit" label="Enregistrer" icon="pi pi-check" :loading="profilePending" />
      </form>
    </template>
  </Card>

  <Card class="section">
    <template #title>Mot de passe</template>
    <template #content>
      <p class="hint">Un lien de réinitialisation sera envoyé à votre adresse email.</p>
      <Message v-if="resetSent" severity="success" :closable="false">
        Lien envoyé ! Vérifiez votre boîte mail (ou la console serveur en mode développement).
      </Message>
      <Button v-else label="Changer mon mot de passe" icon="pi pi-envelope" outlined :loading="resetPending" @click="sendResetLink" />
    </template>
  </Card>

  <Card class="danger-zone">
    <template #title><span class="danger-title">Zone dangereuse</span></template>
    <template #content>
      <p>La suppression de votre compte est définitive. Vos commandes passées restent dans l'historique des producteurs mais votre email est anonymisé.</p>
      <Button label="Supprimer mon compte" icon="pi pi-trash" severity="danger" outlined @click="supprimerCompte" />
    </template>
  </Card>
</template>

<style scoped>
.section { margin-bottom: 1rem; }
.form { display: flex; flex-direction: column; gap: 1rem; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.hint { margin: 0 0 0.75rem; color: var(--p-text-muted-color); font-size: 0.95rem; }
.danger-zone { border: 1px solid var(--p-red-200); }
.danger-title { color: var(--p-red-600); }
</style>
