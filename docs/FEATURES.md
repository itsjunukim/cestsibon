# 기능 명세서

## 개요

쎄시봉 영업관리시스템의 모든 기능에 대한 상세 명세입니다.

---

## 1. 인증 및 권한

### 1.1 로그인
- **경로**: `/login`
- **기능**: 이메일/비밀번호 기반 인증
- **Supabase Auth** 연동
- **세션 관리**: 자동 로그아웃 (24시간 미사용 시)

### 1.2 권한 관리
```
관리자 (Admin)
├── 직원 계정 CRUD
├── 모든 데이터 조회/수정
└── 시스템 설정 변경

직원 (Employee)
├── 예약 조회/생성/수정/삭제
├── 숙소 조회
└── 매출 조회 (PIN 필요)
```

---

## 2. 대시보드 (/)

### 2.1 화면 구성
```
┌─────────────────────────────────────┐
│  영업 현황 대시보드    [오늘][주][달] │
├─────────────────────────────────────┤
│  📊 매출    📈 예약    👥 방문객     │
│  ₩ XXX,XXX  XXX건      XXX명        │
├─────────────────────────────────────┤
│  매출 추이 (차트)                    │
│  [클릭하면 해당 날짜 예약 조회]     │
└─────────────────────────────────────┘
```

### 2.2 주요 기능

#### 2.2.1 통계 카드 (6가지)
| 항목 | 계산식 | 단위 | 보호 |
|------|-------|------|------|
| 총 예상 매출 | SUM(total_amount) — 취소 제외 (미입금·미정산 포함) | ₩ | PIN |
| 총 매출 | (예약금 − 환불금) + 정산된 잔금 합계 | ₩ | PIN |
| 정산 후 순매출 | 총 매출 − 정산 관리에서 정산 완료(is_paid=true) 처리된 금액 | ₩ | PIN |
| 예약 건수 | COUNT(*) | 건 | PIN |
| 총 방문객 | SUM(headcount) | 명 | PIN |
| 총 댕댕이 | SUM(dog_count) | 마리 | PIN |

**PIN 보호 로직**:
- PIN 미입력 시: "***,***" 마스킹
- PIN 입력 후: 실제 수치 표시
- 페이지 이동 시: 잠금 자동 해제

#### 2.2.2 기간 선택
- **오늘** (Daily): 당일 00:00 ~ 23:59
- **이번 주** (Weekly): 월요일 ~ 일요일 (주 시작: 월요일)
- **이번 달** (Monthly): 1일 ~ 말일

#### 2.2.3 매출 추이 차트
- **X축**: 날짜 (MM.dd 형식)
- **Y축**: 일일 매출액 (₩)
- **클릭 이벤트**: 차트 바 클릭 → `/reservations?date=YYYY-MM-DD`로 이동
- **취소 제외**: status='cancelled'인 예약 제외

#### 2.2.4 PIN 잠금 해제
- **위치**: 좌상단 잠금 아이콘 클릭
- **다이얼로그**: PIN 입력 (숫자만)
- **타입**: `PinUnlockDialog` 컴포넌트
- **상태 유지**: 다른 페이지 이동 시 초기화

---

## 3. 예약 관리 (/reservations)

