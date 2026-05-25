-- reservations 테이블에 room_id 컬럼 추가
-- 방이 삭제되어도 예약 기록은 보존 (ON DELETE SET NULL)
alter table reservations
  add column if not exists room_id uuid references rooms(id) on delete set null;
