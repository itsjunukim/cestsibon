-- 예약별 커스텀 알림 테이블
CREATE TABLE IF NOT EXISTS reservation_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  message TEXT NOT NULL,
  is_dismissed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE reservation_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for anon" ON reservation_alerts;
CREATE POLICY "Enable all access for anon" ON reservation_alerts FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_reservation_alerts_active
  ON reservation_alerts(scheduled_at, is_dismissed)
  WHERE is_dismissed = false;

CREATE INDEX IF NOT EXISTS idx_reservation_alerts_reservation
  ON reservation_alerts(reservation_id);
