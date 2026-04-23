#!/usr/bin/env bash
# Télécharge les 12 images de démo (Wikimedia Commons) dans ce dossier.
# Idempotent : saute les fichiers déjà téléchargés ou déjà importés.
# Commons exige un User-Agent identifiant et des requêtes raisonnablement
# espacées — on fait les téléchargements en séquence.

set -euo pipefail
cd "$(dirname "$0")"

UA="gumes-marketplace-dev/1.0 (https://github.com/LituDev/projet-web)"

images=(
  "fraises|https://commons.wikimedia.org/wiki/Special:FilePath/Garden_strawberry_(Fragaria_%C3%97_ananassa)_single2.jpg?width=1200"
  "tomates-anciennes|https://commons.wikimedia.org/wiki/Special:FilePath/Heirloom_tomatoes_at_county_fair.jpg?width=1200"
  "courges-butternut|https://commons.wikimedia.org/wiki/Special:FilePath/Cucurbita_moschata_Butternut_2012_G2.jpg?width=1200"
  "asperges-vertes|https://commons.wikimedia.org/wiki/Special:FilePath/Asparagus-Bundle.jpg?width=1200"
  "pommes-reinette|https://commons.wikimedia.org/wiki/Special:FilePath/Reinette_Grise_du_Canada_apples_2017_A2.jpg?width=1200"
  "miel-toutes-fleurs|https://commons.wikimedia.org/wiki/Special:FilePath/Three_French_monofloral_honey_jars.jpg?width=1200"
  "huile-de-colza|https://commons.wikimedia.org/wiki/Special:FilePath/Huile_de_colza.JPG?width=1200"
  "fromage-de-chevre|https://commons.wikimedia.org/wiki/Special:FilePath/Crottin_02.jpg?width=1200"
  "terrine-de-campagne|https://commons.wikimedia.org/wiki/Special:FilePath/La_Tuili%C3%A8re_-_Montloup_-_Ferme_auberge_Au_pr%C3%A9_de_mon_arbre_-_Terrine_de_campagne.jpg?width=1200"
  "jus-de-pomme|https://commons.wikimedia.org/wiki/Special:FilePath/Apfelsaft_im_Glas.jpg?width=1200"
  "confiture-de-figues|https://commons.wikimedia.org/wiki/Special:FilePath/Confiture_de_figues,_bocaux.jpg?width=1200"
  "pain-au-levain|https://commons.wikimedia.org/wiki/Special:FilePath/Sourdough_Bread_Loaf.jpg?width=1200"
)

downloaded=0
for entry in "${images[@]}"; do
  slug="${entry%%|*}"
  url="${entry#*|}"
  target="${slug}.jpg"

  if [ -f "$target" ]; then
    continue
  fi

  printf '→ %s\n' "$slug"
  curl -fsSL -A "$UA" --retry 3 --retry-delay 2 -o "${target}.tmp" "$url"
  mv "${target}.tmp" "$target"
  downloaded=$((downloaded + 1))
  sleep 0.3
done

if [ "$downloaded" -eq 0 ]; then
  echo "  (rien à télécharger — déjà présent)"
fi
