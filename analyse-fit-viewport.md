# Analyse — Affichage « tout tient à l'écran » (fit-to-viewport) en PWA iOS

> Objectif demandé : qu'une fois installée sur l'écran d'accueil de l'iPhone, l'app **détecte la taille réelle de l'écran** et place tout au bon endroit **sans scroll** — tout visible directement.

---

## 1. Pourquoi ça scrolle aujourd'hui (diagnostic)

L'app utilise un modèle **« chrome fixe + scroll de page »**, hérité du web classique :

| Élément | Position | Hauteur | Réf. |
|---|---|---|---|
| `header` | `position: fixed` | `--header-h + safe-top` (≈ 56 px + encoche) | `style.css:223-245` |
| `.deck-sections` (onglets) | `position: fixed` | `--nav-h` (≈ 54 px) | `style.css:302-319` |
| `.tags-filter-container` | `position: fixed` (si tags) | ≈ 54 px | `index.html:141` |
| `.decks-section-content` | flux, `overflow-y:auto` | `flex:1` + `padding-top` manuel | `style.css:405-414` |
| `.decks-grid` | grille, hauteur **non bornée** | grandit avec le nb de decks | `style.css:471-474` |

**Trois problèmes de fond :**

1. **Le contenu est poussé par un `padding-top` calculé à la main** (`header + nav + safe + 10px`). Toute variation (tags affichés, paysage, petit iPhone) casse l'alignement → on compense avec d'autres `padding-top` (ex. `:419`, `:593`, `:2623`, `:2671`). Fragile.

2. **La grille de decks n'a aucune hauteur maximale.** Elle s'étire autant qu'il y a de decks. Elle dépasse l'espace disponible → scroll inévitable.

3. **Trois contextes de scroll empilés** (`body`, `.view`, `.decks-section-content`) tous en `overflow-y:auto` + `min-height:100dvh`. Sur iOS, ça produit le scroll **et le rebond élastique** (rubber-band) même quand le contenu tient presque, ce qui donne l'impression que « ça bouge » alors qu'on ne veut rien faire bouger.

**Conclusion :** ce n'est pas un réglage de pixels. Il faut **changer le modèle de mise en page** : passer d'un « document qui scrolle » à une **app-shell à hauteur fixe** où seul un éventuel sous-bloc défile.

---

## 2. La contrainte qu'on ne peut pas ignorer

Une app de flashcards a un **contenu variable** : 3 decks ou 50 decks, 10 cartes ou 500. On **ne peut pas** afficher une quantité arbitraire sur un écran fixe sans choisir une stratégie. Il n'existe que 4 familles de solutions :

