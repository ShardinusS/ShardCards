# FlashCards - Application PWA de Révision

Application web complète de flashcards avec répétition espacée, inspirée d'AnkiApp. Fonctionne comme PWA sur iPhone et autres appareils.

## 📁 Structure des fichiers

```
.
├── index.html          # Structure HTML principale
├── style.css           # Styles (thème blanc/bleu AnkiApp)
├── script.js           # Logique de l'application
├── manifest.json       # Configuration PWA
├── service-worker.js   # Service Worker pour cache offline
├── icon-192.png       # Icône 192x192 (à créer)
├── icon-512.png       # Icône 512x512 (à créer)
└── README.md          # Ce fichier
```

## 🚀 Hébergement

### Option 1 : GitHub Pages

1. **Créer un dépôt GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/votre-username/flashcards.git
   git push -u origin main
   ```

2. **Activer GitHub Pages**
   - Allez dans Settings > Pages
   - Sélectionnez la branche `main` et le dossier `/ (root)`
   - L'application sera disponible à `https://votre-username.github.io/flashcards/`

### Option 2 : Netlify

1. **Via l'interface web**
   - Allez sur [netlify.com](https://netlify.com)
   - Glissez-déposez le dossier du projet
   - L'application sera déployée automatiquement

2. **Via Netlify CLI**
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod
   ```

### Option 3 : Vercel

1. **Via l'interface web**
   - Allez sur [vercel.com](https://vercel.com)
   - Importez votre dépôt GitHub
   - Vercel détectera automatiquement le projet

2. **Via Vercel CLI**
   ```bash
   npm install -g vercel
   vercel --prod
   ```

### Option 4 : Serveur local (développement)

```bash
# Avec Python 3
python -m http.server 8000

# Avec Node.js (http-server)
npx http-server -p 8000

# Avec PHP
php -S localhost:8000
```

Puis ouvrez `http://localhost:8000` dans votre navigateur.

## 📱 Installation sur iPhone (PWA)

1. **Ouvrir l'application dans Safari**
   - Allez sur l'URL de votre application hébergée
   - Assurez-vous d'utiliser Safari (pas Chrome ou Firefox)

2. **Ajouter à l'écran d'accueil**
   - Appuyez sur le bouton de partage (carré avec flèche vers le haut)
   - Faites défiler et sélectionnez **"Sur l'écran d'accueil"** ou **"Ajouter à l'écran d'accueil"**
   - Personnalisez le nom si vous le souhaitez
   - Appuyez sur **"Ajouter"**

3. **Lancer l'application**
   - L'icône apparaîtra sur votre écran d'accueil
   - L'application s'ouvrira en mode standalone (sans barre d'adresse Safari)

## 🎨 Création des icônes

Pour que la PWA fonctionne correctement, vous devez créer deux fichiers d'icônes :

- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)

### Méthode 1 : Outil en ligne
1. Créez une icône carrée (fond bleu #2196F3 avec un symbole de carte 🃏)
2. Utilisez un outil comme [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator) ou [RealFaviconGenerator](https://realfavicongenerator.net/)
3. Téléchargez les icônes et placez-les dans le dossier racine

### Méthode 2 : Outil de design
- Utilisez Figma, Canva, ou Photoshop
- Créez une icône 512x512 avec fond bleu #2196F3
- Exportez en PNG aux tailles 192x192 et 512x512

### Méthode 3 : Script simple (Node.js)
Créez un fichier `generate-icons.js` :
```javascript
const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Fond bleu
  ctx.fillStyle = '#2196F3';
  ctx.fillRect(0, 0, size, size);
  
  // Symbole de carte (texte simple)
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🃏', size / 2, size / 2);
  
  return canvas.toBuffer('image/png');
}

fs.writeFileSync('icon-192.png', createIcon(192));
fs.writeFileSync('icon-512.png', createIcon(512));
console.log('Icônes créées !');
```

Puis exécutez : `node generate-icons.js`

## 📦 Import / Export JSON

### Format JSON

L'application utilise un format JSON simple pour l'import/export des decks :

```json
{
  "name": "Nom du deck",
  "cards": [
    {
      "front": "Question",
      "back": "Réponse"
    },
    {
      "front": "Autre question",
      "back": "Autre réponse"
    }
  ]
}
```

### Export d'un deck

1. Ouvrez le deck que vous souhaitez exporter
2. Cliquez sur le bouton **⬆** (Exporter) dans l'en-tête
3. Le fichier JSON sera téléchargé automatiquement
4. Le nom du fichier sera basé sur le nom du deck (ex: `Vocabulaire_anglais.json`)

### Import d'un deck

1. Cliquez sur le bouton **⬇** (Importer) dans l'en-tête d'un deck ou créez un nouveau deck
2. Sélectionnez un fichier JSON au format décrit ci-dessus
3. Le deck sera créé avec toutes les cartes importées
4. Les métadonnées de révision (SM-2) seront réinitialisées pour les nouvelles cartes

### Exemple de fichier JSON

```json
{
  "name": "Vocabulaire Anglais",
  "cards": [
    {
      "front": "Bonjour",
      "back": "Hello"
    },
    {
      "front": "Au revoir",
      "back": "Goodbye"
    },
    {
      "front": "Merci",
      "back": "Thank you"
    }
  ]
}
```

## 🔄 Système de répétition espacée (SM-2)

L'application utilise un algorithme SM-2 simplifié :

- **Encore** : Réinitialise la carte (révision dans 1 jour)
- **Bien** : Augmente l'intervalle selon l'ease factor
- **Facile** : Augmente l'intervalle plus rapidement

Les cartes à réviser sont celles dont la date de prochaine révision est passée ou n'a jamais été définie.

## 💾 Stockage des données

Toutes les données sont stockées dans le **LocalStorage** du navigateur :
- Les decks et leurs cartes
- Les métadonnées de révision (ease factor, intervalle, dates)
- Persistance même après fermeture du navigateur

**Note** : Les données sont stockées localement sur l'appareil. Pour sauvegarder vos decks, utilisez la fonction d'export.

## 🛠️ Fonctionnalités

### Decks
- ✅ Créer, renommer, supprimer des decks
- ✅ Affichage en grille ou liste
- ✅ Compteur de cartes à réviser

### Cartes
- ✅ Ajouter, modifier, supprimer des cartes
- ✅ Texte uniquement (question/réponse)
- ✅ Affichage de la prochaine date de révision

### Révision
- ✅ Mode révision avec tap pour révéler
- ✅ Boutons "Encore", "Bien", "Facile"
- ✅ Algorithme SM-2 simplifié
- ✅ Compteur de progression

### PWA
- ✅ Fonctionne hors ligne
- ✅ Installable sur iPhone
- ✅ Cache des ressources
- ✅ Interface native

## 🐛 Dépannage

### L'application ne s'installe pas sur iPhone
- Vérifiez que vous utilisez Safari (pas Chrome)
- Assurez-vous que l'application est servie en HTTPS (obligatoire pour PWA)
- Vérifiez que `manifest.json` est accessible

### Le Service Worker ne fonctionne pas
- Vérifiez la console du navigateur pour les erreurs
- Assurez-vous que l'application est servie depuis un serveur (pas `file://`)
- Videz le cache du navigateur et rechargez

### Les données ne persistent pas
- Vérifiez que LocalStorage est activé dans votre navigateur
- Ne naviguez pas en mode privé (LocalStorage peut être désactivé)

## 📝 Notes techniques

- **Framework** : Vanilla JavaScript (pas de dépendances)
- **Stockage** : LocalStorage
- **Algorithme** : SM-2 simplifié
- **Compatibilité** : Navigateurs modernes (Chrome, Safari, Firefox, Edge)
- **Responsive** : Optimisé pour mobile et desktop

## 📄 Licence

Libre d'utilisation pour usage personnel et commercial.

---

**Bon apprentissage ! 🎓**

