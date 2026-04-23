<script setup>
import { ref } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { useSessionStore } from '../stores/session.js';

const session = useSessionStore();
const router = useRouter();
const route = useRoute();
const toast = useToast();

const email = ref('');
const password = ref('');
const errorMsg = ref('');
const pending = ref(false);

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

function buildAuthErrorMessage(err) {
  if (err?.status === 401) return 'Email ou mot de passe invalide.';
  if (err?.code === 'validation_error') {
    const message = formatValidationDetails(err.details, {
      email: 'Email',
      password: 'Mot de passe',
    });
    if (message) return message;
  }
  return err?.message || 'Impossible de se connecter pour le moment.';
}

async function submit() {
  errorMsg.value = '';
  pending.value = true;
  try {
    await session.login(email.value, password.value);
    toast.add({ severity: 'success', summary: 'Connecté', life: 2000 });
    router.replace(route.query.redirect || '/');
  } catch (err) {
    const detail = buildAuthErrorMessage(err);
    errorMsg.value = detail;
    toast.add({ severity: 'error', summary: 'Échec de connexion', detail, life: 3500 });
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <Card class="auth-card">
    <template #title>Connexion</template>
    <template #content>
      <form @submit.prevent="submit" class="form">
        <Message v-if="errorMsg" severity="error" :closable="false">{{ errorMsg }}</Message>

        <div class="field">
          <label for="email">Email</label>
          <InputText id="email" v-model="email" type="email" autocomplete="email" required autofocus />
        </div>

        <div class="field">
          <label for="pwd">Mot de passe</label>
          <Password id="pwd" v-model="password" :feedback="false" toggle-mask autocomplete="current-password" required fluid />
        </div>

        <Button type="submit" label="Se connecter" icon="pi pi-sign-in" :loading="pending" />
        <RouterLink to="/mot-de-passe-oublie" class="forgot-link">Mot de passe oublié ?</RouterLink>
      </form>
    </template>
  </Card>
</template>

<style scoped>
.auth-card { max-width: 28rem; margin: 2rem auto; }
.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.forgot-link { font-size: 0.9rem; color: var(--p-text-muted-color); text-decoration: none; align-self: flex-start; }
.forgot-link:hover { color: var(--p-primary-color); }
</style>
