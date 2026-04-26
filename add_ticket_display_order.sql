-- 이용권(tickets) 수동 정렬 기능 추가
-- 관리자가 직접 표시 순서를 지정할 수 있도록 display_order 컬럼 도입

-- 1. display_order 컬럼 추가
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- 2. 기존 데이터 백필: 현재 가나다순 위치를 그대로 초기 순서로 부여
WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS rn
    FROM tickets
)
UPDATE tickets
SET display_order = ordered.rn
FROM ordered
WHERE tickets.id = ordered.id
  AND tickets.display_order IS NULL;

-- 3. 정렬 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_tickets_display_order ON tickets(display_order);
