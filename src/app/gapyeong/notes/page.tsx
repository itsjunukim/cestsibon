"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PinUnlockDialog } from "@/components/PinUnlockDialog"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Lock, Save, StickyNote, Loader2 } from "lucide-react"

type NoteRow = {
    id: string
    content: string
    updated_at: string
    updated_by: string | null
}

const NOTES_PIN = "4185"

export default function NotesPage() {
    const supabase = createClient()
    const [isUnlocked, setIsUnlocked] = useState(false)
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false)

    const [note, setNote] = useState<NoteRow | null>(null)
    const [draft, setDraft] = useState<string>("")
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [editorEmail, setEditorEmail] = useState<string | null>(null)

    const isDirty = useMemo(() => (note ? draft !== note.content : draft.length > 0), [draft, note])

    const lookupEmail = async (userId: string): Promise<string | null> => {
        const { data } = await supabase.from("profiles").select("email").eq("id", userId).single()
        return (data as any)?.email || null
    }

    const fetchNote = async () => {
        setIsLoading(true)
        const { data: rows } = await supabase
            .from("notes")
            .select("id, content, updated_at, updated_by")
            .order("updated_at", { ascending: false })
            .limit(1)

        const first = rows?.[0] as NoteRow | undefined
        if (first) {
            setNote(first)
            setDraft(first.content)
            setEditorEmail(first.updated_by ? await lookupEmail(first.updated_by) : null)
        } else {
            setNote(null)
            setDraft("")
            setEditorEmail(null)
        }
        setIsLoading(false)
    }

    useEffect(() => {
        if (!isUnlocked) return
        fetchNote()
    }, [isUnlocked])

    const handleSave = async () => {
        if (!isDirty || isSaving) return
        setIsSaving(true)
        try {
            const { data: sessionRes } = await supabase.auth.getSession()
            const userId = sessionRes.session?.user?.id ?? null
            const nowIso = new Date().toISOString()

            if (note) {
                const { error } = await supabase
                    .from("notes")
                    .update({ content: draft, updated_at: nowIso, updated_by: userId })
                    .eq("id", note.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from("notes")
                    .insert({ content: draft, updated_at: nowIso, updated_by: userId })
                if (error) throw error
            }

            await fetchNote()
        } catch (err: any) {
            alert("저장에 실패했습니다.\n" + (err?.message || ""))
        } finally {
            setIsSaving(false)
        }
    }

    const formatDateTime = (iso: string) =>
        format(new Date(iso), "yyyy-MM-dd HH:mm", { locale: ko })

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                        <StickyNote className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">메모</h1>
                    </div>
                </div>
                {isUnlocked && (
                    <Button onClick={handleSave} disabled={!isDirty || isSaving} className="gap-2">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        저장
                    </Button>
                )}
            </div>

            <div className="relative">
                <div className={cn("space-y-4 transition-all duration-300", !isUnlocked && "blur-md select-none pointer-events-none")}>
                    <Card>
                        <CardContent className="pt-6 space-y-3">
                            <Textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="여기에 메모를 작성하세요."
                                className="min-h-[420px] font-mono text-sm leading-6 resize-y"
                                disabled={isLoading}
                            />
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                                <div>
                                    {note ? (
                                        <>
                                            마지막 저장: <b>{formatDateTime(note.updated_at)}</b>
                                            {editorEmail && <> · {editorEmail}</>}
                                        </>
                                    ) : (
                                        <>아직 저장된 메모가 없습니다.</>
                                    )}
                                </div>
                                {isDirty && (
                                    <span className="text-amber-600 font-semibold">저장되지 않은 변경사항 있음</span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {!isUnlocked && (
                    <button
                        type="button"
                        onClick={() => setIsPinDialogOpen(true)}
                        className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer transition-colors rounded-xl"
                    >
                        <div className="bg-white px-6 py-3 rounded-full border border-slate-200 shadow-md hover:shadow-lg transition-shadow flex items-center gap-2">
                            <Lock className="w-4 h-4 text-slate-600" />
                            <span className="text-sm font-semibold text-slate-700">잠금 해제</span>
                        </div>
                    </button>
                )}
            </div>

            <PinUnlockDialog
                isOpen={isPinDialogOpen}
                onClose={() => setIsPinDialogOpen(false)}
                onUnlock={() => { setIsUnlocked(true); setIsPinDialogOpen(false) }}
                correctPin={NOTES_PIN}
            />
        </div>
    )
}
