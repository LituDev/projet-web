import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import DialogService from 'primevue/dialogservice';

import 'primeicons/primeicons.css';
import './style.css';

import App from './App.vue';
import router from './router/index.js';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.app-dark',
      cssLayer: { name: 'primevue', order: 'primevue' },
    },
  },
  ripple: true,
  locale: {
    accept: 'Oui',
    reject: 'Non',
    choose: 'Choisir',
    upload: 'Téléverser',
    cancel: 'Annuler',
    close: 'Fermer',
    completed: 'Terminé',
    pending: 'En attente',
    dayNames: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    dayNamesShort: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
    dayNamesMin: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
    monthNames: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    monthNamesShort: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin',
                      'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
    today: "Aujourd'hui",
    clear: 'Effacer',
    weekHeader: 'Sem',
    emptyMessage: 'Aucun résultat',
    emptyFilterMessage: 'Aucun résultat après filtrage',
    searchMessage: '{0} résultats disponibles',
  },
});
app.use(ToastService);
app.use(ConfirmationService);
app.use(DialogService);

app.mount('#app');
