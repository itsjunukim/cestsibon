-- 1. 새로운 연결 테이블 (예약-이용권) 생성
CREATE TABLE IF NOT EXISTS reservation_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 기존 reservations 테이블에 있던 단일 ticket_id 데이터를 새 테이블로 이관
-- (기존에 선택했던 티켓이 있다면 수량 1개로 옮겨줌)
INSERT INTO reservation_tickets (reservation_id, ticket_id, quantity)
SELECT id, ticket_id, 1
FROM reservations
WHERE ticket_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM reservation_tickets WHERE reservation_tickets.reservation_id = reservations.id
  );

-- 3. RLS(보안) 정책 설정
ALTER TABLE reservation_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for anon" ON reservation_tickets;
CREATE POLICY "Enable all access for anon" ON reservation_tickets FOR ALL USING (true) WITH CHECK (true);

-- (선택) 하위 호환성을 위해 당분간 reservations 테이블의 ticket_id 컬럼은 남겨둡니다.
-- 나중에 완전히 정리될 때 DROP 할 수 있습니다.
