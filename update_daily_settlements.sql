CREATE TABLE IF NOT EXISTS daily_settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  accommodation_id UUID REFERENCES accommodations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('accommodation', 'meat', 'other')),
  settlement_date DATE NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(accommodation_id, category, settlement_date)
);

-- RLS 설정 (admin 전용 — secure_rls_policies.sql 의 is_admin() 필요)
-- 주의: 과거의 "Enable all access for anon" 풀-액세스 정책은 보안 회귀를
-- 유발하므로 더 이상 사용하지 않는다. 재실행해도 안전하도록 admin 정책을 건다.
ALTER TABLE daily_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for anon" ON daily_settlements;
DROP POLICY IF EXISTS "Authenticated read" ON daily_settlements;
DROP POLICY IF EXISTS "Admin insert" ON daily_settlements;
DROP POLICY IF EXISTS "Admin update" ON daily_settlements;
DROP POLICY IF EXISTS "Admin delete" ON daily_settlements;
CREATE POLICY "Authenticated read" ON daily_settlements
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin insert" ON daily_settlements
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin update" ON daily_settlements
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin delete" ON daily_settlements
  FOR DELETE USING (public.is_admin());

-- ============================================================================
-- 결제 수단별 매출 집계 (balance_payments JSONB 배열 unnest 지원)
-- ============================================================================
-- 한 예약을 [결제수단, 금액] 단위 라인으로 분해.
--   1) 입금 완료된 예약금 → transfer 로 계산
--   2) 잔금 분할 결제(balance_payments JSONB 배열) → 각 row 의 method/amount 로 분해
--   3) 레거시 단일 결제(balance_payments 비어있음 + balance_payment_method 사용) → 전체 잔금을 단일 method 로 계상
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS daily_sales_by_method;
DROP VIEW IF EXISTS reservation_payment_lines;

CREATE OR REPLACE VIEW reservation_payment_lines AS
-- (1) 입금 완료된 예약금 → transfer
SELECT
  r.id::uuid              AS reservation_id,
  r.date                  AS date,
  'transfer'::text        AS method,
  COALESCE(r.deposit, 0)::numeric AS amount,
  'deposit'::text         AS source
FROM reservations r
WHERE r.status IS DISTINCT FROM 'cancelled'
  AND COALESCE(r.deposit, 0) > 0
  AND r.is_deposit_paid = TRUE

UNION ALL

-- (2) 분할 결제 (balance_payments JSONB 배열이 1건 이상)
SELECT
  r.id::uuid                                         AS reservation_id,
  r.date                                             AS date,
  (p ->> 'method')::text                             AS method,
  COALESCE((p ->> 'amount')::numeric, 0)             AS amount,
  'balance_split'::text                              AS source
FROM reservations r
CROSS JOIN LATERAL jsonb_array_elements(r.balance_payments) AS p
WHERE r.status IS DISTINCT FROM 'cancelled'
  AND r.balance_payments IS NOT NULL
  AND jsonb_typeof(r.balance_payments) = 'array'
  AND jsonb_array_length(r.balance_payments) > 0
  AND (p ->> 'method') IS NOT NULL
  AND (p ->> 'method') <> 'none'

UNION ALL

-- (3) 레거시 단일 결제 (balance_payments 비어있을 때만 balance_payment_method 사용)
SELECT
  r.id::uuid                                          AS reservation_id,
  r.date                                              AS date,
  r.balance_payment_method::text                      AS method,
  GREATEST(COALESCE(r.total_amount, 0) - COALESCE(r.deposit, 0), 0)::numeric AS amount,
  'balance_legacy'::text                              AS source
FROM reservations r
WHERE r.status IS DISTINCT FROM 'cancelled'
  AND (
        r.balance_payments IS NULL
        OR jsonb_typeof(r.balance_payments) <> 'array'
        OR jsonb_array_length(r.balance_payments) = 0
      )
  AND r.balance_payment_method IS NOT NULL
  AND r.balance_payment_method <> 'none'
  AND r.balance_payment_method <> ''
  AND COALESCE(r.total_amount, 0) - COALESCE(r.deposit, 0) > 0;

-- ----------------------------------------------------------------------------
-- 일자/결제수단별 매출 합계 뷰
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW daily_sales_by_method AS
SELECT
  date,
  method,
  SUM(amount)::numeric        AS total_amount,
  COUNT(DISTINCT reservation_id) AS reservation_count
FROM reservation_payment_lines
WHERE amount > 0
GROUP BY date, method;

-- ----------------------------------------------------------------------------
-- 기간별 결제수단 매출 조회 함수 (RPC 사용 가능)
--   예) select * from get_sales_by_method('2026-05-01','2026-05-31');
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_sales_by_method(p_start DATE, p_end DATE)
RETURNS TABLE (
  date              DATE,
  method            TEXT,
  total_amount      NUMERIC,
  reservation_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT date, method, total_amount, reservation_count
  FROM daily_sales_by_method
  WHERE date BETWEEN p_start AND p_end
  ORDER BY date DESC, method ASC;
$$;
