-- ============================================================================
-- 양평 매출 v7 — 같은 날짜 여러 행 허용
-- ============================================================================
-- yp_daily_sales.date 의 UNIQUE 제약을 제거해 하루에 여러 매출 행을 입력 가능.
-- (예: 2026-05-26 오전/오후 등 분리 기록)
-- ============================================================================

-- date 컬럼에 걸린 UNIQUE 제약을 이름과 무관하게 안전하게 제거
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
      AND t.relname = 'yp_daily_sales'
      AND c.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.yp_daily_sales DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

-- 조회 정렬 안정성을 위해 (date, created_at) 인덱스 보강
CREATE INDEX IF NOT EXISTS idx_yp_daily_sales_date_created
  ON public.yp_daily_sales(date DESC, created_at DESC);
