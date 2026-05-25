-- ============================================================================
-- 양평 매출 모델 v2 — 가평 예약-이용권 패턴으로 재설계
-- ============================================================================
-- 기존 yp_sales (라인 단위) 폐기 → 3개 테이블로 분리:
--   yp_products    : 상품/이용권 마스터 (이름·가격·카테고리·정렬)
--   yp_sales       : 매출 헤더 (1건 = 한 손님(또는 단체) 한 거래)
--   yp_sale_items  : 매출 아이템 (한 매출에 여러 상품 + 수량 + 단가 + 쿠폰사용 토글)
--
-- 카테고리: coupon_purchase | riding | playground | beverage | etc
-- 쿠폰 잔여 = Σ(coupon_purchase 구매 수량) − Σ(is_coupon_use 사용 수량)  (손님별)
-- ============================================================================

-- 0. 기존 객체 정리
DROP VIEW IF EXISTS public.yp_coupon_balance;
DROP TABLE IF EXISTS public.yp_sales CASCADE;

-- 1. 상품/이용권 마스터
CREATE TABLE public.yp_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  price         NUMERIC NOT NULL DEFAULT 0,
  category      TEXT NOT NULL CHECK (category IN ('coupon_purchase','riding','playground','beverage','etc')),
  display_order INTEGER,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_yp_products_active_order ON public.yp_products(is_active, display_order, name);

-- 2. 매출 헤더
CREATE TABLE public.yp_sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  customer_name   TEXT,                  -- 자유 입력 (단체손님은 '단체' 등)
  headcount       INTEGER,               -- 인원 (선택)
  total_amount    NUMERIC NOT NULL DEFAULT 0,  -- 아이템 합계 (트리거로 자동 계산)
  payment_method  TEXT CHECK (payment_method IN ('transfer','card','cash','place','store','social')),
  is_paid         BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_yp_sales_date     ON public.yp_sales(date DESC);
CREATE INDEX idx_yp_sales_customer ON public.yp_sales(customer_name);

-- 3. 매출 아이템
CREATE TABLE public.yp_sale_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       UUID NOT NULL REFERENCES public.yp_sales(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.yp_products(id) ON DELETE RESTRICT,
  quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price    NUMERIC NOT NULL DEFAULT 0,    -- 저장 시점 단가 스냅샷 (쿠폰 사용 시 0)
  amount        NUMERIC NOT NULL DEFAULT 0,    -- quantity * unit_price (트리거 계산)
  is_coupon_use BOOLEAN NOT NULL DEFAULT FALSE,-- 쿠폰 사용 여부 (라이딩에서 ON 시 단가 0)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_yp_sale_items_sale    ON public.yp_sale_items(sale_id);
CREATE INDEX idx_yp_sale_items_product ON public.yp_sale_items(product_id);

-- 4. updated_at 트리거 (yp_sales)
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

-- 5. 아이템 변경 시 amount = quantity*unit_price 보정 + 헤더 total_amount 갱신
CREATE OR REPLACE FUNCTION public.yp_item_recalc()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  affected_sale UUID;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    NEW.amount = COALESCE(NEW.quantity, 0) * COALESCE(NEW.unit_price, 0);
    affected_sale = NEW.sale_id;
  ELSE
    affected_sale = OLD.sale_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.yp_sales
       SET total_amount = COALESCE((SELECT SUM(amount) FROM public.yp_sale_items WHERE sale_id = affected_sale), 0),
           updated_at = now()
     WHERE id = affected_sale;
    RETURN OLD;
  END IF;

  -- INSERT/UPDATE 후 헤더 갱신은 AFTER 트리거에서 처리하기 위해 RETURN NEW
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_yp_item_calc ON public.yp_sale_items;
CREATE TRIGGER trg_yp_item_calc
  BEFORE INSERT OR UPDATE ON public.yp_sale_items
  FOR EACH ROW EXECUTE FUNCTION public.yp_item_recalc();

CREATE OR REPLACE FUNCTION public.yp_sale_total_refresh()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  affected_sale UUID;
BEGIN
  affected_sale = COALESCE(NEW.sale_id, OLD.sale_id);
  UPDATE public.yp_sales
     SET total_amount = COALESCE((SELECT SUM(amount) FROM public.yp_sale_items WHERE sale_id = affected_sale), 0),
         updated_at = now()
   WHERE id = affected_sale;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_yp_sale_total_refresh_ins ON public.yp_sale_items;
DROP TRIGGER IF EXISTS trg_yp_sale_total_refresh_upd ON public.yp_sale_items;
DROP TRIGGER IF EXISTS trg_yp_sale_total_refresh_del ON public.yp_sale_items;
CREATE TRIGGER trg_yp_sale_total_refresh_ins AFTER INSERT ON public.yp_sale_items FOR EACH ROW EXECUTE FUNCTION public.yp_sale_total_refresh();
CREATE TRIGGER trg_yp_sale_total_refresh_upd AFTER UPDATE ON public.yp_sale_items FOR EACH ROW EXECUTE FUNCTION public.yp_sale_total_refresh();
CREATE TRIGGER trg_yp_sale_total_refresh_del AFTER DELETE ON public.yp_sale_items FOR EACH ROW EXECUTE FUNCTION public.yp_sale_total_refresh();

-- 6. RLS — 양평 접근권자 SELECT, 양평 admin/super_admin INSERT/UPDATE/DELETE
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['yp_products','yp_sales','yp_sale_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Site read" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Site admin insert" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Site admin update" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Site admin delete" ON public.%I', tbl);
    EXECUTE format('CREATE POLICY "Site read" ON public.%I FOR SELECT USING (public.can_access_site(''yangpyeong''))', tbl);
    EXECUTE format('CREATE POLICY "Site admin insert" ON public.%I FOR INSERT WITH CHECK (public.can_admin_site(''yangpyeong''))', tbl);
    EXECUTE format('CREATE POLICY "Site admin update" ON public.%I FOR UPDATE USING (public.can_admin_site(''yangpyeong'')) WITH CHECK (public.can_admin_site(''yangpyeong''))', tbl);
    EXECUTE format('CREATE POLICY "Site admin delete" ON public.%I FOR DELETE USING (public.can_admin_site(''yangpyeong''))', tbl);
  END LOOP;
END $$;

-- 7. 손님별 쿠폰 잔여 VIEW (보트종류 컬럼 없는 단순 모델)
CREATE OR REPLACE VIEW public.yp_coupon_balance AS
WITH purchased AS (
  SELECT s.customer_name, COALESCE(SUM(i.quantity), 0)::int AS purchased
  FROM public.yp_sale_items i
  JOIN public.yp_sales    s ON s.id = i.sale_id
  JOIN public.yp_products p ON p.id = i.product_id
  WHERE p.category = 'coupon_purchase'
    AND i.is_coupon_use = FALSE
    AND s.customer_name IS NOT NULL
  GROUP BY s.customer_name
),
used AS (
  SELECT s.customer_name, COALESCE(SUM(i.quantity), 0)::int AS used
  FROM public.yp_sale_items i
  JOIN public.yp_sales s ON s.id = i.sale_id
  WHERE i.is_coupon_use = TRUE
    AND s.customer_name IS NOT NULL
  GROUP BY s.customer_name
)
SELECT
  COALESCE(p.customer_name, u.customer_name) AS customer_name,
  COALESCE(p.purchased, 0)                   AS purchased,
  COALESCE(u.used, 0)                        AS used,
  COALESCE(p.purchased, 0) - COALESCE(u.used, 0) AS balance
FROM purchased p
FULL OUTER JOIN used u ON p.customer_name = u.customer_name;
