# ShardCards

<div align="center">
  <img src="icon-1024.png" alt="ShardCards" width="64">
  <br>
  <strong>Application de flashcards PWA, gratuite et illimitée</strong>
  <br><br>
  <a href="https://web.dev/progressive-web-apps/"><img alt="PWA" src="https://img.shields.io/badge/PWA-Ready-blue"></a>
  <a href="https://web.dev/offline/"><img alt="Offline" src="https://img.shields.io/badge/Offline-Supported-green"></a>
  <br><br>
  <a href="https://shardinuss.github.io/ShardCards"><strong>Essayer l'application →</strong></a>
</div>

---

## Apercu

ShardCards est une application de revision par flashcards orientee mobile, fonctionnant en mode **offline-first** avec possibilite de **synchronisation cloud** via Supabase.

L'application combine :
- repetition espacee (algorithme SM-2) ;
- gestion locale robuste (LocalStorage + Service Worker) ;
- rappels de revision via notifications ;
- synchronisation multi-appareils quand l'utilisateur est connecte.

---

## Fonctionnalites

### Decks et cartes
- Decks et cartes illimites
- Creation, edition et suppression de decks/cartes
- Support des images sur recto et verso
- Import/export JSON pour sauvegarde et partage
- Decks de base integres (lecture seule)

### Revision
- Algorithme SM-2 (Encore / Bien / Facile)
- Score de difficulte par carte
- Tri des cartes (difficulte, alphabetique, prochaine revision)
- Recherche dans les cartes
- Mode de revision inverse (question/reponse inversees)
- Nombre de cartes configurable par session

### Organisation
- Tags sur les decks
- Filtre par tag
- Vue grille / liste
- Statistiques visuelles de maitrise par deck

### Notifications et PWA
- Installation PWA (iOS/Android/Desktop compatible navigateur)
- Rappels de revision planifies par deck
- Fonctionnement hors ligne (cache applicatif + donnees locales)

### Cloud (Supabase)
- Connexion / inscription utilisateur
- Synchronisation des decks avec strategie offline-first
- File d'attente des operations en cas de coupure reseau
- Upload des images vers Supabase Storage (utilisateur connecte)

---

## Installation (PWA)

### iOS (Safari)
1. Ouvrir l'URL de l'application dans Safari
2. Partager
3. Choisir **Sur l'ecran d'accueil**
4. Valider **Ajouter**

### Android (Chrome)
1. Ouvrir l'URL de l'application dans Chrome
2. Ouvrir le menu (⋮)
3. Choisir **Installer l'application** / **Ajouter a l'ecran d'accueil**

---

## Lancer en local

Le projet est une application web statique.

Option simple (Node.js) :

```bash
npx serve .
```

Puis ouvrir l'URL locale affichee (ex: `http://localhost:3000`).

---

## Synchronisation Supabase

La couche cloud est geree dans `supabase-client.js` et `storage-manager.js`.

### Ce qui est synchronise
- decks
- cartes
- metadonnees de revision (score, intervalle, repetitions, etc.)

### Comportement offline-first
1. Ecriture immediate en local
2. Tentative de sync cloud en arriere-plan
3. Mise en file d'attente si echec reseau/cloud
4. Replay automatique de la file au retour en ligne ou apres connexion

### Prerequis backend Supabase
- Auth active (email/password)
- Fonctions RPC utilisees par l'app :
  - `sync_deck_with_cards`
  - `get_all_decks_with_cards`
- Bucket Storage : `card-images`

---

## Import / Export JSON

Exemple de format accepte :

```json
{
  "name": "Mon Deck",
  "tags": ["Math", "Terminale"],
  "cards": [
    {
      "front": "Question",
      "back": "Reponse",
      "frontImage": "",
      "backImage": ""
    }
  ]
}
```

Notes :
- `front` et `back` peuvent etre completes par du texte et/ou image.
- Les images peuvent etre en base64 (local) ou en URL (cloud).

---

## Structure du projet

```text
.
├── index.html            # Structure principale de l'UI
├── style.css             # Styles globaux (responsive + dark mode)
├── script.js             # Logique applicative (UI, revision, modales, rappels)
├── storage-manager.js    # Stockage hybride offline-first + file de sync
├── supabase-client.js    # Auth et acces Supabase (DB + Storage)
├── supabase-umd.js       # SDK Supabase (UMD bundle)
├── service-worker.js     # Cache offline + notifications + rappels
├── manifest.json         # Manifest PWA
├── icon-1024.png         # Icone de l'application
├── decks_base/           # Exemples de decks JSON
└── package.json          # Metadonnees npm
```

---

## Stack technique

- HTML / CSS / JavaScript (ES Modules)
- PWA (Manifest + Service Worker)
- IndexedDB (rappels de notifications dans le service worker)
- LocalStorage (donnees utilisateur locales)
- Supabase (Auth, DB via RPC, Storage images)

---

## Licence

Libre d'utilisation pour usage personnel.

