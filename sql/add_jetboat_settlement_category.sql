-- ============================================================================
-- 정산 카테고리에 'jetboat' (제트보트) 추가
-- ============================================================================
-- accommodation_settlements.category : 'accommodation' | 'meat' | 'other' → +'jetboat'
-- daily_settlements.category         : 'accommodation' | 'meat' | 'other' → +'jetboat'
--
-- 기존 CHECK 제약을 DROP 후 재생성한다.
-- ============================================================================

-- 1) accommodation_settlements
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'accommodation_settlements'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.accommodation_settlements DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.accommodation_settlements
  ADD CONSTRAINT accommodation_settlements_category_check
  CHECK (category IN ('accommodation', 'meat', 'jetboat', 'other'));

-- 2) daily_settlements
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'daily_settlements'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.daily_settlements DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.daily_settlements
  ADD CONSTRAINT daily_settlements_category_check
  CHECK (category IN ('accommodation', 'meat', 'jetboat', 'other'));
