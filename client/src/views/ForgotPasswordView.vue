<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { api } from '../services/api.js';

const email = ref('');
const sent = ref(false);
const pending = ref(false);

async function submit() {
  pending.value = true;
  try {
    await api.post('/auth/password-reset/request', { email: email.value });
  } catch {
    // On ne révèle pas si l'email existe ou non
  } finally {
    pending.value = false;
    sent.value = true;
  }
}
</script>

<template>
  <Card class="auth-card">
    <template #title>Mot de passe oublié</template>
    <template #content>
      <div class="form">
        <template v-if="!sent">
          <p class="hint">Saisissez votre adresse email pour recevoir un lien de réinitialisation (valable 15 minutes).</p>
          <div class="field">
            <label for="email">Email</label>
            <InputText id="email" v-model="email" type="email" autofocus required />
          </div>
          <Button label="Envoyer le lien" icon="pi pi-send" :loading="pending" :disabled="!email" @click="submit" />
        </template>
        <Message v-else severity="success" :closable="false">
          Si cet email est associé à un compte, un lien vous a été envoyé. Vérifiez votre boîte mail (ou la console serveur en mode développement).
        </Message>
        <RouterLink to="/connexion" class="back-link">← Retour à la connexion</RouterLink>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.auth-card { max-width: 28rem; margin: 2rem auto; }
.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: .3rem; }
.hint { margin: 0; color: var(--p-text-muted-color); font-size: .95rem; }
.back-link { font-size: .9rem; color: var(--p-text-muted-color); text-decoration: none; }
.back-link:hover { color: var(--p-primary-color); }
</style>
