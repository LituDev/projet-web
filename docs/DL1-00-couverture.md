# Rapport de conception — DL1

## gumes marketplace
### Plateforme de distribution de produits locaux

---

**Module :** Technologies Web (en lien avec le module Bases de données) — IAI1
**Livrable :** DL1 — Rapport de conception
**Date de remise :** mercredi 22 avril 2026 à 12h00
**Date de rédaction :** lundi 20 avril 2026

**Équipe :** les gumes *(5 membres : M1, M2, M3, M4, M5 — noms à compléter)*

**Encadrant :** *à compléter*

---

## Sommaire

| § | Titre | Fichier source |
|---|---|---|
| — | Page de couverture + sommaire | `DL1-00-couverture.md` |
| 1 | Contexte & description de l'application | `DL1-01-contexte.md` |
| 2 | Cas d'utilisation | `DL1-02-cas-utilisation.md` §2 |
| 3 | Scénarios nominaux + scénarios d'erreur | `DL1-02-cas-utilisation.md` §3 |
| 4 | Choix technologiques et justifications | `DL1-04-choix-technologiques.md` |
| 5 | Modèle conceptuel de données (MCD) | `DL1-05-06-mcd-schema-logique.md` §5 |
| 6 | Schéma logique (tables, contraintes, index) | `DL1-05-06-mcd-schema-logique.md` §6 |
| 7 | Vues SQL prévues | `DL1-07-vues-sql.md` |
| 8 | Architecture applicative (SOA, modules) | `DL1-08-architecture.md` |
| 9 | Diagramme de Gantt (4 jours jusqu'à DL2) | `DL1-09-gantt.md` |
| 10 | Répartition des tâches + RACI | `DL1-10-repartition.md` |
| 11 | Risques identifiés + plan de mitigation | `DL1-11-risques.md` |
| — | Annexes : glossaire, références | `DL1-99-annexes.md` |

**Compilation PDF prévue** le 22 avril au matin via :
```
pandoc docs/DL1-*.md -o DL1_gumes-marketplace_les-gumes.pdf \
  --toc --toc-depth=2 --pdf-engine=xelatex \
  -V geometry:margin=2cm -V mainfont="DejaVu Serif" \
  -V monofont="DejaVu Sans Mono" -V colorlinks=true
```
