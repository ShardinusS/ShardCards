# ShardCards

<div align="center">

<img src="icon-1024.png" alt="ShardCards" width="64">

**Application de flashcards gratuite et illimitée**

[![PWA](https://img.shields.io/badge/PWA-Ready-blue)](https://web.dev/progressive-web-apps/)
[![Offline](https://img.shields.io/badge/Offline-Supported-green)](https://web.dev/offline/)

[**Essayer l'application →**](https://shardinuss.github.io/ShardCards)

</div>

---

## Fonctionnalités

- **Cartes et decks illimités** — Aucune restriction
- **100% gratuit** — Pas d'abonnement, pas de pub
- **Fonctionne hors ligne** — Données stockées localement
- **Répétition espacée (SM-2)** — Algorithme de mémorisation optimisé
- **Images supportées** — Recto et/ou verso
- **Rappels de révision** — Notifications personnalisables
- **Import/Export JSON** — Sauvegardez et partagez vos decks

---

## Installation (PWA)

### iOS
1. Ouvrir l'URL dans Safari
2. Bouton de partage → **Sur l'écran d'accueil**
3. **Ajouter**

### Android
1. Ouvrir l'URL dans Chrome
2. Menu (⋮) → **Installer l'application** ou **Ajouter à l'écran d'accueil**

---

## Import / Export

Format JSON supporté :

```json
{
  "name": "Mon Deck",
  "cards": [
    { "front": "Question", "back": "Réponse", "frontImage": "", "backImage": "" }
  ]
}
```

Les images sont encodées en base64.

---

## Structure du projet

```
├── index.html          # HTML principal
├── style.css           # Styles
├── script.js           # Logique applicative
├── manifest.json       # Config PWA
├── service-worker.js   # Cache offline & notifications
├── icon-1024.png       # Icône
└── decks_base/         # Decks de démonstration
```

---

## Licence

Libre d'utilisation pour usage personnel.

