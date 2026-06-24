# Guide de configuration Supabase — ShardCards

Ce fichier liste toutes les actions à effectuer **dans le dashboard Supabase** pour sécuriser l'application.
URL du projet : `https://kwvdseqaljdwqbrjtarh.supabase.co`

---

## 1. Vérifier que RLS est activé sur chaque table

Dans **Table Editor → (table) → RLS** ou via SQL Editor :

```sql
-- Vérifier l'état RLS de toutes les tables
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('decks', 'cards')
AND relkind = 'r';
```

Si `relrowsecurity = false` pour une table, activer avec :

```sql
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
```

---

## 2. Policies RLS requises

### Table `decks`

```sql
-- Un utilisateur ne voit que ses propres decks
CREATE POLICY "decks_select_own" ON decks
  FOR SELECT USING (auth.uid() = user_id);

-- Un utilisateur ne peut créer que ses propres decks
CREATE POLICY "decks_insert_own" ON decks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Un utilisateur ne peut modifier que ses propres decks
CREATE POLICY "decks_update_own" ON decks
  FOR UPDATE USING (auth.uid() = user_id);

-- Un utilisateur ne peut supprimer que ses propres decks
CREATE POLICY "decks_delete_own" ON decks
  FOR DELETE USING (auth.uid() = user_id);
```

### Table `cards`

```sql
-- Un utilisateur ne voit que les cartes de ses decks
CREATE POLICY "cards_select_own" ON cards
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM decks WHERE id = deck_id)
  );

CREATE POLICY "cards_insert_own" ON cards
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM decks WHERE id = deck_id)
  );

CREATE POLICY "cards_update_own" ON cards
  FOR UPDATE USING (
    auth.uid() = (SELECT user_id FROM decks WHERE id = deck_id)
  );

CREATE POLICY "cards_delete_own" ON cards
  FOR DELETE USING (
    auth.uid() = (SELECT user_id FROM decks WHERE id = deck_id)
  );
```

---

## 3. Storage bucket `card-images`

Dans **Storage → card-images → Policies** :

### Accès en lecture publique (URLs publiques pour les images)

```sql
CREATE POLICY "images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'card-images');
```

### Écriture réservée au propriétaire du dossier

```sql
-- Le path est : {user_id}/{card_id}_{side}.jpg
-- On vérifie que le premier segment du path = auth.uid()
CREATE POLICY "images_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "images_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "images_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## 4. Vérifier les fonctions RPC

Les fonctions `sync_deck_with_cards` et `get_all_decks_with_cards` doivent être définies avec `SECURITY DEFINER` **et** vérifier `auth.uid()` en interne.

```sql
-- Vérifier la définition actuelle
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_name IN ('sync_deck_with_cards', 'get_all_decks_with_cards');
```

Si `security_type = 'DEFINER'`, s'assurer que la fonction filtre par `auth.uid()`.
Si `security_type = 'INVOKER'`, les RLS s'appliquent automatiquement.

Exemple de garde minimale à ajouter dans chaque fonction :

```sql
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Not authenticated';
END IF;
```

---

## 5. Confirmer que la clé est bien PUBLISHABLE

La clé dans `config.js` commence par `sb_publishable_` — c'est correct.
Une clé `service_role` ou `secret` dans le front-end serait une fuite critique.

Pour régénérer la clé anon si nécessaire :
**Settings → API → Project API keys → anon public → Regenerate**

Puis mettre à jour `config.js` avec la nouvelle valeur.

---

## 6. Contrôle final (test en SQL Editor)

Tester l'isolation avec un second compte utilisateur :

```sql
-- Se connecter en tant qu'utilisateur B et tenter de lire les decks de A
-- Si RLS est correct, 0 ligne retournée.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '<user_B_id>';
SELECT * FROM decks WHERE user_id = '<user_A_id>';
-- Résultat attendu : 0 lignes
```

---

## 7. Générer les icônes manquantes (TICKET-007)

Le `manifest.json` référence maintenant :
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `icon-512-maskable.png` (512×512, safe zone centrale)
- `icon-1024.png` (déjà présent)

**Depuis l'icône source `icon-1024.png`** :

Option A — outil en ligne : [maskable.app](https://maskable.app/editor) pour générer la version maskable.

Option B — ligne de commande avec ImageMagick (si installé) :
```bash
magick icon-1024.png -resize 192x192 icon-192.png
magick icon-1024.png -resize 512x512 icon-512.png
# Pour la version maskable : ajouter un fond coloré + réduire l'icône à 80% (safe zone)
magick icon-1024.png -resize 512x512 -gravity center -background "#f4f8ff" -extent 512x512 icon-512-maskable.png
```

Sans ces fichiers, le PWA install prompt peut afficher une icône manquante.
