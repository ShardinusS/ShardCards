# AUDIT — ShardCards (READ-ONLY)

## STACK
- **Type** : PWA statique, sans build, sans framework
- **Front** : HTML + CSS (~2000 l.) + JavaScript vanilla ES Modules (`script.js` ~2240 l., objet monolithe `App`)
- **Persistance** : `localStorage` (offline-first) + IndexedDB (SW notifications)
- **Backend** : Supabase (auth + Postgres via RPC), client UMD vendoré `supabase-umd.js` (187 Ko)
- **PWA** : `service-worker.js` (cache v3, Background Sync, Periodic Sync, Notifications), `manifest.json`
- **Deps** (`package.json`) : `web-push@^3.6.7` (lib **serveur**, aucun serveur dans le repo)
- **Algo** : SM-2 (répétition espacée), maison
- **Tooling** : aucun (pas de lint, test, CI, bundler, `.env`)

## ✅ CE QUI VA
- `storage-manager.js` : architecture offline-first claire (LocalStorage + SyncQueue + LWW), API façade propre
- `script.js:15` `escapeHtml` : appliqué de façon cohérente sur les interpolations `innerHTML` → XSS largement mitigé
- `script.js` (`SM2`, `ColorZones`, `Icons`) : logique métier bien encapsulée en modules d'objets
- `service-worker.js:1-36` : versioning du cache (`flashcards-v3`) + purge des anciens caches à l'`activate`
- ES Modules sans build : déploiement trivial (fichiers statiques)
- Section Statistiques (post-fix) : graphiques SVG natifs, calculs limités aux decks utilisateur

