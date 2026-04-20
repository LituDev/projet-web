# DL1 — §10 Répartition des tâches

5 membres. Tâches priorisées **P0** (critique DL2), **P1** (important), **P2** (bonus).

> Les identifiants `M1`…`M5` sont à remplacer par les prénoms réels avant impression du PDF final.

## 10.1 Rôles principaux

| Membre | Rôle principal | Rôle secondaire |
|---|---|---|
| **M1 — Lead tech / Rapport** | coordination, module `auth`, compilation rapport, zip DL2 | relecture code |
| **M2 — Back DB / commandes** | docker-compose, migrations, catalogue, commandes, OpenAPI | dump SQL |
| **M3 — Back paiement / géo / admin** | paiement simulé, géo+PostGIS, alertes, admin, audit, seeds | tests e2e |
| **M4 — Front core / checkout** | bootstrap Vue+PrimeVue, routing, Pinia, auth pages, checkout, seller pages, audit Lighthouse+a11y | — |
| **M5 — Front catalogue / carte / PWA** | catalogue, fiche, carte Leaflet, liste de courses, Worker trajet, pages admin, PWA+Service Worker+IndexedDB | tests e2e |

## 10.2 Tableau détaillé des tâches

| # | Tâche | Module | Prio | Membre | Estimation | Jour |
|---|---|---|---|---|---|---|
| 1 | Cas d'utilisation + scénarios (§2, §3) | rapport | P0 | M1 | 3h | lun |
| 2 | Choix technos (§4) | rapport | P0 | M1 | 2h | lun |
| 3 | MCD + schéma logique (§5, §6) | rapport | P0 | **tous** | 4h | lun |
| 4 | Vues SQL (§7) | rapport | P0 | M2 | 2h | lun-mar |
| 5 | Architecture applicative (§8) | rapport | P0 | M1 | 2h | lun |
| 6 | Gantt + répartition (§9, §10) | rapport | P0 | M1 | 1h | lun |
| 7 | Risques (§11) + couverture + §1 | rapport | P0 | M1 | 1h | lun |
| 8 | Compilation rapport PDF | rapport | P0 | M1 | 1h | mer AM |
| 9 | docker-compose.yml + .env.example | infra | P0 | M2 | 1h | lun |
| 10 | Migration initiale (tables + CHECK + FK) | db | P0 | M2 | 3h | lun-mar |
| 11 | Migration vues SQL | db | P0 | M2 | 1h | mar |
| 12 | Seed faker-js (10 prod × 5 prod × 5 lieux, 30 clients, 50 cmd, 10 relais) | db | P0 | M3 | 4h | mar |
| 13 | Bootstrap Express + helmet + sessions | back | P0 | M1 | 2h | mar AM |
| 14 | Module auth (register, login, logout, middlewares) | back | P0 | M1 | 4h | mar |
| 15 | Rate-limit + CSRF + validation zod | back | P0 | M1 | 1h | mar |
| 16 | Module catalogue (/api/produits CRUD) | back | P0 | M2 | 3h | mer |
| 17 | Module commandes (/api/commandes + /quote) | back | P0 | M2 | 4h | mer-jeu |
| 18 | Module paiement simulé (+ idempotence) | back | P0 | M3 | 3h | jeu AM |
| 19 | Module géo (/api/geo/lieux + /itineraire) | back | P0 | M3 | 3h | jeu |
| 20 | Module alertes + admin + audit | back | P1 | M3 | 2h | jeu |
| 21 | OpenAPI / Swagger UI | back | P1 | M2 | 1h | jeu |
| 22 | Bootstrap Vue + Vite + PrimeVue + thème Aura | front | P0 | M4 | 2h | mar AM |
| 23 | vue-router + Pinia + guards par rôle | front | P0 | M4 | 2h | mar |
| 24 | Pages Login / Register / Compte | front | P0 | M4 | 2h | mar |
| 25 | Page Catalogue (DataView PrimeVue) + recherche | front | P0 | M5 | 3h | mer |
| 26 | Page Fiche produit + fiche producteur | front | P0 | M5 | 2h | mer |
| 27 | Page Carte (Leaflet + marqueurs lieux/relais) | front | P0 | M5 | 3h | mer |
| 28 | Page Panier + Checkout + mode livraison | front | P0 | M4 | 3h | jeu AM |
| 29 | `<FakeCardForm>` + flux paiement | front | P0 | M4 | 2h | jeu AM |
| 30 | Pages Seller (dashboard, CRUD entreprise/lieu/produit) | front | P0 | M4 | 4h | jeu |
| 31 | Pages Admin (users, modération, alertes, audit) | front | P0 | M5 | 3h | jeu |
| 32 | Liste de courses + Web Worker trajet optimisé | front | P0 | M5 | 4h | jeu |
| 33 | PWA manifest + Service Worker + IndexedDB sync | front | P2 | M5 | 3h | ven AM |
| 34 | Accessibilité (a11y : labels, focus, contraste) | front | P1 | M4 | 2h | ven AM |
| 35 | Locale FR + Intl format EUR / dates | front | P1 | M4 | 1h | ven AM |
| 36 | 4 scénarios e2e Selenium | qa | P1 | M3+M5 | 3h | ven AM |
| 37 | Audit Lighthouse + correctifs | qa | P1 | M4 | 1h | ven AM |
| 38 | README + procédure install + comptes de test | livrable | P0 | M1 | 1h | ven AM |
| 39 | Dump SQL + archive `DL2_*.zip` | livrable | P0 | M2+M1 | 0.5h | ven midi |
| 40 | Slides démo + répétition | livrable | P0 | **tous** | 1h | ven PM |

Total charge estimée : ~88 h répartis sur 5 personnes × ~18h utiles = **90 h budget** → marge de 2 h seulement. Pression élevée.

## 10.3 Matrice RACI synthétique

| Activité | M1 | M2 | M3 | M4 | M5 |
|---|---|---|---|---|---|
| Rapport DL1 | **R/A** | C | C | C | C |
| Schéma DB | C | **R/A** | C | I | I |
| Seeds | I | C | **R/A** | I | I |
| Auth | **R/A** | C | I | C | I |
| Catalogue back | I | **R/A** | I | I | C |
| Commandes / paiement back | C | **R** | **R** | I | I |
| Géo back | I | C | **R/A** | I | I |
| Front core + seller + checkout | I | I | I | **R/A** | C |
| Front catalogue/carte/admin/PWA | I | I | I | C | **R/A** |
| Tests e2e | I | I | **R** | C | **R** |
| README + livraison | **R/A** | C | I | I | I |

Légende : **R** Réalise · **A** Approuve · C Consulté · I Informé.

## 10.4 Rituel agile

- **Daily stand-up** 9h30, 15 min, trois questions classiques.
- **Sprint = 1 jour**, revue en fin de journée (18h), sprint planning le lendemain matin à 9h30.
- **Board Kanban** (Trello ou équivalent) : colonnes `Backlog / Sprint / Doing / Review / Done` — une carte par ligne du tableau §10.2.
- **Gate** : aucune carte ne passe en *Done* sans qu'un autre membre l'ait validée (revue croisée 5 min).

---

*Équipe les gumes — 2026-04-20.*
