# C'est Si Bon (쎄시봉)

**C'est Si Bon**은 숙박 및 렌탈 비즈니스를 위한 올인원 관리 대시보드입니다. 예약 관리부터 매출 현황, 고객 응대까지 비즈니스 운영에 필요한 핵심 기능을 제공합니다.

## 🎯 프로젝트 목적 및 배경

이 프로젝트는 호텔, 펜션 등 숙박업과 스키 렌탈 등 부대 서비스를 운영하는 사업장을 위해 기획되었습니다. 복잡한 엑셀 파일이나 수기 장부 대신, 웹 기반의 직관적인 대시보드를 통해 실시간 영업 현황을 파악하고 효율적으로 매장을 관리하는 것을 목표로 합니다.

주요 관리 대상:
- **숙박 예약 (Accommodations & Reservations)**: 객실 예약 상태 및 고객 정보 관리
- **매출 (Sales)**: 객실료, 스키 렌탈, 식음료 등 카테고리별 매출 추적
- **영업 현황 (Business Status)**: 일간/주간/월간 매출 및 성장률 시각화

## 🚀 주요 기능

- **통합 대시보드**: 당일 매출, 활성 예약 건수, 방문자 추이를 한눈에 확인 가능한 그래픽 인터페이스 제공.
- **예약 시스템**: 고객 이름, 연락처, 날짜별 예약 현황을 관리하고 상태(예약됨, 완료, 취소)를 추적.
- **매출 관리**: '숙박(Room)', '스키(Ski)', '식음료(Food)' 등 항목별로 세분화된 매출 기록 자동화.
- **기간별 분석**: Date Picker와 보기 모드(일/주/월)를 통해 원하는 기간의 데이터를 유연하게 조회.

## 🛠 기술 스택 (Tech Stack)

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS, Shadcn UI
- **State Management**: Tanstack Query (React Query)
- **Charts**: Recharts

## 📂 프로젝트 구조

```
src/
├── app/                  # 페이지 및 라우팅 (Next.js App Router)
│   ├── accommodations/   # 숙소 관리 페이지
│   ├── reservations/     # 예약 관리 페이지
│   ├── sales/            # 매출 입력 및 조회
│   └── tickets/          # 티켓/이용권 관리
├── components/           # 재사용 가능한 UI 컴포넌트
│   ├── ui/               # Shadcn UI 기본 컴포넌트
│   └── ...               # 비즈니스 로직 포함 컴포넌트 (Charts, Forms)
├── lib/                  # 유틸리티 함수 및 Supabase 클라이언트 설정
└── ...
```
