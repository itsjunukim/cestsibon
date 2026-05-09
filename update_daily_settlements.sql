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

-- RLS 설정
ALTER TABLE daily_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for anon" ON daily_settlements;
CREATE POLICY "Enable all access for anon" ON daily_settlements FOR ALL USING (true) WITH CHECK (true);
