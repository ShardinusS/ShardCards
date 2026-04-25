-- ShardCards - Database Schema and Migration for Supabase
-- Apply this migration to your Supabase project via SQL Editor

-- ============================================================
-- Table: decks
-- ============================================================
CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- Enable Row Level Security
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own decks
CREATE POLICY "Users can only see own decks" ON decks
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can insert their own decks
CREATE POLICY "Users can insert own decks" ON decks
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own decks
CREATE POLICY "Users can update own decks" ON decks
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: Users can delete their own decks
CREATE POLICY "Users can delete own decks" ON decks
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- Table: cards
-- ============================================================
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL DEFAULT '',
  back TEXT NOT NULL DEFAULT '',
  front_image TEXT,
  back_image TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  next_review BIGINT,
  last_review BIGINT,
  ease_factor REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  card_score INTEGER DEFAULT 0,
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- Enable Row Level Security
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own cards
CREATE POLICY "Users can only see own cards" ON cards
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can insert their own cards
CREATE POLICY "Users can insert own cards" ON cards
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own cards
CREATE POLICY "Users can update own cards" ON cards
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: Users can delete their own cards
CREATE POLICY "Users can delete own cards" ON cards
  FOR DELETE USING (user_id = auth.uid());

-- Index for faster queries by deck
CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);

-- ============================================================
-- Fonction: sync_deck_with_cards
-- Synchronise un deck avec ses cartes (upsert)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_deck_with_cards(
  p_deck_id TEXT,
  p_name TEXT,
  p_tags TEXT[],
  p_created_at BIGINT,
  p_updated_at BIGINT,
  p_cards JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deck_id TEXT;
  v_card RECORD;
BEGIN
  -- Upsert deck
  INSERT INTO decks (id, name, tags, created_at, updated_at)
  VALUES (p_deck_id, p_name, p_tags, p_created_at, p_updated_at)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    tags = EXCLUDED.tags,
    updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_deck_id;

  -- Upsert cards
  FOR v_card IN SELECT * FROM jsonb_populate_recordset(NULL::cards, p_cards)
  LOOP
    INSERT INTO cards (id, deck_id, front, back, front_image, back_image, created_at, updated_at, next_review, last_review, ease_factor, interval, repetitions, card_score)
    VALUES (v_card.id, v_deck_id, v_card.front, v_card.back, v_card.front_image, v_card.back_image, v_card.created_at, v_card.updated_at, v_card.next_review, v_card.last_review, v_card.ease_factor, v_card.interval, v_card.repetitions, v_card.card_score)
    ON CONFLICT (id) DO UPDATE SET
      front = EXCLUDED.front,
      back = EXCLUDED.back,
      front_image = EXCLUDED.front_image,
      back_image = EXCLUDED.back_image,
      updated_at = EXCLUDED.updated_at,
      next_review = EXCLUDED.next_review,
      last_review = EXCLUDED.last_review,
      ease_factor = EXCLUDED.ease_factor,
      interval = EXCLUDED.interval,
      repetitions = EXCLUDED.repetitions,
      card_score = EXCLUDED.card_score;
  END LOOP;

  RETURN JSONB_BUILD_OBJECT('success', true, 'deck_id', v_deck_id);
END;
$$;

-- ============================================================
-- Fonction: get_all_decks_with_cards
-- Retourne tous les decks avec leurs cartes
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_decks_with_cards()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', d.id,
      'name', d.name,
      'tags', d.tags,
      'created_at', d.created_at,
      'updated_at', d.updated_at,
      'cards', COALESCE(
        (SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', c.id,
            'front', c.front,
            'back', c.back,
            'front_image', c.front_image,
            'back_image', c.back_image,
            'created_at', c.created_at,
            'updated_at', c.updated_at,
            'next_review', c.next_review,
            'last_review', c.last_review,
            'ease_factor', c.ease_factor,
            'interval', c.interval,
            'repetitions', c.repetitions,
            'card_score', c.card_score
          )
        ) FROM cards c WHERE c.deck_id = d.id), '[]'::JSONB)
    )
  )
  ) INTO v_result
  FROM decks d;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- ============================================================
-- Fonction: delete_deck_cascade
-- Supprime un deck et toutes ses cartes
-- ============================================================
CREATE OR REPLACE FUNCTION delete_deck_cascade(p_deck_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM cards WHERE deck_id = p_deck_id;
  DELETE FROM decks WHERE id = p_deck_id;
  RETURN JSONB_BUILD_OBJECT('success', true);
END;
$$;

-- ============================================================
-- Fonction: get_deck_card_count
-- Retourne le nombre de cartes d'un deck
-- ============================================================
CREATE OR REPLACE FUNCTION get_deck_card_count(p_deck_id TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM cards WHERE deck_id = p_deck_id;
  RETURN v_count;
END;
$$;