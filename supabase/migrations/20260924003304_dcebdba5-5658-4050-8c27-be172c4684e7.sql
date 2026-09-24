DROP POLICY IF EXISTS "AI analyses are publicly readable" ON public.foot_ai_analyses;
CREATE POLICY "Public can read analyses for visible fixtures"
ON public.foot_ai_analyses
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.foot_fixtures AS fixture
    WHERE fixture.id = foot_ai_analyses.fixture_id
  )
);