### 3.1 데이터 구조
```sql
CREATE TABLE reservations (
  id BIGINT PRIMARY KEY,
  date DATE,
  customer_name VARCHAR,
  phone VARCHAR,
  reservation_type VARCHAR,
  headcount INT,
  accommodation_id BIGINT,
  room_id BIGINT,
  total_amount NUMERIC,
  
  -- 상태 관리
  status VARCHAR ('booked' | 'completed' | 'cancelled'),
  is_deposit_paid BOOLEAN,
  deposit_paid_date DATE,
  balance_payment_method VARCHAR ('이체' | '카드' | '현금'),
  is_visited BOOLEAN,
  
  -- 메타데이터
  memo TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 3.2 주요 기능

#### 3.2.1 예약 목록 조회
**테이블 컬럼**:
1. No. (넘버링)
2. 예약자명
3. 전화번호
4. 예약일자
5. 객실 타입
6. 인원수
7. 금액
8. 예약금 확인 (체크박스)
9. 차액 결제수단 (드롭다운)
10. 고객 방문 (체크박스)
11. 메모
12. 상태
13. 관리 (수정/삭제)

**페이지네이션**: 초당 화면에 보이는 모든 데이터 로드 (무한 스크롤 미적용)

#### 3.2.2 필터링

**기간 선택** (좌상단 퀵 버튼):
```
┌──────────────────┐
│ [당일] [금주] [월] │
└──────────────────┘
```
- **당일**: 오늘만 조회
- **금주**: 월요일 ~ 일요일 (주 시작: 월요일)
- **이번달**: 1일 ~ 말일
- **달력**: 특정 날짜 범위 선택 가능

**상태 필터**:
- booked (예약)
- completed (완료)
- cancelled (취소)
- 선택 해제 시: 모두 표시

#### 3.2.3 검색
**검색 대상**:
- 예약자명 (LIKE)
- 전화번호 (LIKE)
- 메모 (LIKE)

**검색 방식**: 실시간 필터링 (onChange)

#### 3.2.4 정렬
**정렬 가능 컬럼**:
- 예약자명 (ASC/DESC)
- 날짜 (ASC/DESC)
- 금액 (ASC/DESC)

**기본 정렬**: 날짜 내림차순 (최신 먼저)

#### 3.2.5 열 가시성 제어
**위치**: 좌상단 "열 선택" 아이콘
**동작**: 선택한 컬럼만 테이블에 표시
**저장**: localStorage에 사용자 선택 저장

#### 3.2.5b 환불금 (Refund)
```
예약금 입력란 우측에 환불금 입력란 표시
계산식: 잔금 = 총 결제금액 − 예약금 + 환불금
실현 예약금 = 예약금 − 환불금
```
**용도**: 예약금을 과다 입금받아 일부 환불해준 경우(예: 38만원 예약금 → 4만원 환불 → 실수령 34만원) 기록한다. 총 결제금액(`total_amount`)은 최종 정산 기준 금액 그대로 유지하고, 환불금을 별도로 적어 정확한 실현 매출이 계산되도록 한다.

#### 3.2.6 예약금 확인 (Deposit Paid)
```
[☐] → 미결제 (is_deposit_paid = false)
[☑] → 결제 완료 (is_deposit_paid = true)
       └─ 날짜 피커 활성화 (기본값: 당일)
```
**동작**:
1. 체크박스 클릭
2. 데이터베이스 즉시 업데이트
3. is_deposit_paid = true/false
4. deposit_paid_date 업데이트

#### 3.2.7 차액 결제수단 (Balance Payment Method)
```
드롭다운 옵션:
├── 미정 (none, 현장결제 혹은 추후)
├── 계좌이체 (transfer)
├── 카드 결제 (card)
├── 현금 결제 (cash)
├── 플레이스 결제 (place)
├── 스토어 결제 (store)
└── 소셜 결제 (social)
```
**저장**: balance_payment_method 컬럼에 저장
**예약 목록 표시**: 잔금 옆 배지로 축약 라벨(이체/카드/현금/플레이스/스토어/소셜) 노출

#### 3.2.8 고객 방문 상태 (Visited)
```
[☐] → 미방문 (is_visited = false)
[☑] → 방문 완료 (is_visited = true)
       └─ 행 배경색 변경 (초록색 강조)
```

#### 3.2.9 예약 생성/수정

**다이얼로그**: 우측 상단 "새 예약 추가" 버튼 클릭

**입력 필드**:
- 예약자명 (필수)
- 전화번호 (필수)
- 이메일 (선택)
- 예약 타입 (선택: Single/Double/Group)
- 체크인 날짜 (필수)
- 체크아웃 날짜 (필수)
- 인원수 (필수, 기본: 1)
- 숙소 선택 (필수)
- 객실 타입 (필수)
- 총 금액 (필수)
- 메모 (선택)

**유효성 검사**:
- 필수 필드 체크
- 금액 숫자 검증
- 체크아웃 > 체크인 검증

**저장 시**:
```typescript
// 신규
INSERT INTO reservations (...)
RETURNING id;

