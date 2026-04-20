// Web Worker : optimisation de parcours nearest-neighbor + 2-opt.
// Totalement hors du thread principal pour ne pas geler l'UI.
//
// Protocole :
//   postMessage({ depart: {lat, lon, id}, etapes: [{id, lat, lon}, …] })
//   -> postMessage({ ordre: [...], distance_m: int, algo: 'nn+2opt' })

function haversineM(a, b) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function tourLength(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += haversineM(points[i], points[i + 1]);
  return total;
}

function nearestNeighbor(depart, etapes) {
  const restant = [...etapes];
  const ordre = [depart];
  let cur = depart;
  while (restant.length > 0) {
    let best = 0;
    let bestD = Infinity;
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
        const a = best[i - 1]; const b = best[i];
        const c = best[j];     const d = best[j + 1];
        const delta = haversineM(a, c) + haversineM(b, d) - haversineM(a, b) - haversineM(c, d);
        if (delta < -0.5) {
          const slice = best.slice(i, j + 1).reverse();
          best = [...best.slice(0, i), ...slice, ...best.slice(j + 1)];
          improved = true;
        }
      }
    }
  }
  return best;
}

self.addEventListener('message', (e) => {
  const { depart, etapes } = e.data;
  const nn = nearestNeighbor(depart, etapes);
  const opt = twoOpt(nn);
  self.postMessage({
    ordre: opt,
    distance_m: Math.round(tourLength(opt)),
    algo: 'nn+2opt',
  });
});
