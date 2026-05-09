-- ============================================================================
-- 보안 강화: RLS 정책 재작성
-- ============================================================================
-- 기존: 모든 테이블이 'Enable all access for anon' (FOR ALL USING (true))
-- 변경:
--   * 로그인 사용자(authenticated): SELECT 가능
--   * 관리자(profiles.role = 'admin'): INSERT/UPDATE/DELETE 가능
--   * profiles 테이블: SELECT는 본인 + 관리자, mutation은 service_role만
-- ============================================================================

-- 1. 헬퍼 함수: 현재 사용자가 admin인지 검사
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. profiles 테이블 보호
--    SELECT: 모든 로그인 사용자 (사이드바 role 표시 등에 필요)
--    INSERT/UPDATE/DELETE: 차단 (service_role만 가능 — 트리거나 server action 통해서만)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "No direct profile mutation" ON public.profiles;

CREATE POLICY "Authenticated read profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 일반 클라이언트의 INSERT/UPDATE/DELETE를 모두 차단
-- (RLS는 service_role을 우회하므로 server action에서는 정상 동작)
CREATE POLICY "Block direct profile insert" ON public.profiles
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Block direct profile update" ON public.profiles
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Block direct profile delete" ON public.profiles
  FOR DELETE USING (false);

-- 3. 비즈니스 테이블에 일괄 적용할 정책
--    - SELECT: 로그인 사용자 전부
--    - INSERT/UPDATE/DELETE: admin만
DO $$
DECLARE
  tbl TEXT;
  business_tables TEXT[] := ARRAY[
    'reservations',
    'reservation_rooms',
    'reservation_tickets',
    'reservation_alerts',
    'rooms',
    'accommodations',
    'accommodation_settlements',
    'daily_settlements',
    'monthly_settlements',
    'tickets',
    'sales'
  ];
BEGIN
  FOREACH tbl IN ARRAY business_tables LOOP
    -- 테이블이 존재할 때만 적용
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Enable all access for anon" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Authenticated read" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Admin insert" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Admin update" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Admin delete" ON public.%I', tbl);

      EXECUTE format(
        'CREATE POLICY "Authenticated read" ON public.%I
           FOR SELECT USING (auth.uid() IS NOT NULL)',
        tbl
      );
      EXECUTE format(
        'CREATE POLICY "Admin insert" ON public.%I
           FOR INSERT WITH CHECK (public.is_admin())',
        tbl
      );
      EXECUTE format(
        'CREATE POLICY "Admin update" ON public.%I
           FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin())',
        tbl
      );
      EXECUTE format(
        'CREATE POLICY "Admin delete" ON public.%I
           FOR DELETE USING (public.is_admin())',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- 4. 확인용 쿼리 (실행 후 출력으로 확인)
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;
