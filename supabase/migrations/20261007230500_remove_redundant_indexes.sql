-- Remove indexes that are exact duplicates of existing unique indexes.
-- The unique indexes already provide the same lookup paths while enforcing
-- integrity, so keeping both only adds storage and write-maintenance cost.

DROP INDEX IF EXISTS public.idx_admin_permissions_user_id;
DROP INDEX IF EXISTS public.idx_draw_results_foot_match;
DROP INDEX IF EXISTS public.pmu_horses_race_number_idx;
