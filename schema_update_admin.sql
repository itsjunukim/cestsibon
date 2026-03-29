-- Phase 1: 관리자 관리 기능 개선을 위한 DB 스키마 업데이트

-- 1. 예약금 확인 (납입 여부 및 납입 일자)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_deposit_paid BOOLEAN DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit_paid_date DATE;

-- 2. 결제 관리 (차액 결제 수단: '이체', '카드', '현금' 등을 저장)
-- 값으로는 'transfer', 'card', 'cash' 등을 사용할 예정입니다.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS balance_payment_method TEXT;

-- 3. 방문 여부 체크 
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_visited BOOLEAN DEFAULT false;

-- (참고사항) 취소 기능은 이미 reservations 테이블의 status 컬럼이 ('booked', 'completed', 'cancelled') 제약조건을 가지고 있으므로,
-- 하드 삭제(DELETE) 대신 status를 'cancelled'로 변경하는 방식으로 구현합니다.
