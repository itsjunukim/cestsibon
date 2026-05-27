-- ============================================================================
-- 양평 매출 v8 — 결제 수단 2종 추가
-- ============================================================================
-- 기존: 카드 / 현금 / 이체
-- 추가: 예약금(이체) / 네이버
-- total_amount = 카드 + 현금 + 이체 + 예약금(이체) + 네이버
-- ============================================================================

ALTER TABLE public.yp_daily_sales
  ADD COLUMN IF NOT EXISTS deposit_transfer_amount NUMERIC NOT NULL DEFAULT 0,  -- 예약금(이체)
  ADD COLUMN IF NOT EXISTS naver_amount            NUMERIC NOT NULL DEFAULT 0;  -- 네이버

-- 합계 트리거에 신규 컬럼 반영
CREATE OR REPLACE FUNCTION public.yp_daily_recalc()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_amount =
      COALESCE(NEW.card_amount,0)
    + COALESCE(NEW.cash_amount,0)
    + COALESCE(NEW.transfer_amount,0)
    + COALESCE(NEW.deposit_transfer_amount,0)
    + COALESCE(NEW.naver_amount,0);
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- 기존 행의 total_amount 재계산 (신규 컬럼 0이라 변동 없지만 안전하게)
UPDATE public.yp_daily_sales SET updated_at = updated_at;
