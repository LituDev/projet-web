<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
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

async function submit() {
  errorMsg.value = '';
  pending.value = true;
  try {
    await session.login(email.value, password.value);
    toast.add({ severity: 'success', summary: 'Connecté', life: 2000 });
    router.replace(route.query.redirect || '/');
  } catch (err) {
    errorMsg.value = err.message;
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
      </form>
    </template>
  </Card>
</template>

<style scoped>
.auth-card { max-width: 28rem; margin: 2rem auto; }
.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
</style>
