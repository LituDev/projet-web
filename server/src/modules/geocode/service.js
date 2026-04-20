import { config } from '../../config.js';
import { logger } from '../../logger.js';

// Nominatim exige un rate-limit de 1 req/s et un User-Agent identifiant l'app.
// On sérialise les appels via une chaîne de promesses pour respecter la contrainte
// même sous charge concurrente.

const MIN_INTERVAL_MS = 1100;
let chain = Promise.resolve();

async function spaced(fn) {
  const runner = async () => {
    try { return await fn(); }
    finally {
      await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS));
    }
  };
  const next = chain.then(runner, runner);
  chain = next.catch(() => {});
  return next;
}

/**
 * Géocode une adresse texte via Nominatim. Retourne null si échec (timeout, 0 résultat).
 */
export async function geocodeAddress(adresse) {
  if (!adresse || adresse.length < 5) return null;
  return spaced(async () => {
    const url = new URL('/search', config.NOMINATIM_BASE_URL);
    url.searchParams.set('q', adresse);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'fr');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': config.NOMINATIM_USER_AGENT, 'Accept-Language': 'fr' },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        logger.warn({ status: res.status, adresse }, 'Nominatim : réponse non-OK');
        return null;
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const { lat, lon } = data[0];
      const latN = Number(lat);
      const lonN = Number(lon);
      if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return null;
      return { lat: latN, lon: lonN };
    } catch (err) {
      if (err.name === 'AbortError') {
        logger.warn({ adresse }, 'Nominatim : timeout');
      } else {
        logger.warn({ err: err.message, adresse }, 'Nominatim : erreur');
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  });
}
