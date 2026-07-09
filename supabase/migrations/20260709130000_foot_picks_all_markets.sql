-- foot_picks.selection ne doit pas être limité à '1'/'X'/'2' : la règle
-- "un seul pari par match, pour toujours" s'applique à tous les marchés
-- (plus de 2.5 buts, BTTS, corners, etc.), pas seulement au résultat final.
-- On distingue le marché (market_id) de la sélection choisie dans ce marché.

ALTER TABLE public.foot_picks DROP CONSTRAINT foot_picks_selection_check;

ALTER TABLE public.foot_picks
  ADD COLUMN market_id TEXT NOT NULL DEFAULT '1x2';

COMMENT ON COLUMN public.foot_picks.market_id IS 'Identifiant du marché parié (ex: "1x2", "ou25", "btts"). Seul le marché 1x2 est réglé automatiquement depuis le score réel ; les autres restent réglés manuellement par un admin, comme avant.';
COMMENT ON COLUMN public.foot_picks.selection IS 'Option choisie dans le marché (ex: "1"/"X"/"2" pour 1x2, "over"/"under" pour ou25, etc.).';
