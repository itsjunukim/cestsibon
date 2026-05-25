-- ============================================================================
-- 양평 매출 모델 v3 — 가평 tickets 와 완전 동일하게 단순화
-- ============================================================================
-- v2에서 도입했던 다음 항목을 모두 제거:
--   - yp_products.category        (5종 분류)
--   - yp_products.is_active       (시즌 토글)
--   - yp_sale_items.is_coupon_use (쿠폰 사용 토글)
--   - yp_coupon_balance VIEW      (손님별 쿠폰 잔여 자동 추적)
--
-- 결과: yp_products = (name, price, display_order) 로 가평 tickets 와 동일 구조.
--        매출 입력 폼은 단순히 "이용권 + 수량" 카드만 추가/삭제.
-- ============================================================================

-- 1. 잔여 뷰 폐기
DROP VIEW IF EXISTS public.yp_coupon_balance;

-- 2. yp_sale_items 단순화
ALTER TABLE public.yp_sale_items DROP COLUMN IF EXISTS is_coupon_use;

-- 3. yp_products 단순화
ALTER TABLE public.yp_products DROP COLUMN IF EXISTS category;
ALTER TABLE public.yp_products DROP COLUMN IF EXISTS is_active;

-- 4. 인덱스 정리 (active/order 복합 인덱스 → 단순 order)
DROP INDEX IF EXISTS public.idx_yp_products_active_order;
CREATE INDEX IF NOT EXISTS idx_yp_products_order ON public.yp_products(display_order, name);

-- ============================================================================
-- 적용 후 확인:
--   SELECT column_name FROM information_schema.columns WHERE table_name='yp_products' ORDER BY ordinal_position;
--   SELECT column_name FROM information_schema.columns WHERE table_name='yp_sale_items' ORDER BY ordinal_position;
-- ============================================================================
