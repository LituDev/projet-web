// Génère une URL d'image pour un produit via LoremFlickr (sans clé API).
// Déterministe : le même produit renvoie toujours la même image grâce au `lock`.

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function toKeywords(nom) {
  return nom
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ',')
    .replace(/^,+|,+$/g, '');
}

export function produitImageUrl(produit, w = 400, h = 300) {
  const kw = toKeywords(produit?.nom || '') || produit?.nature || 'food';
  const seed = produit?.id ? hash(String(produit.id)) : hash(kw);
  return `https://loremflickr.com/${w}/${h}/${encodeURIComponent(kw)}?lock=${seed}`;
}
