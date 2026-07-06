-- ============================================================================
-- notes_snapshot_trigger 를 SECURITY DEFINER 로 변경
-- ============================================================================
-- 원인:
--   기본(INVOKER) 실행에서는 트리거 함수가 호출자 권한으로 실행됨.
--   notes_history 에는 SELECT 정책만 있어 INSERT 가 RLS 로 차단되어
--   "new row violates row-level security policy for table notes_history" 오류 발생.
-- 조치:
--   함수를 SECURITY DEFINER 로 재정의해 소유자 권한으로 실행 → RLS 우회.
--   (트리거는 시스템 로직이므로 사용자 정책과 무관하게 항상 실행되어야 함)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notes_snapshot_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT') OR (OLD.content IS DISTINCT FROM NEW.content) THEN
        INSERT INTO public.notes_history (note_id, content, updated_at, updated_by)
        VALUES (NEW.id, NEW.content, NEW.updated_at, NEW.updated_by);
    END IF;
    RETURN NEW;
END;
$$;
