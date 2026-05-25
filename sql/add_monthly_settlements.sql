CREATE TABLE IF NOT EXISTS monthly_settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  accommodation_id UUID NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  settlement_month DATE NOT NULL, -- 저장 형식: YYYY-MM-01 (해당 월의 1일)
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(accommodation_id, settlement_month)
);

-- RLS 설정
ALTER TABLE monthly_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for anon" ON monthly_settlements;
CREATE POLICY "Enable all access for anon" ON monthly_settlements FOR ALL USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_monthly_settlements_acc_month ON monthly_settlements(accommodation_id, settlement_month);
