-- ============================================================================
-- 멀티사이트 권한 모델 (레벨 × 사이트)
-- ============================================================================
-- role:  super_admin | admin | employee
-- site:  all | gapyeong | yangpyeong
--
--   super_admin / all        : 전 사이트 읽기+수정 + 계정관리
--   admin       / gapyeong    : 가평만 읽기+수정
--   admin       / yangpyeong  : 양평만 읽기+수정
--   employee    / gapyeong    : 가평 읽기만
--   employee    / yangpyeong  : 양평 읽기만
-- ============================================================================

-- 1. profiles.site 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'gapyeong'
  CHECK (site IN ('all', 'gapyeong', 'yangpyeong'));

-- 2. 권한 판정 함수
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 해당 사이트를 수정(admin)할 수 있는가
CREATE OR REPLACE FUNCTION public.can_admin_site(p_site text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND ( role = 'super_admin'
            OR (role = 'admin' AND site = p_site) )
  );
$$;

-- 해당 사이트를 조회(접근)할 수 있는가
CREATE OR REPLACE FUNCTION public.can_access_site(p_site text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND ( site = 'all' OR site = p_site )
  );
$$;

-- 3. 기존 is_admin()은 super_admin 도 admin 으로 인정하도록 갱신 (하위 호환)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
  );
$$;

-- 4. 가평 소속 비즈니스 테이블 RLS 를 사이트 인식형으로 재적용
--    읽기 = can_access_site('gapyeong'), 수정 = can_admin_site('gapyeong')
DO $$
DECLARE
  tbl TEXT;
  gapyeong_tables TEXT[] := ARRAY[
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
  FOREACH tbl IN ARRAY gapyeong_tables LOOP
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
      EXECUTE format('DROP POLICY IF EXISTS "Site read" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Site admin insert" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Site admin update" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Site admin delete" ON public.%I', tbl);

      EXECUTE format(
        'CREATE POLICY "Site read" ON public.%I
           FOR SELECT USING (public.can_access_site(''gapyeong''))', tbl);
      EXECUTE format(
        'CREATE POLICY "Site admin insert" ON public.%I
           FOR INSERT WITH CHECK (public.can_admin_site(''gapyeong''))', tbl);
      EXECUTE format(
        'CREATE POLICY "Site admin update" ON public.%I
           FOR UPDATE USING (public.can_admin_site(''gapyeong'')) WITH CHECK (public.can_admin_site(''gapyeong''))', tbl);
      EXECUTE format(
        'CREATE POLICY "Site admin delete" ON public.%I
           FOR DELETE USING (public.can_admin_site(''gapyeong''))', tbl);
    END IF;
  END LOOP;
END $$;

-- 5. 기존 계정 마이그레이션 (현 데이터는 전부 가평 소속)
UPDATE public.profiles SET site = 'gapyeong'
  WHERE email IN ('admin@cestsibon.com', 'gazi6024@gmail.com', 'sms@cestsibon.com');
-- admin@cestsibon.com 은 가평 전용 admin 으로 유지 (role 그대로 admin)

-- 확인용:
-- SELECT email, role, site FROM public.profiles ORDER BY role, site;