// 수정
UPDATE reservations SET ... WHERE id = ?;
```

**캘린더 표기**:
- 예약 날짜 / 예약금 입금일 캘린더에서 **금요일·토요일** 날짜 폰트는 빨간색(`text-red-500`)으로 강조
- 선택된 날짜는 기존 강조색(primary) 유지

#### 3.2.10 예약 삭제 (취소)

**동작**:
1. 휴지통 아이콘 클릭
2. "정말 삭제하시겠습니까?" 확인
3. DELETE 실행
4. 테이블 새로고침

**이력 보관**: 향후 취소 이력 관리 테이블 추가 예정

---

## 4. 숙소 관리 (/accommodations)

### 4.1 데이터 구조
```sql
CREATE TABLE accommodations (
  id BIGINT PRIMARY KEY,
  name VARCHAR,
  contact VARCHAR,
  details TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE rooms (
  id BIGINT PRIMARY KEY,
  accommodation_id BIGINT REFERENCES accommodations(id),
  name VARCHAR,
  created_at TIMESTAMP
);
```

### 4.2 주요 기능

#### 4.2.1 숙소 목록
**테이블 컬럼**:
1. No. (넘버링)
2. 숙소명
3. 방 종류 (뱃지 목록)
4. 연락처
5. 세부사항
6. 관리 (수정/삭제)

#### 4.2.2 숙소 생성
**다이얼로그**: 우측 상단 "새 숙소 추가" 버튼

**입력 필드**:
- 숙소명 (필수, 최소 2자)
- 연락처 (선택)
- 상세 정보 (선택, textarea)
- 방 종류 (배열):
  - 동적 추가/제거 가능
  - 각 방마다 이름 입력

**저장 프로세스**:
```typescript
// 1. 숙소 생성
const accommodation = await supabase
  .from('accommodations')
  .insert([...])
  .select()
  .single();

// 2. 객실들 생성
const rooms = await supabase
  .from('rooms')
  .insert([
    { accommodation_id: accommodation.id, name: 'room1' },
    { accommodation_id: accommodation.id, name: 'room2' }
  ]);
```

#### 4.2.3 숙소 수정
**수정 대상**:
- 숙소명, 연락처, 상세 정보
- 객실 타입 (기존 삭제 후 새로 생성)

**동작**:
1. 연필 아이콘 클릭
2. 정보 수정
3. "저장" 클릭

#### 4.2.4 숙소 삭제
**동작**:
1. 휴지통 아이콘 클릭
2. 확인 (cascade 삭제: 관련 객실도 함께 삭제)

---

## 5. 이용권 관리 (/tickets)

### 5.1 데이터 구조
```sql
tickets (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,           -- 이용권 명칭 (예: 종일권, 오전권)
  price NUMERIC NOT NULL,       -- 가격
  display_order INTEGER,        -- 표시 순서 (오름차순)
  created_at TIMESTAMPTZ
)
```

### 5.2 주요 기능

#### 5.2.1 이용권 목록
- **정렬 기준**: `display_order` ASC, 동순위는 `name` ASC
- **표시 항목**: No., 이용권 명칭, 가격, 관리(수정/삭제)
- 첫 행에 드래그 손잡이(≡) 노출

#### 5.2.2 수동 정렬 (드래그앤드롭)
**동작**:
1. 좌측 ≡ 손잡이 클릭/터치 후 드래그
2. 놓으면 즉시 DB의 `display_order` 일괄 갱신 (낙관적 UI 업데이트)
3. 실패 시 알림 후 원복

**적용 범위**:
- 이용권 관리 페이지 목록 정렬
- 예약 생성/수정 폼의 이용권 드롭다운 순서

#### 5.2.3 이용권 추가/수정
- **추가**: 신규 이용권은 `MAX(display_order) + 1`로 자동 부여 → 목록 맨 끝에 배치
- **수정**: 명칭/가격만 변경, 순서는 유지

#### 5.2.4 이용권 삭제
- 휴지통 아이콘 클릭 → 확인 → DELETE
- 참조 중인 예약(`reservation_tickets`)이 있으면 cascade 처리

---

## 6. 영업 현황 (/sales)

### 5.1 화면 구성

```
┌──────────────────────────────────┐
│  영업 현황    [오늘][이번주][이번달]  │
├──────────────────────────────────┤
│  [🔒 PIN 입력 필요]              │
├──────────────────────────────────┤
│  매출 추이 차트                   │
├──────────────────────────────────┤
│  상세 내역 (최근 5건)            │
└──────────────────────────────────┘
```

### 5.2 주요 기능

#### 5.2.1 기간 선택
- **오늘** (Daily): 당일 전체
- **이번 주** (Weekly): 월 ~ 일
- **이번 달** (Monthly): 1일 ~ 말일

#### 5.2.2 PIN 잠금
**비활성화 기능**:
- PIN 미입력 시 통계 블러 처리
- 클릭하면 PIN 입력 다이얼로그 표시

**보호 데이터**:
- 총 매출
- 매출 추이 차트
- 상세 내역

#### 5.2.3 통계

| 항목 | 계산식 |
|------|-------|
| 총 매출 | SUM(total_amount) |
| 예약 건수 | COUNT(*) |
| 평균 결제액 | ROUND(SUM / COUNT) |

#### 5.2.4 매출 추이 차트
- **타입**: 막대 그래프
- **X축**: 날짜
- **Y축**: 금액 (₩)
- **데이터**: 취소 제외한 모든 예약

#### 5.2.5 상세 내역 테이블
**표시 항목**:
1. 날짜
2. 유형 (예약 타입)
3. 예약자 (이름)
4. 금액 (₩)
5. 상태 (booked/completed)

**조건**: 최근 5건만 표시 (날짜 내림차순)

---

## 7. 직원 관리 (/admin/users)

### 6.1 데이터 구조
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE,
  name VARCHAR,
  phone VARCHAR,
  role VARCHAR ('admin' | 'employee'),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 6.2 주요 기능

#### 6.2.1 계정 목록
**테이블 컬럼**:
1. No. (넘버링)
2. 이메일
3. 이름
4. 전화번호
5. 권한 (뱃지)
6. 생성일
7. 관리 (삭제)

#### 6.2.2 계정 생성

**다이얼로그**: 우측 상단 "새 직원 등록" 버튼

**입력 필드**:
- 이메일 (필수, 유니크)
- 비밀번호 (필수, 최소 6자)
- 이름 (필수)
- 전화번호 (선택)
- 권한 (필수, 드롭다운):
  - 직원 (Employee)
  - 관리자 (Admin)

**저장 프로세스**:
```typescript
// 1. Supabase Auth 사용자 생성
const { user } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true
});

