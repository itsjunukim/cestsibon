-- ============================================================================
-- 양평 매출 v5 — 총 결제 금액 수동 수정 허용
-- ============================================================================
-- v2 트리거(yp_sale_total_refresh_*) 는 yp_sale_items 변경 시
-- yp_sales.total_amount 를 자동으로 SUM(items.amount) 로 덮어썼다.
-- 그러나 현장 할인 등으로 총 결제 금액이 라인 합계와 달라질 수 있어,
-- 헤더 total_amount 자동 갱신 트리거를 제거하고 클라이언트가 명시적으로 저장하도록 변경한다.
--
-- 라인별 amount = quantity * unit_price 보정 트리거(yp_item_recalc)는 유지.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_yp_sale_total_refresh_ins ON public.yp_sale_items;
DROP TRIGGER IF EXISTS trg_yp_sale_total_refresh_upd ON public.yp_sale_items;
DROP TRIGGER IF EXISTS trg_yp_sale_total_refresh_del ON public.yp_sale_items;
DROP FUNCTION IF EXISTS public.yp_sale_total_refresh();
