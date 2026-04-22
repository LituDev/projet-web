<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';
import SelectButton from 'primevue/selectbutton';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import { useSessionStore } from '../stores/session.js';

const session = useSessionStore();
const router = useRouter();
const toast = useToast();

const role = ref('user');
const email = ref('');
const password = ref('');
const nom = ref('');
const prenom = ref('');
const tel = ref('');
const adresse = ref('');
const errorMsg = ref('');
const pending = ref(false);

const roleOptions = [
  { label: 'Je suis client', value: 'user' },
  { label: 'Je suis producteur', value: 'seller' },
];

function formatValidationDetails(details, labels = {}) {
  if (!details || typeof details !== 'object') return '';
  const chunks = [];
  for (const [field, messages] of Object.entries(details)) {
    if (!Array.isArray(messages) || messages.length === 0) continue;
    const label = labels[field] ?? field;
    chunks.push(`${label}: ${messages[0]}`);
  }
  return chunks.join(' ');
}

function buildRegisterErrorMessage(err) {
  if (err?.status === 409) return 'Un compte existe déjà avec cet email.';
  if (err?.code === 'validation_error') {
    const message = formatValidationDetails(err.details, {
      email: 'Email',
      password: 'Mot de passe',
      nom: 'Nom',
      prenom: 'Prénom',
      tel: 'Téléphone',
      adresse: 'Adresse',
      role: 'Rôle',
    });
    if (message) return message;
  }
  return err?.message || "Impossible de créer le compte pour le moment.";
}

async function submit() {
  errorMsg.value = '';
  pending.value = true;
  try {
    const payload = { role: role.value, email: email.value, password: password.value, nom: nom.value, prenom: prenom.value, tel: tel.value };
    if (role.value === 'user') payload.adresse = adresse.value;
    await session.register(payload);
    toast.add({ severity: 'success', summary: 'Compte créé', life: 2000 });
    router.replace('/');
  } catch (err) {
    const detail = buildRegisterErrorMessage(err);
    errorMsg.value = detail;
    toast.add({ severity: 'error', summary: 'Échec de l\'inscription', detail, life: 4000 });
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <Card class="auth-card">
    <template #title>Créer un compte</template>
    <template #content>
      <form @submit.prevent="submit" class="form">
        <Message v-if="errorMsg" severity="error" :closable="false">{{ errorMsg }}</Message>

        <SelectButton v-model="role" :options="roleOptions" option-label="label" option-value="value" />

        <div class="grid">
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
          <label for="email">Email</label>
          <InputText id="email" v-model="email" type="email" autocomplete="email" required />
        </div>

        <div class="field">
          <label for="pwd">Mot de passe (10 caractères min.)</label>
          <Password id="pwd" v-model="password" toggle-mask autocomplete="new-password" required fluid />
        </div>

        <div class="field">
          <label for="tel">Téléphone</label>
          <InputText id="tel" v-model="tel" required placeholder="+33 6 12 34 56 78" />
        </div>

        <div v-if="role === 'user'" class="field">
          <label for="adresse">Adresse de livraison</label>
          <Textarea id="adresse" v-model="adresse" rows="2" required />
        </div>

        <Button type="submit" label="Créer le compte" icon="pi pi-user-plus" :loading="pending" />
      </form>
    </template>
  </Card>
</template>

<style scoped>
.auth-card { max-width: 32rem; margin: 2rem auto; }
.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
</style>