// 2. Profile 정보 저장
await supabase.from('profiles').insert({
  id: user.id,
  email,
  name,
  phone,
  role
});
```

#### 6.2.3 계정 삭제

**동작**:
1. 휴지통 아이콘 클릭
2. "계정을 정말 삭제하시겠습니까?" 확인
3. 완료

**삭제 처리**:
- Supabase Auth에서 사용자 삭제
- profiles 테이블에서 프로필 삭제

---

## 8. 예약금 미입금 알림

### 7.1 알림 조건
```
is_deposit_paid = false
AND status = 'booked'
AND 오늘 ≤ date ≤ 오늘 + 2일
```
예약일 기준 D-2부터 예약금 미입금 건을 상시 알림.

### 7.2 UI 구성
- **위치**: PC 사이드바 로고 옆 / 모바일 상단 햄버거 메뉴 옆
- **배지**: 빨간색 원형 배지로 미입금 건수 표시 (0건이면 배지 숨김)
- **팝오버**: 클릭 시 알림 목록 드롭다운 표시

### 7.3 알림 항목 표시
| 항목 | 설명 |
|------|------|
| D-Day 뱃지 | 오늘(빨강) / 내일(주황) / 모레(앰버) |
| 고객명 | 예약자명 |
| 예약 정보 | 유형(숙박/당일), 인원, 연락처 |
| 미입금액 | 총액 - 예약금 |

### 7.4 연동
- 알림 항목 클릭 → `/reservations?edit={id}` → 예약 수정 다이얼로그 자동 오픈
- URL의 `edit` 파라미터는 다이얼로그 오픈 후 즉시 제거 (재클릭 대응)
- **자동 갱신**: React Query `refetchInterval: 5분`
- **실시간 반영**: 예약 저장/입금 체크/취소 시 알림 목록 즉시 업데이트

---

## 9. 모바일 UI/UX

### 8.1 하단 탭 바
- **표시**: `md:hidden` (모바일에서만)
- **항목**: 영업현황 / 예약관리 / 이용권 / 숙소관리
- **위치**: `fixed bottom-0` 하단 고정
- 현재 페이지 활성 탭 primary 색상 표시

### 8.2 모바일 카드 뷰
테이블 대신 카드 리스트 형태로 표시 (모바일):

**예약 관리**:
- 예약 유형 뱃지 + 고객명 + 상태 뱃지
- 날짜, 인원, 연락처, 숙소, 금액, 메모
- 카드 탭 → 수정 다이얼로그 오픈

**숙소 관리**:
- 숙소명, 연락처, 세부사항, 방 종류 뱃지
- 수정/삭제 버튼

### 8.3 반응형 대응
- 상단 헤더: 로고 + "쎄시봉 영업관리시스템" (PC와 동일)
- 영업현황 상세 테이블: 가로 스크롤 (`overflow-x-auto`)
- 예약 필터/검색: `w-full md:w-auto`로 모바일 전체 너비

---

## 10. 공통 기능

### 7.1 데이터 새로고침
- **방법**: React Query의 `useQuery` 훅 사용
- **캐시**: queryKey 기반 자동 캐싱
- **무효화**: 업데이트 후 `queryClient.invalidateQueries()` 호출

### 7.2 에러 처리
```typescript
if (error) {
  console.error(error);
  alert('작업 실패: ' + error.message);
}
```

### 7.3 로딩 상태
- 테이블: "불러오는 중..." 메시지
- 버튼: Loader2 아이콘 회전

### 7.4 빈 상태
- 테이블: "등록된 데이터가 없습니다." 메시지

---

## 11. 향후 개선사항

- [ ] 예약 취소 이력 별도 관리
- [ ] SMS/카카오 알림톡 발송
- [ ] 예약금 자동 계산
- [ ] 정산 보고서 생성
- [ ] 예약 현황 캘린더 뷰
- [ ] 고객 히스토리 (재방문 추적)
- [ ] API 공개

---

**마지막 업데이트**: 2026년 4월
