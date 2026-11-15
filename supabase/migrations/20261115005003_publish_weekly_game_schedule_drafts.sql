ALTER TABLE public.game_schedules
  ADD COLUMN IF NOT EXISTS draft_day_schedules jsonb;

UPDATE public.game_schedules
SET draft_day_schedules = day_schedules
WHERE draft_day_schedules IS NULL;

ALTER TABLE public.game_schedules
  ALTER COLUMN draft_day_schedules SET NOT NULL;

ALTER TABLE public.game_schedules
  ADD CONSTRAINT game_schedules_draft_seven_days_check
  CHECK (
    jsonb_typeof(draft_day_schedules) = 'array'
    AND jsonb_array_length(draft_day_schedules) = 7
  );

CREATE OR REPLACE FUNCTION public.publish_game_schedules(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_count integer;
  v_published_at timestamptz := now();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'schedule_publisher_required';
  END IF;

  SELECT count(*)
    INTO v_count
    FROM public.game_schedules
    WHERE game_id IN ('pmu', 'loto')
      AND jsonb_typeof(draft_day_schedules) = 'array'
      AND jsonb_array_length(draft_day_schedules) = 7;

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'both_game_schedules_required';
  END IF;

  UPDATE public.game_schedules AS target
  SET
    day_schedules = target.draft_day_schedules,
    open_hour = (SELECT (day->>'open_hour')::integer FROM jsonb_array_elements(target.draft_day_schedules) AS day WHERE (day->>'day')::integer = 1),
    close_hour = (SELECT (day->>'close_hour')::integer FROM jsonb_array_elements(target.draft_day_schedules) AS day WHERE (day->>'day')::integer = 1),
    draw_hour = (SELECT (day->>'draw_hour')::integer FROM jsonb_array_elements(target.draft_day_schedules) AS day WHERE (day->>'day')::integer = 1),
    draw_minute = (SELECT (day->>'draw_minute')::integer FROM jsonb_array_elements(target.draft_day_schedules) AS day WHERE (day->>'day')::integer = 1),
    updated_at = v_published_at,
    updated_by = p_user_id
  WHERE target.game_id IN ('pmu', 'loto');

  RETURN jsonb_build_object('published_games', 2, 'published_at', v_published_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.publish_game_schedules(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_game_schedules(uuid)
  TO service_role;

COMMENT ON FUNCTION public.publish_game_schedules(uuid)
  IS 'Atomically publishes the saved PMU and Loto weekly schedule drafts to the live schedules.';
