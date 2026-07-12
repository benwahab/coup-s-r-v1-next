-- Corrige un bug réel remonté par Lovable : un ticket combiné pariant sur
-- PLUSIEURS marchés du MÊME match (ex: 1X2 + "plus de 2.5 buts" sur un
-- seul match) créait plusieurs lignes foot_picks pour ce match, ce que la
-- contrainte UNIQUE(user_id, fixture_id) rejetait intégralement — le
-- paiement passait mais aucun pick n'était enregistré, empêchant le
-- règlement automatique et laissant l'utilisateur reparier sur ce match.
--
-- Nouveau modèle : UNE ligne par (utilisateur, match), contenant tous les
-- marchés/sélections choisis pour ce match dans un tableau JSONB. La
-- contrainte "un seul pari par match, pour toujours" reste appliquée au
-- niveau du match entier, comme voulu — mais permet plusieurs marchés en
-- une seule soumission.

ALTER TABLE public.foot_picks
  ADD COLUMN picks JSONB;

-- Migre les données existantes (s'il y en a) : regroupe par (user_id, fixture_id).
UPDATE public.foot_picks fp
SET picks = sub.picks
FROM (
  SELECT user_id, fixture_id,
         jsonb_agg(jsonb_build_object('marketId', market_id, 'selection', selection, 'odds', odds, 'status', status)) AS picks
  FROM public.foot_picks
  GROUP BY user_id, fixture_id
) sub
WHERE fp.user_id = sub.user_id AND fp.fixture_id = sub.fixture_id;

-- Dédoublonne : ne garde qu'une ligne par (user_id, fixture_id) — la plus ancienne.
DELETE FROM public.foot_picks a
USING public.foot_picks b
WHERE a.user_id = b.user_id AND a.fixture_id = b.fixture_id AND a.ctid > b.ctid;

ALTER TABLE public.foot_picks
  ALTER COLUMN picks SET NOT NULL,
  DROP COLUMN market_id,
  DROP COLUMN selection,
  DROP COLUMN odds;

COMMENT ON COLUMN public.foot_picks.picks IS 'Tous les marchés/sélections choisis par l''utilisateur pour ce match, en une seule soumission : [{marketId, selection, odds, status}]. Le champ status au niveau de la ligne reflète l''état global (perdant dès qu''un pick perd, gagnant seulement si tous les picks 1x2 le sont).';
