-- ============================================================================
-- daily_settlements RLS 재잠금
-- ============================================================================
-- update_daily_settlements.sql 을 실행하면 상단의
--   CREATE POLICY "Enable all access for anon" ... USING (true)
-- 가 다시 적용되어 보안이 풀립니다.
-- 이 스크립트를 그 직후 실행해 admin 전용으로 다시 잠급니다.
-- (secure_rls_policies.sql 의 is_admin() 함수가 이미 존재한다고 가정)
-- ----------------------------------------------------------------------------

ALTER TABLE public.daily_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for anon" ON public.daily_settlements;
DROP POLICY IF EXISTS "Authenticated read" ON public.daily_settlements;
DROP POLICY IF EXISTS "Admin insert" ON public.daily_settlements;
DROP POLICY IF EXISTS "Admin update" ON public.daily_settlements;
DROP POLICY IF EXISTS "Admin delete" ON public.daily_settlements;

CREATE POLICY "Authenticated read" ON public.daily_settlements
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin insert" ON public.daily_settlements
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admin update" ON public.daily_settlements
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin delete" ON public.daily_settlements
  FOR DELETE USING (public.is_admin());
