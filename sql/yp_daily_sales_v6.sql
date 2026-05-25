-- ============================================================================
-- 양평 매출 v6 — 일별 단순 집계로 전면 재설계
-- ============================================================================
-- 이용권/아이템 모델(yp_products, yp_sales, yp_sale_items)이 오버엔지니어링으로
-- 판단되어 전부 폐기. 하루 단위로 카드/현금/계좌이체 매출만 입력하는
-- 엑셀형 단순 테이블로 교체한다.
--
-- yp_daily_sales:
--   date            (고유) 영업일
--   card_amount     카드 매출
--   cash_amount     현금 매출
--   transfer_amount 계좌이체 매출
--   total_amount    합계 (카드+현금+계좌이체, 트리거 자동 계산)
--   memo            자유 메모
-- ============================================================================

-- 0. 구 모델 전부 제거 (의존성 역순)
DROP VIEW  IF EXISTS public.yp_coupon_balance;
DROP TABLE IF EXISTS public.yp_sale_items CASCADE;
DROP TABLE IF EXISTS public.yp_sales      CASCADE;
DROP TABLE IF EXISTS public.yp_products   CASCADE;

DROP FUNCTION IF EXISTS public.yp_item_recalc()        CASCADE;
DROP FUNCTION IF EXISTS public.yp_sale_total_refresh()  CASCADE;
-- yp_set_updated_at 은 아래에서 재사용

-- 1. 일별 매출 테이블
CREATE TABLE public.yp_daily_sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL UNIQUE,
  card_amount     NUMERIC NOT NULL DEFAULT 0,
  cash_amount     NUMERIC NOT NULL DEFAULT 0,
  transfer_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount    NUMERIC NOT NULL DEFAULT 0,
  memo            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_yp_daily_sales_date ON public.yp_daily_sales(date DESC);

-- 2. total_amount 자동 계산 + updated_at 갱신
CREATE OR REPLACE FUNCTION public.yp_daily_recalc()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_amount = COALESCE(NEW.card_amount,0) + COALESCE(NEW.cash_amount,0) + COALESCE(NEW.transfer_amount,0);
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_yp_daily_recalc ON public.yp_daily_sales;
CREATE TRIGGER trg_yp_daily_recalc
  BEFORE INSERT OR UPDATE ON public.yp_daily_sales
  FOR EACH ROW EXECUTE FUNCTION public.yp_daily_recalc();

-- 3. RLS — 양평 접근권자 SELECT, 양평 admin/super_admin 변경
ALTER TABLE public.yp_daily_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Site read"         ON public.yp_daily_sales;
DROP POLICY IF EXISTS "Site admin insert" ON public.yp_daily_sales;
DROP POLICY IF EXISTS "Site admin update" ON public.yp_daily_sales;
DROP POLICY IF EXISTS "Site admin delete" ON public.yp_daily_sales;

CREATE POLICY "Site read" ON public.yp_daily_sales
  FOR SELECT USING (public.can_access_site('yangpyeong'));
CREATE POLICY "Site admin insert" ON public.yp_daily_sales
  FOR INSERT WITH CHECK (public.can_admin_site('yangpyeong'));
CREATE POLICY "Site admin update" ON public.yp_daily_sales
  FOR UPDATE USING (public.can_admin_site('yangpyeong')) WITH CHECK (public.can_admin_site('yangpyeong'));
CREATE POLICY "Site admin delete" ON public.yp_daily_sales
  FOR DELETE USING (public.can_admin_site('yangpyeong'));
