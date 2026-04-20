// Distance haversine en mètres entre deux (lat, lon).
function haversineM(a, b) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s1 = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1));
}

function tourLength(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += haversineM(points[i], points[i + 1]);
  return total;
}

// Nearest-neighbor à partir d'un point de départ imposé.
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

// 2-opt : tente d'inverser des sous-segments tant qu'on raccourcit le trajet.
// On garde le point 0 (départ) en place.
function twoOpt(tour) {
  let improved = true;
  let best = [...tour];
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

export function optimiserItineraire({ depart, etapes }) {
  const nn = nearestNeighbor(depart, etapes);
  const opt = twoOpt(nn);
  return {
    ordre: opt,
    distance_m: Math.round(tourLength(opt)),
    algo: 'nearest-neighbor + 2-opt',
  };
}
