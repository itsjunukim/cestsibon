-- 숙소 정산 금액 테이블
-- 예약건별로 숙소에 정산해야 하는 금액을 관리
-- 추후 '숙소 정산 관리' 메뉴에서 기간별/숙소별 취합에 활용

CREATE TABLE IF NOT EXISTS accommodation_settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  accommodation_id UUID REFERENCES accommodations(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('accommodation', 'meat', 'other')),
  amount NUMERIC NOT NULL DEFAULT 0,
  memo TEXT, -- '기타' 카테고리일 경우 사유 메모
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 설정
ALTER TABLE accommodation_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for anon" ON accommodation_settlements;
CREATE POLICY "Enable all access for anon" ON accommodation_settlements FOR ALL USING (true) WITH CHECK (true);

-- 인덱스: 예약건별 조회 및 숙소별/기간별 취합 최적화
CREATE INDEX IF NOT EXISTS idx_settlements_reservation ON accommodation_settlements(reservation_id);
CREATE INDEX IF NOT EXISTS idx_settlements_accommodation ON accommodation_settlements(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_settlements_created ON accommodation_settlements(created_at);
