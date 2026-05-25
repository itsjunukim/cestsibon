-- ============================================================================
-- 양평 매출 분할 결제 (v4)
-- ============================================================================
-- yp_sales 한 건이 여러 결제 수단으로 나뉘어 수금된 경우를 표현하기 위해
-- payments JSONB 배열 컬럼을 추가한다. (가평 reservations.balance_payments 와 동일 패턴)
--
-- 배열 원소 형태:
--   { "method": "transfer" | "card" | "cash" | "place" | "store" | "social", "amount": 50000 }
--
-- 사용 규칙:
--   - 단일 결제   : payments = [] (또는 null) → payment_method 컬럼만 사용 (레거시 호환)
--   - 분할 결제   : payments = [...] (1건 이상). 합계는 total_amount 와 같아야 함 (클라이언트 검증)
--                  단일 결제도 payments 로 통일해 저장해도 됨
-- ============================================================================

ALTER TABLE public.yp_sales
  ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb;

-- (선택) 빠른 JSONB 조회용 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_yp_sales_payments_gin ON public.yp_sales USING gin (payments);
