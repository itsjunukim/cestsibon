# API 참고서

쎄시봉 영업관리시스템의 데이터베이스 스키마와 API 엔드포인트 문서입니다.

---

## 📋 목차
1. [데이터베이스 스키마](#데이터베이스-스키마)
2. [주요 쿼리](#주요-쿼리)
3. [클라이언트 라이브러리](#클라이언트-라이브러리)

---

## 데이터베이스 스키마

### 1. profiles (사용자)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR,
  phone VARCHAR,
  role VARCHAR DEFAULT 'employee',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**컬럼 설명**:
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | Supabase Auth 사용자 ID |
| email | VARCHAR | 로그인 이메일 (유니크) |
| name | VARCHAR | 사용자 이름 |
| phone | VARCHAR | 전화번호 |
| role | VARCHAR | 권한 (admin/employee) |
| created_at | TIMESTAMP | 계정 생성일 |
| updated_at | TIMESTAMP | 마지막 수정일 |

---

### 2. accommodations (숙소)

```sql
CREATE TABLE accommodations (
  id BIGINT PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  contact VARCHAR,
  details TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**컬럼 설명**:
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT | 숙소 ID (PK) |
| name | VARCHAR | 숙소명 |
| contact | VARCHAR | 연락처 (전화번호) |
| details | TEXT | 상세 정보 |
| created_at | TIMESTAMP | 생성일 |
| updated_at | TIMESTAMP | 수정일 |

---

### 3. rooms (객실)

```sql
CREATE TABLE rooms (
  id BIGINT PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id BIGINT REFERENCES accommodations(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
```

**컬럼 설명**:
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT | 객실 ID (PK) |
| accommodation_id | BIGINT | 숙소 ID (FK) |
| name | VARCHAR | 객실 타입 (2인실, 4인실 등) |
| created_at | TIMESTAMP | 생성일 |

**관계**:
- accommodations : rooms = 1 : N
- 숙소 삭제 시 관련 객실도 함께 삭제 (CASCADE)

---

### 4. reservations (예약)

```sql
CREATE TABLE reservations (
  id BIGINT PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  customer_name VARCHAR NOT NULL,
  phone VARCHAR,
  email VARCHAR,
  reservation_type VARCHAR,
  headcount INT DEFAULT 1,
  accommodation_id BIGINT REFERENCES accommodations(id),
  room_id BIGINT REFERENCES rooms(id),
  total_amount NUMERIC DEFAULT 0,
  
  -- 상태 관리
  status VARCHAR DEFAULT 'booked',
  is_deposit_paid BOOLEAN DEFAULT false,
  deposit_paid_date DATE,
  balance_payment_method VARCHAR,
  is_visited BOOLEAN DEFAULT false,
  
  -- 메타데이터
  memo TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**컬럼 설명**:
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT | 예약 ID (PK) |
| date | DATE | 체크인 날짜 |
| customer_name | VARCHAR | 고객명 |
| phone | VARCHAR | 전화번호 |
| email | VARCHAR | 이메일 |
| reservation_type | VARCHAR | 예약 타입 (Single/Double/Group) |
| headcount | INT | 인원수 |
| accommodation_id | BIGINT | 숙소 ID (FK) |
| room_id | BIGINT | 객실 ID (FK) |
| total_amount | NUMERIC | 총 금액 (₩) — 최종 정산 기준 금액 |
| deposit | NUMERIC | 예약금 납부액 (실제 입금된 금액) |
| refund | NUMERIC | 환불금 (과다 입금 후 되돌려준 금액). 잔금 = total_amount − deposit + refund |
| status | VARCHAR | 상태 (booked/completed/cancelled) |
| is_deposit_paid | BOOLEAN | 예약금 납부 여부 |
| deposit_paid_date | DATE | 예약금 납부 날짜 |
| balance_payment_method | VARCHAR | 차액 결제수단 (이체/카드/현금) |
| is_visited | BOOLEAN | 고객 방문 여부 |
| memo | TEXT | 특이사항 메모 |
| created_at | TIMESTAMP | 생성일 |
| updated_at | TIMESTAMP | 수정일 |

**관계**:
- accommodations : reservations = 1 : N
- rooms : reservations = 1 : N

**상태값**:
```
'booked'     → 예약됨
'completed'  → 완료됨
'cancelled'  → 취소됨
```

---

## 주요 쿼리

### 대시보드 통계

#### 1. 기간별 매출 조회

```sql
SELECT 
  SUM(total_amount) as total_sales,
  COUNT(*) as total_reservations,
  SUM(headcount) as total_visitors
FROM reservations
WHERE 
  status != 'cancelled'
  AND date >= '2026-04-01'
  AND date <= '2026-04-30';
```

**반환**:
```json
{
  "total_sales": 5000000,
  "total_reservations": 15,
  "total_visitors": 42
}
```

#### 2. 일별 매출 조회

```sql
SELECT 
  date,
  SUM(total_amount) as daily_sales
FROM reservations
WHERE 
  status != 'cancelled'
  AND date >= '2026-04-01'
  AND date <= '2026-04-30'
GROUP BY date
ORDER BY date ASC;
```

**반환**:
```json
[
  { "date": "2026-04-01", "daily_sales": 300000 },
  { "date": "2026-04-02", "daily_sales": 450000 },
  ...
]
```

---

### 예약 조회

#### 1. 전체 예약 조회

```sql
SELECT 
  r.*,
  a.name as accommodation_name,
  rm.name as room_name
FROM reservations r
LEFT JOIN accommodations a ON r.accommodation_id = a.id
LEFT JOIN rooms rm ON r.room_id = rm.id
ORDER BY r.date DESC;
```

#### 2. 날짜별 예약 조회

```sql
SELECT 
  r.*,
  a.name as accommodation_name
FROM reservations r
LEFT JOIN accommodations a ON r.accommodation_id = a.id
WHERE r.date = '2026-04-13'
ORDER BY r.created_at DESC;
```

#### 3. 고객명 검색

```sql
SELECT *
FROM reservations
WHERE customer_name ILIKE '%홍%'
ORDER BY date DESC;
```

#### 4. 전화번호 검색

```sql
SELECT *
FROM reservations
WHERE phone ILIKE '%01012345678%'
ORDER BY date DESC;
```

---

### 숙소 조회

#### 1. 숙소 목록 (객실 포함)

```sql
SELECT 
  a.*,
  json_agg(
    json_build_object(
      'id', r.id,
      'name', r.name
    )
  ) as rooms
FROM accommodations a
LEFT JOIN rooms r ON a.id = r.accommodation_id
GROUP BY a.id
ORDER BY a.created_at DESC;
```

**반환**:
```json
[
  {
    "id": 1,
    "name": "길조호텔",
    "contact": "031-123-4567",
    "details": "산 위치",
    "rooms": [
      { "id": 1, "name": "2인실" },
      { "id": 2, "name": "4인실" }
    ]
  },
  ...
]
```

---

### 통계 쿼리

#### 1. 상태별 예약 통계

```sql
SELECT 
  status,
  COUNT(*) as count,
  SUM(total_amount) as total
FROM reservations
WHERE date >= '2026-04-01' AND date <= '2026-04-30'
GROUP BY status;
```

**반환**:
```json
[
  { "status": "booked", "count": 10, "total": 3000000 },
  { "status": "completed", "count": 5, "total": 2000000 },
  { "status": "cancelled", "count": 2, "total": 500000 }
]
```

#### 2. 결제수단별 통계

```sql
SELECT 
  balance_payment_method,
  COUNT(*) as count,
  SUM(total_amount) as total
FROM reservations
WHERE 
  status = 'completed'
  AND date >= '2026-04-01'
  AND date <= '2026-04-30'
GROUP BY balance_payment_method;
```

#### 3. 예약금 납부 현황

```sql
SELECT 
  is_deposit_paid,
  COUNT(*) as count,
  SUM(total_amount) as total
FROM reservations
WHERE status = 'booked'
GROUP BY is_deposit_paid;
```

---

## 클라이언트 라이브러리

### Supabase JavaScript 클라이언트

#### 초기화

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xxxxx.supabase.co',
  'xxxxxxxxxxxxxxxxxxxxxxx'
)
```

#### 데이터 조회

```typescript
// 전체 조회
const { data, error } = await supabase
  .from('reservations')
  .select('*')

// 조건 조회
const { data, error } = await supabase
  .from('reservations')
  .select('*')
  .eq('status', 'booked')
  .gte('date', '2026-04-01')
  .lte('date', '2026-04-30')

// 관계 조회
const { data, error } = await supabase
  .from('accommodations')
  .select('*, rooms(*)')
```

#### 데이터 생성

```typescript
const { data, error } = await supabase
  .from('reservations')
  .insert([
    {
      date: '2026-04-13',
      customer_name: '홍길동',
      phone: '010-1234-5678',
      total_amount: 300000,
      status: 'booked'
    }
  ])
  .select()
  .single()
```

#### 데이터 수정

```typescript
const { data, error } = await supabase
  .from('reservations')
  .update({ status: 'completed' })
  .eq('id', 123)
```

#### 데이터 삭제

```typescript
const { error } = await supabase
  .from('reservations')
  .delete()
  .eq('id', 123)
```

---

### React Query 사용 예시

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query'

// 데이터 조회
const { data: reservations } = useQuery({
  queryKey: ['reservations'],
  queryFn: async () => {
    const { data } = await supabase
      .from('reservations')
      .select('*')
    return data
  }
})

// 데이터 무효화 (새로고침)
const queryClient = useQueryClient()
queryClient.invalidateQueries({ queryKey: ['reservations'] })
```

---

## 인증 (Authentication)

### 로그인

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
})
```

### 로그아웃

```typescript
const { error } = await supabase.auth.signOut()
```

### 현재 사용자

```typescript
const { data: { user } } = await supabase.auth.getUser()
```

---

## RLS (Row Level Security)

현재 시스템의 RLS 정책:

### profiles 테이블
- 모든 사용자: 자신의 프로필만 조회/수정
- 관리자: 모든 프로필 조회 가능

### reservations 테이블
- 모든 사용자: 조회/생성 가능
- 관리자: 모든 데이터 수정/삭제 가능

---

## 에러 처리

### 일반적인 에러

```typescript
const { data, error } = await supabase
  .from('reservations')
  .select('*')

if (error) {
  console.error('Error:', error.message)
  // 에러 처리
}
```

### 에러 타입

| 코드 | 메시지 | 원인 |
|------|--------|------|
| 23505 | 유니크 제약 위반 | 중복된 데이터 |
| 23503 | 외래키 제약 위반 | 관련 데이터 미존재 |
| 42P01 | 테이블 없음 | 테이블 명 오류 |
| 25006 | 권한 없음 | RLS 정책 거부 |

---

## 성능 최적화

### 인덱스

주요 인덱스:

```sql
CREATE INDEX idx_reservations_date ON reservations(date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_customer_name ON reservations(customer_name);
CREATE INDEX idx_rooms_accommodation_id ON rooms(accommodation_id);
```

### 쿼리 최적화

```typescript
// ❌ 나쁜 예
const { data } = await supabase
  .from('reservations')
  .select('*')  // 모든 컬럼 조회

// ✅ 좋은 예
const { data } = await supabase
  .from('reservations')
  .select('id, customer_name, date, total_amount')  // 필요한 컬럼만 조회
  .eq('status', 'booked')
```

---

## 개발 팁

### 로컬 테스트

```bash
# Supabase 로컬 개발
npx supabase start

# 데이터베이스 마이그레이션
npx supabase migration new create_tables
```

### 쿼리 디버깅

```typescript
// 쿼리 로깅
console.log('Query:', { table, filters })
const { data, error } = await query

if (error) {
  console.error('DB Error:', error)
} else {
  console.log('Result:', data)
}
```

---

## 참고 리소스

- [Supabase 공식 문서](https://supabase.com/docs)
- [Supabase JavaScript 클라이언트](https://supabase.com/docs/reference/javascript/introduction)
- [PostgreSQL 문서](https://www.postgresql.org/docs/)
- [React Query 문서](https://tanstack.com/query/latest)

---

**마지막 업데이트**: 2026년 4월

**버전**: v1.0
