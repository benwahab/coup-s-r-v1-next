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

  SELECT count(*) INTO v_count
  FROM public.game_schedules
  WHERE game_id IN ('pmu', 'loto')
    AND jsonb_typeof(draft_day_schedules) = 'array'
    AND jsonb_array_length(draft_day_schedules) = 7;

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'both_game_schedules_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.game_schedules AS schedule
    CROSS JOIN LATERAL jsonb_array_elements(schedule.draft_day_schedules) AS item
    WHERE schedule.game_id IN ('pmu', 'loto')
      AND (
        (item->>'day') IS NULL
        OR (item->>'open_hour') IS NULL
        OR (item->>'open_minute') IS NULL
        OR (item->>'close_hour') IS NULL
        OR (item->>'close_minute') IS NULL
        OR (item->>'draw_hour') IS NULL
        OR (item->>'draw_minute') IS NULL
        OR (item->>'day')::integer NOT BETWEEN 0 AND 6
        OR (item->>'open_hour')::integer NOT BETWEEN 0 AND 23
        OR (item->>'open_minute')::integer NOT BETWEEN 0 AND 59
        OR (item->>'close_hour')::integer NOT BETWEEN 0 AND 23
        OR (item->>'close_minute')::integer NOT BETWEEN 0 AND 59
        OR (item->>'draw_hour')::integer NOT BETWEEN 0 AND 23
        OR (item->>'draw_minute')::integer NOT BETWEEN 0 AND 59
        OR ((item->>'open_hour')::integer * 60 + (item->>'open_minute')::integer)
           = ((item->>'close_hour')::integer * 60 + (item->>'close_minute')::integer)
        OR ((item->>'draw_hour')::integer * 60 + (item->>'draw_minute')::integer)
           < ((item->>'close_hour')::integer * 60 + (item->>'close_minute')::integer)
      )
  ) THEN
    RAISE EXCEPTION 'invalid_game_schedule_draft';
  END IF;

  IF EXISTS (
    SELECT schedule.game_id
    FROM public.game_schedules AS schedule
    CROSS JOIN LATERAL jsonb_array_elements(schedule.draft_day_schedules) AS item
    WHERE schedule.game_id IN ('pmu', 'loto')
    GROUP BY schedule.game_id
    HAVING count(DISTINCT (item->>'day')::integer) <> 7
  ) THEN
    RAISE EXCEPTION 'schedule_requires_all_weekdays';
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