## ❌ CE QUI NE VA PAS
- `supabase-client.js:5-6` | SÉVÉRITÉ: P1 | Clés Supabase en dur + sécurité reposant **entièrement** sur RLS non vérifiable depuis le repo
- `service-worker.js:110-193,401-407,450-456` | SÉVÉRITÉ: P1 | Multiplicité des déclencheurs (setInterval 120s + 3 sync + periodicSync + Scheduling API) → risque de notifications dupliquées/incohérentes selon navigateur
- `service-worker.js:65-74` | SÉVÉRITÉ: P1 | Stratégie cache-first sur `script.js`/`style.css` : sans bump de `CACHE_NAME`, les clients reçoivent du JS/CSS périmé
- `storage-manager.js:30-32` | SÉVÉRITÉ: P2 | `alert()` natif pour quota plein (UX incohérente avec les toasts du reste de l'app)
- `script.js` (images base64 en `localStorage`) | SÉVÉRITÉ: P2 | Stockage d'images en base64 → saturation rapide du quota (~5–10 Mo)
- `index.html:106-111` + `script.js:946` | SÉVÉRITÉ: P2 | Code mort : `#notification-toast` jamais câblé, `showModal()` jamais appelé
- `package.json:6-8` | SÉVÉRITÉ: P2 | Dépendance `web-push` (serveur) inutile côté client, trompeuse
- `script.js` (2240 l., objet `App` unique) | SÉVÉRITÉ: P2 | Monolithe : faible testabilité, couplage fort vues/état/IO
- `supabase-umd.js` (vendoré, 187 Ko) | SÉVÉRITÉ: P2 | Lib tierce committée sans pin de version ni SRI
- `manifest.json:11-18` | SÉVÉRITÉ: P2 | Une seule icône 1024 px, aucune taille intermédiaire ni screenshot (installabilité dégradée)
- Repo global | SÉVÉRITÉ: P2 | Aucun test ni lint ni CI

## 🔧 PLAN D'ACTION ORDONNÉ

### TICKET-001 | P1 | Sécuriser l'accès Supabase (RLS + config clés)
- Fichiers : `supabase-client.js`
- Problème : la sécurité des données dépend de policies RLS non vérifiables ; clés en dur dans le source.
- Solution :
  1. Vérifier côté Supabase que RLS est **activé** sur `decks`/`cards` + storage `card-images`, policies `auth.uid() = user_id` en lecture ET écriture.
  2. Confirmer que `SUPABASE_ANON_KEY` est bien une clé *publishable* (préfixe `sb_publishable_`) — sinon la révoquer.
  3. Externaliser `SUPABASE_URL`/`KEY` dans un objet `window.__CONFIG__` injecté (fichier `config.js` non versionné) plutôt qu'en dur.
  4. Documenter les policies attendues en commentaire d'en-tête.
- Effort : S

### TICKET-002 | P1 | Fiabiliser le déclenchement des notifications
- Fichiers : `service-worker.js`
- Problème : sources de déclenchement redondantes pouvant produire doublons ou rappels au mauvais moment.
- Solution :
  1. Centraliser l'émission dans une seule fonction gardée par `recentNotifications` (clé `deckId+reminderId`, fenêtre = `intervalMinutes`).
  2. Supprimer les enregistrements de sync redondants `check-notifications-backup-1/2` (l.403-404).
  3. Garantir l'exclusivité Scheduling API **vs** chemin IndexedDB (ne pas réafficher une notif déjà déclenchée par `showTrigger`).
  4. Vérifier que toute notif affichée reprogramme `nextNotification` avant le prochain `checkScheduledNotifications`.
- Effort : M

### TICKET-003 | P1 | Stratégie de cache : assets versionnés
- Fichiers : `service-worker.js`
- Problème : `script.js`/`style.css` servis en cache-first → mises à jour invisibles sans bump manuel.
- Solution :
  1. Passer les assets app (`script.js`, `style.css`) en **stale-while-revalidate** (servir cache + refetch + maj cache).
  2. OU bumper `CACHE_NAME` à chaque release (documenter le process).
  3. Conserver cache-first pour les ressources immuables (icône).
- Effort : S

### TICKET-004 | P2 | Nettoyer le code mort & dépendances
- Fichiers : `index.html`, `script.js`, `package.json`
- Problème : éléments/fonctions/deps inutilisés alourdissent la maintenance.
- Solution :
  1. Supprimer `#notification-toast` (`index.html:106-111`) et `showModal()` (`script.js:946`) si confirmés inutilisés (grep préalable).
  2. Retirer `web-push` de `package.json` (ou créer un dossier `server/` si un backend existe ailleurs).
- Effort : XS

### TICKET-005 | P2 | UX quota & gestion des images
- Fichiers : `storage-manager.js`, `script.js`
- Problème : `alert()` natif ; images base64 saturent `localStorage`.
- Solution :
  1. Remplacer `alert()` (`storage-manager.js:31`) par `App.showToast(..., 'error')` via callback/event (éviter le couplage direct).
  2. Pour les utilisateurs connectés, n'écrire en local que l'URL Supabase de l'image (déjà gérée par `uploadImage`) au lieu du base64.
  3. Abaisser le plafond de compression (`compressImage`) et avertir au-delà d'un seuil.
- Effort : M

### TICKET-006 | P2 | Durcir l'intégration Supabase UMD
- Fichiers : `index.html`, `supabase-umd.js`
- Problème : lib tierce committée sans intégrité ni traçabilité de version.
- Solution :
  1. Noter la version exacte de `@supabase/supabase-js` en tête de `supabase-umd.js`.
  2. Ajouter un attribut `integrity` (SRI) au `<script>` (`index.html:316`) si servi depuis CDN, sinon documenter le hash.
- Effort : XS

### TICKET-007 | P2 | Améliorer l'installabilité PWA
- Fichiers : `manifest.json`
- Problème : une seule icône, pas de screenshots → install/qualité dégradée.
- Solution :
  1. Générer icônes 192/512 px (`any`) + 512 px `maskable` dédiée.
  2. Ajouter 1–2 `screenshots` (form_factor narrow/wide).
- Effort : S

### TICKET-008 | P2 | Mettre en place un socle qualité
- Fichiers : `package.json` (+ nouveaux fichiers de config)
- Problème : aucun garde-fou automatisé.
- Solution :
  1. Ajouter ESLint (config plate) + scripts `lint`.
  2. Tests unitaires ciblés sur `SM2`, `_mergeDecks`, helpers de dates/charts (Vitest, sans toucher au runtime).
  3. CI minimale (lint + test) sur push.
- Effort : M

## INSTRUCTIONS POUR SONNET
Exécute les tickets dans l'ordre P0 → P1 → P2.
Pour chaque ticket : lis @fichier cible → applique → teste → passe au suivant.
Ne modifie que les fichiers listés dans chaque ticket.
