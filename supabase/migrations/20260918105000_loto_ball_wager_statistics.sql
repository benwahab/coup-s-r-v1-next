-- LONANI / admin ball statistics: aggregate Loto wagers without exposing tickets or players.
-- One wager is one occurrence of a ball inside a placed Loto selection.
-- staked_amount is the full stake of wagers containing that ball, so totals across
-- balls are intentionally not additive to the platform total.

CREATE OR REPLACE FUNCTION public.get_loto_ball_statistics()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH loto AS (
    SELECT
      id,
      stake,
      COALESCE(
        (
          SELECT array_agg((x)::int ORDER BY (x)::int)
          FROM jsonb_array_elements_text(t.picks) AS e(x)
          WHERE x ~ '^\\d+$'
        ),
        ARRAY[]::int[]
      ) AS picks
    FROM public.tickets t
    WHERE t.game_id = 'loto'
  ),
  ball_rows AS (
    SELECT
      b.ball,
      COUNT(*)::bigint AS wager_count,
      SUM(l.stake)::bigint AS staked_amount,
      COUNT(*) FILTER (WHERE cardinality(l.picks) = 1)::bigint AS solo_wager_count,
      COUNT(*) FILTER (WHERE cardinality(l.picks) > 1)::bigint AS combo_wager_count
    FROM loto l
    CROSS JOIN LATERAL unnest(l.picks) AS b(ball)
    GROUP BY b.ball
    ORDER BY b.ball
  ),
  combo_rows AS (
    SELECT
      array_to_string(l.picks, ' + ') AS combination,
      COUNT(*)::bigint AS wager_count,
      SUM(l.stake)::bigint AS staked_amount
    FROM loto l
    WHERE cardinality(l.picks) > 0
    GROUP BY l.picks
    ORDER BY l.picks
  )
  SELECT jsonb_build_object(
    'balls',
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'ball', ball,
        'wagerCount', wager_count,
        'stakedAmount', staked_amount,
        'soloWagerCount', solo_wager_count,
        'comboWagerCount', combo_wager_count
      ) ORDER BY ball) FROM ball_rows),
      '[]'::jsonb
    ),
    'combinations',
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'combination', combination,
        'wagerCount', wager_count,
        'stakedAmount', staked_amount
      ) ORDER BY combination) FROM combo_rows),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_loto_ball_statistics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_loto_ball_statistics() TO service_role;

COMMENT ON FUNCTION public.get_loto_ball_statistics() IS
'Aggregate Loto wager statistics for the protected server-side ball_stats admin capability. Never returns player IDs, ticket IDs, ticket codes or individual tickets.';
