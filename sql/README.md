# SQL 마이그레이션

쎄시봉 영업관리시스템에서 Supabase에 적용하는 모든 DB 스크립트입니다.
모든 스크립트는 **Supabase 대시보드 → SQL Editor**에서 실행합니다.

---

## 빠른 시작 (신규 환경 부트스트랩)

신규 Supabase 프로젝트에 처음 셋업할 때만 아래 순서대로 실행합니다.
이미 라이브 운영 중이라면 건너뛰고 "마이그레이션 히스토리"에서 미적용 항목만 실행합니다.

1. `schema.sql` — 가평 기본 테이블 (reservations, accommodations, rooms, sales, tickets …)
2. `setup_roles.sql` — `profiles` 테이블 + 신규 가입 트리거
3. `fix_db.sql` — tickets 테이블 + reservations 컬럼 보강 + 기본 시드
4. `seed.sql` — 시연용 샘플 데이터 (선택)
5. 아래 "마이그레이션 히스토리" 의 가평/공통/양평 스크립트를 시간순으로 적용
6. `secure_rls_policies.sql` — RLS 보안 잠금
7. `multisite_permissions.sql` — 멀티사이트(가평·양평) 권한 모델

---

## 마이그레이션 히스토리 (적용 순서)

### 가평 기능 누적

| 파일 | 목적 |
|---|---|
| `add_profile_columns.sql` | profiles 에 name·phone 컬럼 |
| `add_rooms_table.sql` | rooms 테이블 신설 |
| `update_db_add_reservation_room.sql` | reservations.room_id (단일) |
| `update_db_multi_rooms.sql` | reservation_rooms 다대다 |
| `update_db_multi_tickets.sql` | reservation_tickets 다대다 |
| `add_ticket_display_order.sql` | 이용권 수동 정렬 |
| `add_settlement.sql` | accommodation_settlements (숙소 정산) |
| `update_accommodation_settlements.sql` | 정산 컬럼 보강 |
| `add_monthly_settlements.sql` | 월별 정산 누적 |
| `update_daily_settlements.sql` | daily_settlements + 결제수단별 매출 뷰/RPC |
| `update_db_reservation_alerts.sql` | 맞춤 알림 (reservation_alerts) |
| `add_balance_payments.sql` | 차액 분할 결제 (balance_payments JSONB) |

### 운영 보강 / 일회성 픽스

| 파일 | 목적 |
|---|---|
| `update_schema.sql` | 초기 스키마 보강 |
| `schema_update_admin.sql` | admin 관련 컬럼 |
| `fix_admin_profile.sql` | 초기 admin 계정 프로필 보정 |
| `fix_sidebar_profile.sql` | 사이드바 표시용 프로필 정책 보정 |

### 보안 / 권한 모델

| 파일 | 목적 |
|---|---|
| `secure_rls_policies.sql` | 모든 가평 테이블 RLS 잠금 + `is_admin()` 헬퍼 |
| `relock_daily_settlements.sql` | `update_daily_settlements.sql` 재실행으로 풀린 정책 재잠금 |
| `multisite_permissions.sql` | profiles.site 컬럼 + `super_admin`/`admin`/`employee` × `all`/`gapyeong`/`yangpyeong` 권한 모델 + 가평 테이블 사이트 인식형 RLS |

### 양평 (수상레저)

| 파일 | 목적 |
|---|---|
| `yp_create_sales.sql` | (v1, **폐기 예정**) yp_sales 라인 단위 테이블 |
| `yp_redesign_sales_v2.sql` | v2 재설계 — yp_products 마스터 + yp_sales 헤더 + yp_sale_items 다대다 + 합계 트리거 + RLS + yp_coupon_balance 뷰 갱신. v1 객체를 DROP 후 재생성 |
| `yp_simplify_v3.sql` | v3 단순화 — 가평 tickets 와 동일 스키마로 정리. yp_products 의 category·is_active 제거, yp_sale_items 의 is_coupon_use 제거, yp_coupon_balance 뷰 폐기 |
| `yp_add_split_payments_v4.sql` | v4 — yp_sales 에 payments JSONB 배열 추가. 한 매출을 여러 결제 수단으로 나눠 수금하는 경우 표현 (가평 balance_payments 패턴) |
| `yp_total_editable_v5.sql` | v5 — yp_sales.total_amount 자동 갱신 트리거 제거. 현장 할인 등 라인 합계와 다른 총액을 클라이언트가 명시적으로 저장하도록 변경 |

---

## 작성 규칙

- **양평 전용 객체는 `yp_` 접두사** 로 시작 (가평과 섞이지 않도록 분리)
- 새 마이그레이션 파일은 의미 있는 동사 + 대상으로 명명
  - `add_*` 신규 테이블/컬럼/객체
  - `update_*` 기존 객체 변경
  - `fix_*` 일회성 데이터/정책 보정
  - `yp_*` 양평 전용
- RLS 정책 변경 시 반드시 본 README 의 "보안 / 권한 모델" 섹션에 줄 추가
- 신규 비즈니스 테이블은 RLS 적용 + `multisite_permissions.sql` 의 패턴(`can_access_site`/`can_admin_site`) 또는 `secure_rls_policies.sql` 의 `is_admin()` 헬퍼 사용
