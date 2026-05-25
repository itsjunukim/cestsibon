-- ============================================================================
-- 양평 매출 라인 테이블 (가평과 완전 분리)
-- ============================================================================
-- 매출 종류:
--   coupon_purchase : 쿠폰 구매 (보트종류 필수, 매수=quantity, 총액=amount)
--   riding          : 라이딩 (현장결제 또는 쿠폰사용. 보트종류 필수)
--   playground      : 놀이기구 (인원=quantity, 총액=amount)
--   beverage        : 식음료 (description 에 품목, 수량, 총액)
--   etc             : 기타
--
-- 결제수단:
--   transfer, card, cash, place, store, social, coupon (쿠폰 사용 시)
--
-- 쿠폰 잔여 추적: 별도 테이블 없이 yp_sales 합산으로 계산.
--   잔여 = Σ(coupon_purchase.quantity) − Σ(riding.quantity where payment_method='coupon')
--   (손님+보트종류 단위)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.yp_sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  customer_name   TEXT,                          -- 자유 입력 (단체손님은 '단체' 등)
  category        TEXT NOT NULL CHECK (category IN ('coupon_purchase','riding','playground','beverage','etc')),
  boat_type       TEXT CHECK (boat_type IN ('inboard','outboard')),  -- 해당 없으면 NULL
  description     TEXT,                          -- 자유 텍스트 ('라면 3개', '3종 18인', '아웃보드 50장' 등)
  quantity        INTEGER DEFAULT 1,             -- 매수/인원/횟수
  unit_price      NUMERIC DEFAULT 0,             -- 개당 금액 (선택)
  amount          NUMERIC NOT NULL DEFAULT 0,    -- 총액
  payment_method  TEXT CHECK (payment_method IN ('transfer','card','cash','place','store','social','coupon')),
  is_paid         BOOLEAN NOT NULL DEFAULT TRUE, -- 미수 여부 (수기 장부의 O/X 대체)
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yp_sales_date     ON public.yp_sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_yp_sales_customer ON public.yp_sales(customer_name);
CREATE INDEX IF NOT EXISTS idx_yp_sales_category ON public.yp_sales(category);

-- 수정시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.yp_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_yp_sales_updated ON public.yp_sales;
CREATE TRIGGER trg_yp_sales_updated
  BEFORE UPDATE ON public.yp_sales
  FOR EACH ROW EXECUTE FUNCTION public.yp_set_updated_at();

-- ============================================================================
-- RLS: 양평 사이트 접근권자만 조회, 양평 admin/super_admin 만 수정
-- (secure_rls_policies.sql 의 can_access_site / can_admin_site 함수 필요)
-- ============================================================================
ALTER TABLE public.yp_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Site read" ON public.yp_sales;
DROP POLICY IF EXISTS "Site admin insert" ON public.yp_sales;
DROP POLICY IF EXISTS "Site admin update" ON public.yp_sales;
DROP POLICY IF EXISTS "Site admin delete" ON public.yp_sales;

CREATE POLICY "Site read" ON public.yp_sales
  FOR SELECT USING (public.can_access_site('yangpyeong'));

CREATE POLICY "Site admin insert" ON public.yp_sales
  FOR INSERT WITH CHECK (public.can_admin_site('yangpyeong'));

CREATE POLICY "Site admin update" ON public.yp_sales
  FOR UPDATE USING (public.can_admin_site('yangpyeong'))
                WITH CHECK (public.can_admin_site('yangpyeong'));

CREATE POLICY "Site admin delete" ON public.yp_sales
  FOR DELETE USING (public.can_admin_site('yangpyeong'));

-- ============================================================================
-- 손님별 쿠폰 잔여 VIEW (UI 미사용, 데이터만 미리 노출)
-- ============================================================================
CREATE OR REPLACE VIEW public.yp_coupon_balance AS
WITH purchases AS (
  SELECT customer_name, boat_type, COALESCE(SUM(quantity), 0)::int AS purchased
  FROM public.yp_sales
  WHERE category = 'coupon_purchase' AND customer_name IS NOT NULL AND boat_type IS NOT NULL
  GROUP BY customer_name, boat_type
),
used AS (
  SELECT customer_name, boat_type, COALESCE(SUM(quantity), 0)::int AS used
  FROM public.yp_sales
  WHERE category = 'riding' AND payment_method = 'coupon'
    AND customer_name IS NOT NULL AND boat_type IS NOT NULL
  GROUP BY customer_name, boat_type
)
SELECT
  COALESCE(p.customer_name, u.customer_name) AS customer_name,
  COALESCE(p.boat_type, u.boat_type)         AS boat_type,
  COALESCE(p.purchased, 0)                   AS purchased,
  COALESCE(u.used, 0)                        AS used,
  COALESCE(p.purchased, 0) - COALESCE(u.used, 0) AS balance
FROM purchases p
FULL OUTER JOIN used u
  ON p.customer_name = u.customer_name AND p.boat_type = u.boat_type;
