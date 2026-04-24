// URL d'image produit servie par l'API (/api/images/:w/:h/:produitId).
// Le serveur renvoie l'original redimensionné en WebP, ou un placeholder
// si le produit n'a pas encore d'image.

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
const PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000000';

export function produitImageUrl(produit, w = 400, h = 260) {
  const id = produit?.id || PLACEHOLDER_ID;
  return `${API_BASE}/images/${w}/${h}/${id}`;
}
