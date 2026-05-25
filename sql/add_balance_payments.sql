-- reservations 테이블에 다중 결제 수단을 저장하기 위한 JSONB 컬럼 추가
ALTER TABLE reservations 
ADD COLUMN balance_payments JSONB DEFAULT '[]'::jsonb;
