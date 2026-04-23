<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import Card from 'primevue/card';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { api } from '../services/api.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const token = route.query.token ?? '';
const password = ref('');
const confirmPwd = ref('');
const pending = ref(false);
const error = ref('');
const success = ref(false);

const mismatch = computed(() => confirmPwd.value && password.value !== confirmPwd.value);
const canSubmit = computed(() => password.value.length >= 10 && confirmPwd.value && !mismatch.value);

async function submit() {
  error.value = '';
  pending.value = true;
  try {
    await api.post('/auth/password-reset/confirm', { token, password: password.value });
    success.value = true;
    toast.add({ severity: 'success', summary: 'Mot de passe mis à jour', life: 3000 });
    setTimeout(() => router.push('/connexion'), 2500);
  } catch (e) {
    error.value = e.message;
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <Card class="auth-card">
    <template #title>Nouveau mot de passe</template>
    <template #content>
      <div v-if="!token" class="form">
        <Message severity="error" :closable="false">
          Lien invalide ou manquant.
          <RouterLink to="/mot-de-passe-oublie"> Demandez un nouveau lien.</RouterLink>
        </Message>
      </div>
      <div v-else-if="success" class="form">
        <Message severity="success" :closable="false">
          Mot de passe mis à jour ! Redirection vers la connexion…
        </Message>
      </div>
      <div v-else class="form">
        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <div class="field">
          <label for="pwd">Nouveau mot de passe (10 caractères min.)</label>
          <Password id="pwd" v-model="password" toggle-mask fluid />
        </div>
        <div class="field">
          <label for="confirm">Confirmer le mot de passe</label>
          <Password id="confirm" v-model="confirmPwd" :feedback="false" toggle-mask fluid />
          <small v-if="mismatch" class="err">Les mots de passe ne correspondent pas.</small>
        </div>
        <Button label="Mettre à jour" icon="pi pi-check" :loading="pending" :disabled="!canSubmit" @click="submit" />
      </div>
    </template>
  </Card>
</template>

<style scoped>
.auth-card { max-width: 28rem; margin: 2rem auto; }
.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: .3rem; }
.err { color: var(--p-red-500); font-size: .85rem; }
</style>
