# DL1 — §9 Diagramme de Gantt

**Période :** lundi 20 avril → vendredi 24 avril 2026 (5 jours ouvrés).
**Jalons :** DL1 mer. 22 avril 12h · DL2 ven. 24 avril 13h · DL3 ven. 24 avril (démo).

Méthode agile : sprints d'une journée, daily stand-up de 15 min à 9h30.

> **Convention** : `M1`…`M5` = 5 membres de l'équipe les gumes. Les noms réels seront substitués avant impression du rapport.

## 9.1 Gantt global (Mermaid)

```mermaid
gantt
    title Planning gumes marketplace — 5 jours ouvrés
    dateFormat  YYYY-MM-DD
    axisFormat  %a %d/%m

    section Jalons
    DL1 rapport (12h)          :milestone, m1, 2026-04-22, 0d
    DL2 code + dump (13h)      :milestone, m2, 2026-04-24, 0d
    DL3 démo                   :milestone, m3, 2026-04-24, 0d

    section Conception / DL1
    Cas d'utilisation (M1)             :done,    ucases, 2026-04-20, 1d
    Choix technologiques (M1)          :done,    tech,   2026-04-20, 1d
    MCD + schéma logique (tous)        :active,  mcd,    2026-04-20, 2d
    Vues SQL (M2)                      :active,  vues,   2026-04-21, 1d
    Architecture applicative (M1)      :done,    arch,   2026-04-20, 1d
    Gantt + répartition (M1)           :         org,    2026-04-20, 1d
    Rapport PDF compilation (M1)       :         rapport,2026-04-22, 0.5d

    section Infra / DB
    docker-compose + PostGIS (M2)      :         infra,  2026-04-20, 0.5d
    Migration initiale (M2)            :         mig,    after infra, 0.5d
    Seeds faker-js (M3)                :         seeds,  after mig, 1d
    Dump SQL (M2)                      :         dump,   2026-04-24, 0.25d

    section Back-end
    Bootstrap Express + sessions (M1)  :         backbase,2026-04-21, 0.5d
    Module auth + middlewares (M1)     :         auth,   after backbase, 0.5d
    Module catalogue + produits (M2)   :         cata,   2026-04-22, 1d
    Module commandes + quote (M2)      :         cmd,    after cata, 0.5d
    Module paiement simulé (M3)        :         pay,    2026-04-23, 0.5d
    Module géo + trajet (M3)           :         geo,    2026-04-23, 0.5d
    Module alertes + admin + audit (M3):         admin,  2026-04-23, 0.5d
    OpenAPI Swagger UI (M2)            :         swagger,2026-04-23, 0.25d

    section Front-end
    Bootstrap Vue + PrimeVue (M4)      :         front,  2026-04-21, 0.5d
    Routing + Pinia + auth pages (M4)  :         routing,after front, 0.5d
    Pages catalogue + fiche + carte (M5):        catfr,  2026-04-22, 1d
    Pages panier + checkout + paiement (M4):     checkout,2026-04-23, 0.5d
    Pages seller (dashboard, CRUD) (M4):         seller, 2026-04-23, 0.5d
    Pages admin (M5)                   :         adminfr,2026-04-23, 0.5d
    Liste de courses + Worker trajet (M5):       trajet, 2026-04-23, 0.5d
    PWA + Service Worker + IndexedDB (M5):       pwa,    2026-04-24, 0.5d

    section Qualité / Livrables
    Tests e2e Selenium (M3 + M5)       :         e2e,    2026-04-24, 0.5d
    Audit Lighthouse + a11y (M4)       :         audit,  2026-04-24, 0.25d
    README + procédure install (M1)    :         readme, 2026-04-24, 0.25d
    Archive DL2 .zip (M1)              :         zip,    2026-04-24, 0.1d
    Préparation démo (tous)            :         demo,   2026-04-24, 0.5d
```

## 9.2 Vue quotidienne

### Lundi 20 avril (jour 1 — cadrage & DL1)
- 9h00 : kickoff, choix membre/rôle, point sur les deadlines.
- 9h30-12h : M1 rédige §2 cas d'utilisation + §4 choix technos ; M2 lit la doc PostgreSQL+PostGIS et monte le `docker-compose.yml` ; M3 prépare le seed faker ; M4/M5 bootstrappent les projets Vue + Express en squelette.
- 14h-18h : tous sur le MCD + schéma logique (séance commune). Relecture collective.
- **Fin de journée attendue** : §2, §3, §4, §5, §6, §7, §8 du rapport rédigés.

### Mardi 21 avril (jour 2 — implémentation DB + backend socle)
- 9h30 : daily.
- Matin : M2 joue la migration initiale `1_init.sql` ; M3 écrit les seeds (10 producteurs × 5 produits × 5 lieux + 10 points relais + 30 clients + 50 commandes) ; M1 code le module `auth` ; M4 code le routing Vue + stores.
- Après-midi : M1 termine `auth` + middlewares `requireAuth/Role` ; M4 connecte le front à `/api/auth/*` ; M2 démarre `/api/produits`.
- **Fin de journée** : inscription / connexion fonctionnelles bout en bout.

### Mercredi 22 avril (jour 3 — DL1 12h + suite dev)
- 9h30 : daily.
- 9h30-11h30 : M1 compile le rapport PDF final (assemblage des `.md` → PDF via pandoc + template), tous relisent, corrections, export PDF.
- **11h45 : dépôt DL1** (5 min avant 12h, avec marge).
- Après-midi : M2 finit `/api/produits` + démarre `/api/commandes`; M3 code `/api/paiements` simulé ; M4 code panier + checkout ; M5 code catalogue + fiche produit + carte Leaflet.
- **Fin de journée** : on peut parcourir le catalogue et ajouter au panier.

### Jeudi 23 avril (jour 4 — features métier)
- 9h30 : daily.
- Matin : M2 termine `/api/commandes/quote` avec règles de livraison ; M3 finit paiement simulé + module géo (trajet) ; M4 code pages seller (dashboard, CRUD entreprise/lieu/produit) ; M5 code pages admin + liste de courses + Worker trajet.
- Après-midi : M2 attaque OpenAPI/Swagger ; M3 termine alertes + admin + audit ; M4 stabilise le checkout ; M5 intègre Leaflet + optimisation de parcours.
- **Fin de journée** : scénarios nominaux de la démo tous fonctionnels.

### Vendredi 24 avril (jour 5 — livraison DL2 13h + démo)
- 8h30 : daily + triage bugs.
- 8h30-11h30 : M5 boucle PWA + Service Worker ; M3 & M5 écrivent les tests e2e Selenium (4 scénarios clés) ; M4 audit Lighthouse + correctifs a11y ; M1 rédige le README + procédure d'installation + `dump.sql` + zip.
- **12h50 : dépôt DL2** (10 min de marge avant 13h).
- 14h-15h : répétition démo (tous), préparation des slides.
- **15h ou créneau imposé : DL3 démonstration** (10 min).

## 9.3 Risques de planning (voir §11 pour la liste complète)

| Risque | Mitigation planning |
|---|---|
| Retard sur `paiement` simulé | Le module est isolé, peut être mocké pour la démo si besoin. |
| Bugs Selenium en fin de semaine | Écrire les tests AU FUR ET À MESURE et pas le vendredi. |
| Conflit de merge Git | … pas de Git retenu pour l'instant — partage via clé USB / dossier réseau. Risque élevé, à re-évaluer. |
| Nominatim rate-limit dépassé | Géocodage en batch pendant le seed, résultats en base, pas d'appel live en démo. |

---

*Équipe les gumes — 2026-04-20.*
