-- Atomic creation of football draw-result rows.
-- A multi-match publication batch must never leave a partial draft batch behind.

CREATE OR REPLACE FUNCTION public.create_foot_draw_results_atomic(
  p_draw_date date,
  p_draw_name text,
  p_matches jsonb
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ids uuid[];
BEGIN
  IF jsonb_typeof(p_matches) <> 'array' OR jsonb_array_length(p_matches) < 1 THEN
    RAISE EXCEPTION 'invalid_foot_results_batch';
  END IF;

  WITH inserted AS (
    INSERT INTO public.draw_results (game_id, draw_date, draw_name, result, status)
    SELECT
      'foot',
      p_draw_date,
      p_draw_name,
      item,
      'draft'
    FROM jsonb_array_elements(p_matches) AS item
    RETURNING id
  )
  SELECT array_agg(id) INTO v_ids FROM inserted;

  RETURN v_ids;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_foot_draw_results_atomic(date, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_foot_draw_results_atomic(date, text, jsonb) TO service_role;
