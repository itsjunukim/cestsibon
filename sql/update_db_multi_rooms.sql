-- 1. 새로운 연결 테이블 생성
CREATE TABLE IF NOT EXISTS reservation_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reservation_id, room_id)
);

-- 2. RLS 활성화 및 권한 설정
ALTER TABLE reservation_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for anon" ON reservation_rooms;
CREATE POLICY "Enable all access for anon" ON reservation_rooms FOR ALL USING (true) WITH CHECK (true);

-- 3. 기존 데이터 마이그레이션 (기존 reservations 테이블에 room_id가 있는 경우)
-- 중복 삽입 방지를 위해 ON CONFLICT 사용 (UNIQUE 제약 조건 필요)
INSERT INTO reservation_rooms (reservation_id, room_id)
SELECT id, room_id
FROM reservations
WHERE room_id IS NOT NULL
ON CONFLICT (reservation_id, room_id) DO NOTHING;

-- 선택 사항: 나중에 기존 reservations.room_id 컬럼을 삭제할 수 있으나 
-- 롤백의 안전성을 위해 당분간 남겨두는 것을 권장합니다.
