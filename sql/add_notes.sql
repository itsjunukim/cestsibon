-- ============================================================================
-- 메모(Notes) 테이블 + 감사 히스토리
-- ============================================================================
-- 중요 계정 정보·정산 계좌 등 팀 공유 메모를 저장한다.
-- 단일 행(singleton) 구조. 저장할 때마다 notes_history 에 스냅샷을 남긴다.
--
-- 접근 통제:
--   - RLS 는 authenticated 계정 read/write 만 허용 (역할 무관)
--   - 실제 열람 통제는 클라이언트 PIN(4185) 다이얼로그로 처리
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.notes_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS notes_history_note_id_updated_at_idx
    ON public.notes_history (note_id, updated_at DESC);

-- 저장할 때마다 스냅샷 자동 기록
-- SECURITY DEFINER: notes_history 에 INSERT 정책이 없어도 트리거는 항상 실행되어야 하므로
-- 함수 소유자 권한으로 실행해 RLS 를 우회한다.
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

DROP TRIGGER IF EXISTS notes_snapshot ON public.notes;
CREATE TRIGGER notes_snapshot
    AFTER INSERT OR UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.notes_snapshot_trigger();

-- RLS: 로그인된 사용자만 read/write (PIN 은 클라이언트에서 별도로 통제)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated insert notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated update notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated read notes_history" ON public.notes_history;

CREATE POLICY "Authenticated read notes" ON public.notes
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert notes" ON public.notes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update notes" ON public.notes
    FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated read notes_history" ON public.notes_history
    FOR SELECT USING (auth.uid() IS NOT NULL);
-- notes_history 는 트리거로만 기록 → INSERT/UPDATE/DELETE 정책 없음
