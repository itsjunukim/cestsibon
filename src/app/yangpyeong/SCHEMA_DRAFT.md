# 양평 수상레저 스키마 초안 (Schema Draft)

가평(숙박 중심)과 다르게 양평은 수상레저(당일 발권, 기구 이용) 중심이므로 다음과 같이 전용 테이블(Prefix: `yp_`)을 구성하는 것을 권장합니다.

## 1. yp_tickets (티켓/이용권 상품)
- `id` (uuid)
- `name` (text) - 예: "블롭점프 1회권", "바나나보트", "종일무제한권"
- `price` (numeric)
- `is_active` (boolean)

## 2. yp_sales (현장 결제/발권 내역)
- `id` (uuid)
- `sale_date` (date)
- `total_amount` (numeric)
- `payment_methods` (jsonb) - 분할 결제 지원용 (가평의 balance_payments와 유사)
- `customer_name` (text, nullable)
- `customer_phone` (text, nullable)

## 3. yp_sale_items (판매된 상세 내역)
- `id` (uuid)
- `sale_id` (uuid, fk -> yp_sales)
- `ticket_id` (uuid, fk -> yp_tickets)
- `quantity` (integer)
- `unit_price` (numeric)

## 4. yp_daily_settlements (양평 전용 일일 정산)
- `id` (uuid)
- `settlement_date` (date)
- `total_sales` (numeric)
- `is_closed` (boolean) - 마감 여부

---

> 이 스키마는 기획이 구체화됨에 따라 언제든지 변경될 수 있습니다.
> 실제 DB 구성은 기획안이 확정된 후 Supabase 마이그레이션 스크립트를 통해 생성하세요.