| Stratégie | « Zéro scroll » garanti ? | Coût | Adapté à |
|---|---|---|---|
| **A. App-shell + scroll contenu contenu** | ❌ (scrolle si trop d'items, mais **plus de rebond de page**, chrome toujours visible) | Faible | Listes longues (decks, cartes, stats) |
| **B. Grille adaptative qui remplit l'écran** | ✅ jusqu'à K items, sinon bascule en A | Moyen | Accueil decks |
| **C. Pagination / carrousel (R×C par page, swipe)** | ✅ toujours | Élevé | Accueil si on veut vraiment 0 scroll |
| **D. Mise à l'échelle (zoom) du contenu** | ✅ mais texte parfois minuscule | Moyen | Déconseillé |

> **Vérité importante :** « tout sur la page, jamais de scroll, quel que soit le nombre de decks » n'est réalisable **que** via **C (pagination)** ou **B avec basculement**. Pour les écrans à contenu naturellement long (Statistiques, liste de cartes), le **A** est la bonne réponse : la *page* ne scrolle plus (plus de rebond), seul le panneau interne défile si nécessaire — c'est ce que font les apps natives iOS.

---

## 3. Détecter la taille de l'écran (le « comment »)

Trois couches, complémentaires :

### 3.1 CSS — unités viewport modernes
- `100dvh` / `100svh` / `100lvh` : hauteur **dynamique / small / large**. `dvh` suit la barre Safari ; en **PWA standalone** (écran d'accueil) il n'y a pas de barre → `dvh == svh == lvh == écran plein`. C'est le mode visé.
- `env(safe-area-inset-top/bottom/left/right)` : encoche, Dynamic Island, barre home. Déjà en place (`style.css:11-14`).

### 3.2 JS — variable de hauteur fiable
Certaines versions iOS mentent encore sur `100vh`. On fige une variable mesurée :

```js
function setAppHeight() {
  // visualViewport = hauteur RÉELLEMENT visible (gère clavier, barres)
  const h = (window.visualViewport?.height ?? window.innerHeight);
  document.documentElement.style.setProperty('--app-height', `${h}px`);
}
setAppHeight();
window.visualViewport?.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 200));
window.addEventListener('resize', setAppHeight);
```

Puis en CSS : `height: var(--app-height, 100dvh);` (le `100dvh` sert de secours avant que le JS tourne).

### 3.3 JS — détecter combien d'items tiennent (pour B / C)
```js
function computeGridCapacity(container, tileH, tileW, gap) {
  const r = container.getBoundingClientRect();
  const cols = Math.max(1, Math.floor((r.width  + gap) / (tileW + gap)));
  const rows = Math.max(1, Math.floor((r.height + gap) / (tileH + gap)));
  return { cols, rows, perPage: cols * rows };
}
```
→ permet de paginer exactement, ou de dimensionner les tuiles pour remplir.

---

## 4. Architecture recommandée (concrète, pour ton code)

### Étape 1 — Transformer chaque `.view` en app-shell à hauteur fixe

Remplacer le modèle « header fixed + padding-top » par une **grille CSS** qui découpe l'écran en zones :

```css
.view {
  height: var(--app-height, 100dvh);   /* hauteur EXACTE de l'écran */
  display: grid;
  grid-template-rows: auto auto auto 1fr; /* header / onglets / tags / contenu */
  overflow: hidden;                     /* la PAGE ne scrolle plus jamais */
}

/* header & onglets : plus besoin de position:fixed ni de z-index acrobatique */
header,
.deck-sections,
.tags-filter-container { position: static; }

/* La zone de contenu = tout l'espace restant, et c'est la SEULE qui peut défiler */
.decks-section-content {
  min-height: 0;          /* CRUCIAL en grid/flex sinon le contenu déborde */
  overflow-y: auto;
  padding-top: 10px;      /* fini les calc(header+nav+safe) à la main */
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;  /* tue le rebond élastique iOS */
}
```

**Gains immédiats :**
- Plus de rebond de page (le `overflow:hidden` sur `.view` + `overscroll-behavior:contain`).
- Header/onglets/FAB toujours à leur place, calculés automatiquement.
- Suppression de ~6 `padding-top: calc(...)` éparpillés et fragiles.
- Le safe-area est absorbé par le `header` (haut) et le `.fab`/contenu (bas), plus par des offsets manuels.

> ⚠️ Cette bascule supprime les `position: fixed` du header/onglets : il faut retirer les `padding-top` compensatoires associés (`:411`, `:419`, `:593`, `:2623`, `:2671`, `:2417`, `:893`…) sinon double décalage.

### Étape 2 — Faire que le contenu *remplisse* l'écran (option B pour l'accueil)

Pour la grille de decks, au lieu de tuiles de hauteur fixe qui débordent :

```css
.decks-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols, 2), 1fr);
  grid-auto-rows: 1fr;     /* les tuiles se partagent la hauteur dispo */
  gap: 12px;
  height: 100%;
}
```
+ JS qui pose `--cols` selon la largeur, et qui borne le nombre de tuiles à `perPage` (calcul §3.3). Au-delà → pagination (étape 3) ou scroll contenu (option A).

### Étape 3 — (Optionnel, « zéro scroll » strict) Pagination par swipe

Si tu veux **vraiment** ne jamais scroller même avec 40 decks :
- Découper en pages de `perPage` decks (calcul §3.3).
- Conteneur en `scroll-snap-type: x mandatory`, swipe horizontal, points de pagination en bas.
- Chaque page = une grille qui remplit pile l'écran.

---

## 5. Cas par écran

| Écran | Contenu | Reco |
|---|---|---|
| **Accueil decks** | variable, souvent court | **B** (grille adaptative) + bascule **A** si > capacité |
| **Liste de cartes** d'un deck | variable, souvent long | **A** (app-shell, scroll contenu contenu, sans rebond) |
| **Révision** (1 carte) | une carte | **app-shell fixe** : carte centrée, boutons en bas, **0 scroll** naturellement |
| **Quiz** | une question | idem révision |
| **Statistiques** | long (graphes + heatmap + sessions) | **A** obligatoire : impossible de tout caser ; page fixe + scroll *interne* du panneau stats. Éventuellement condenser/replier des sections |

> Forcer « tout à l'écran » sur les **Statistiques** dégraderait la lisibilité (texte minuscule). Le bon objectif y est : **page qui ne rebondit pas, chrome fixe, panneau qui défile proprement** — pas « zéro scroll ».

---

## 6. Risques & points de vigilance

1. **`min-height: 0`** sur les zones de contenu en grid/flex : sans ça, un enfant trop grand fait déborder la grille au lieu de scroller dedans. Erreur n°1 des layouts fit-viewport.
2. **Retirer TOUS les `padding-top: calc(header+nav…)`** en même temps que les `position: fixed`, sinon décalage cumulé.
3. **`--app-height` en JS** doit se mettre à jour sur `orientationchange` (avec un léger `setTimeout`, iOS rapporte l'ancienne valeur trop tôt).
4. **Clavier virtuel** : `visualViewport` réduit `--app-height` → les modales de saisie restent visibles (déjà amorcé avec `interactive-widget=resizes-content`).
5. **Animations qui laissent un transform** sur `.view` ou un conteneur : recrée un bloc conteneur qui casserait le FAB (déjà corrigé sur `viewEnter`). Vérifier `slideInFromRight` (`:425`) de la même façon.
6. **Pagination = plus de complexité** (état de page, swipe, sync au changement de filtre). À ne faire que si « zéro scroll strict » est non négociable.

---

## 7. Plan d'implémentation proposé (ordre)

1. **JS `--app-height`** (§3.2) + `<meta>` déjà OK.
2. **App-shell grid** sur `#decks-view` (§4.1) : header/onglets en `static`, contenu en `1fr` + `overflow:auto` + `overscroll-behavior:contain`. Retirer les `padding-top` compensatoires.
3. Vérifier visuellement : plus de rebond, chrome fixe, contenu qui occupe l'espace.
4. **Grille adaptative** (§4.2) sur l'accueil : `grid-auto-rows:1fr` + `--cols` JS.
5. Étendre l'app-shell aux autres vues (détail deck, révision, quiz, stats).
6. **(Si demandé)** pagination swipe sur l'accueil pour le « zéro scroll » strict.

---

## 8. Décision à prendre (par toi)

Le seul vrai choix de design :

- **Veux-tu « zéro scroll absolu » même avec beaucoup de decks ?**
  → alors **pagination par swipe** (étape 6), plus de travail mais 100 % sans scroll.
- **Ou « la page ne bouge/rebondit plus, chrome toujours visible, et on ne scrolle que dans la liste si vraiment nécessaire » ?**
  → alors **app-shell + grille adaptative** (étapes 1-4), plus simple, suffisant dans 95 % des cas, et c'est le comportement des apps natives.

Ma recommandation : **app-shell + grille adaptative** d'abord (gros gain, faible risque), et n'ajouter la pagination que si tu constates encore du scroll gênant sur l'accueil avec ton nombre réel de decks.
