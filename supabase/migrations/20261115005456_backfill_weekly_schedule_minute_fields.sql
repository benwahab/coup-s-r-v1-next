UPDATE public.game_schedules AS schedule
SET
  day_schedules = (
    SELECT jsonb_agg(
      item.value || jsonb_build_object(
        'open_minute', COALESCE(NULLIF(item.value->>'open_minute', '')::integer, 0),
        'close_minute', COALESCE(NULLIF(item.value->>'close_minute', '')::integer, 0)
      )
      ORDER BY item.ordinality
    )
    FROM jsonb_array_elements(schedule.day_schedules) WITH ORDINALITY AS item(value, ordinality)
  ),
  draft_day_schedules = (
    SELECT jsonb_agg(
      item.value || jsonb_build_object(
        'open_minute', COALESCE(NULLIF(item.value->>'open_minute', '')::integer, 0),
        'close_minute', COALESCE(NULLIF(item.value->>'close_minute', '')::integer, 0)
      )
      ORDER BY item.ordinality
    )
    FROM jsonb_array_elements(schedule.draft_day_schedules) WITH ORDINALITY AS item(value, ordinality)
  )
WHERE schedule.game_id IN ('pmu', 'loto')
  AND (
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(schedule.day_schedules) item
      WHERE NOT (item ? 'open_minute') OR NOT (item ? 'close_minute')
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(schedule.draft_day_schedules) item
      WHERE NOT (item ? 'open_minute') OR NOT (item ? 'close_minute')
    )
  );
