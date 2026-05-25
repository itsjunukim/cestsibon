"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { useUserRole } from "@/hooks/useUserRole"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, CreditCard, Save } from "lucide-react"
import { cn } from "@/lib/utils"

interface DailyRow {
    id: string
    date: string
    card_amount: number
    cash_amount: number
    transfer_amount: number
    total_amount: number
    memo: string | null
}

// 편집용 로컬 행 (문자열로 보관 → 천단위 콤마 표시 용이)
interface DraftRow {
    _key: string
    id: string | null      // null = 신규
    date: string           // yyyy-MM-dd
    card: string
    cash: string
    transfer: string
    memo: string
    dirty: boolean
}

const fmtMoney = (v: number) => `${Number(v || 0).toLocaleString()}원`
const num = (s: string) => Number(String(s).replace(/[^0-9]/g, "")) || 0
const comma = (s: string) => { const n = num(s); return n ? n.toLocaleString() : "" }
const randKey = () => Math.random().toString(36).slice(2)

export default function YangpyeongSalesPage() {
    const { canAdminSite } = useUserRole()
    const isAdmin = canAdminSite("yangpyeong")
    const supabase = createClient()
    const queryClient = useQueryClient()
    const [drafts, setDrafts] = useState<DraftRow[]>([])
    const [savingKey, setSavingKey] = useState<string | null>(null)
    const seededRef = useRef(false)

    const { data: rows, isLoading } = useQuery<DailyRow[]>({
        queryKey: ["yp-daily-sales"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("yp_daily_sales")
                .select("*")
                .order("date", { ascending: false })
            if (error) { console.error(error); return [] }
            return (data as DailyRow[]) || []
        },
    })

    // 서버 데이터 → draft 동기화 (저장 안 된 신규행은 유지)
    useEffect(() => {
        if (!rows) return
        setDrafts(prev => {
            const newRows = prev.filter(d => d.id === null) // 미저장 신규행 보존
            const serverRows: DraftRow[] = rows.map(r => ({
                _key: r.id,
                id: r.id,
                date: r.date,
                card: String(r.card_amount || 0),
                cash: String(r.cash_amount || 0),
                transfer: String(r.transfer_amount || 0),
                memo: r.memo || "",
                dirty: false,
            }))
            return [...newRows, ...serverRows]
        })
        seededRef.current = true
    }, [rows])

    const patch = (key: string, p: Partial<DraftRow>) => {
        setDrafts(prev => prev.map(d => d._key === key ? { ...d, ...p, dirty: true } : d))
    }

    const addRow = () => {
        const today = format(new Date(), "yyyy-MM-dd")
        // 이미 같은 날짜 행이 있으면 막기 (날짜 고유)
        setDrafts(prev => [{ _key: randKey(), id: null, date: today, card: "", cash: "", transfer: "", memo: "", dirty: true }, ...prev])
    }

    const saveRow = async (d: DraftRow) => {
        if (!d.date) { alert("날짜를 입력해주세요."); return }
        // 날짜 중복 검사 (자신 제외)
        const dup = drafts.find(x => x._key !== d._key && x.date === d.date)
        if (dup) { alert(`${d.date} 날짜 행이 이미 있습니다. 해당 행을 수정해주세요.`); return }

        setSavingKey(d._key)
        const payload = {
            date: d.date,
            card_amount: num(d.card),
            cash_amount: num(d.cash),
            transfer_amount: num(d.transfer),
            memo: d.memo.trim() || null,
        }
        const { error } = d.id
            ? await supabase.from("yp_daily_sales").update(payload).eq("id", d.id)
            : await supabase.from("yp_daily_sales").insert(payload)
        setSavingKey(null)
        if (error) { alert("저장 실패: " + error.message); return }
        queryClient.invalidateQueries({ queryKey: ["yp-daily-sales"] })
    }

    const deleteRow = async (d: DraftRow) => {
        if (d.id === null) {
            setDrafts(prev => prev.filter(x => x._key !== d._key))
            return
        }
        if (!confirm(`${d.date} 매출을 삭제하시겠습니까?`)) return
        const { error } = await supabase.from("yp_daily_sales").delete().eq("id", d.id)
        if (error) { alert("삭제 실패: " + error.message); return }
        queryClient.invalidateQueries({ queryKey: ["yp-daily-sales"] })
    }

    // 합계 (서버 저장된 행 기준)
    const grand = (rows || []).reduce((a, r) => ({
        card: a.card + Number(r.card_amount || 0),
        cash: a.cash + Number(r.cash_amount || 0),
        transfer: a.transfer + Number(r.transfer_amount || 0),
        total: a.total + Number(r.total_amount || 0),
    }), { card: 0, cash: 0, transfer: 0, total: 0 })

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <CreditCard className="h-7 w-7 text-cyan-500" />
                        매출 현황
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">일자별 카드·현금·계좌이체 매출을 입력합니다. 총매출은 자동 합산됩니다.</p>
                </div>
                <Button onClick={addRow} disabled={!isAdmin} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                    <Plus className="h-4 w-4 mr-1.5" />
                    행 추가
                </Button>
            </div>

            {/* 합계 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="총 매출" value={fmtMoney(grand.total)} tone="indigo" />
                <Stat label="카드" value={fmtMoney(grand.card)} tone="violet" />
                <Stat label="현금" value={fmtMoney(grand.cash)} tone="emerald" />
                <Stat label="계좌이체" value={fmtMoney(grand.transfer)} tone="cyan" />
            </div>

            <Card className="border border-slate-200 rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800">일별 매출</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px]">날짜</TableHead>
                                    <TableHead className="text-right w-[140px]">총매출</TableHead>
                                    <TableHead className="text-right w-[130px]">카드</TableHead>
                                    <TableHead className="text-right w-[130px]">현금</TableHead>
                                    <TableHead className="text-right w-[130px]">계좌이체</TableHead>
                                    <TableHead>메모</TableHead>
                                    <TableHead className="text-right w-[100px]">관리</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-slate-400">불러오는 중...</TableCell></TableRow>
                                ) : drafts.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-slate-400">매출 데이터가 없습니다. "행 추가"로 입력하세요.</TableCell></TableRow>
                                ) : (
                                    drafts.map(d => {
                                        const rowTotal = num(d.card) + num(d.cash) + num(d.transfer)
                                        return (
                                            <TableRow key={d._key} className={cn(d.dirty && "bg-amber-50/40")}>
                                                <TableCell>
                                                    <Input type="date" value={d.date} disabled={!isAdmin}
                                                        onChange={(e) => patch(d._key, { date: e.target.value })}
                                                        className="h-9 w-[140px]" />
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-slate-900 tabular-nums">
                                                    {fmtMoney(rowTotal)}
                                                </TableCell>
                                                <TableCell>
                                                    <Input inputMode="numeric" disabled={!isAdmin} value={comma(d.card)}
                                                        onChange={(e) => patch(d._key, { card: e.target.value.replace(/[^0-9]/g, "") })}
                                                        className="h-9 text-right tabular-nums" placeholder="0" />
                                                </TableCell>
                                                <TableCell>
                                                    <Input inputMode="numeric" disabled={!isAdmin} value={comma(d.cash)}
                                                        onChange={(e) => patch(d._key, { cash: e.target.value.replace(/[^0-9]/g, "") })}
                                                        className="h-9 text-right tabular-nums" placeholder="0" />
                                                </TableCell>
                                                <TableCell>
                                                    <Input inputMode="numeric" disabled={!isAdmin} value={comma(d.transfer)}
                                                        onChange={(e) => patch(d._key, { transfer: e.target.value.replace(/[^0-9]/g, "") })}
                                                        className="h-9 text-right tabular-nums" placeholder="0" />
                                                </TableCell>
                                                <TableCell className="min-w-[200px] align-top">
                                                    <Textarea disabled={!isAdmin} value={d.memo}
                                                        rows={1}
                                                        onChange={(e) => patch(d._key, { memo: e.target.value })}
                                                        className="resize-none transition-all duration-150 h-9 min-h-9 py-1.5 leading-6 overflow-hidden whitespace-nowrap text-ellipsis focus:h-24 focus:min-h-24 focus:whitespace-pre-wrap focus:overflow-auto"
                                                        placeholder="내용 메모" />
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-cyan-600 hover:bg-cyan-50 disabled:text-slate-300"
                                                        title="저장" disabled={!isAdmin || !d.dirty || savingKey === d._key}
                                                        onClick={() => saveRow(d)}>
                                                        <Save className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                                                        title="삭제" disabled={!isAdmin} onClick={() => deleteRow(d)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {drafts.some(d => d.dirty) && (
                        <p className="text-xs text-amber-600 font-semibold mt-3">
                            * 노란색 행은 저장되지 않은 변경입니다. 각 행의 저장(💾) 버튼을 눌러주세요.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "indigo" | "violet" | "emerald" | "cyan" }) {
    const map = {
        indigo: "border-indigo-200 bg-indigo-50/60 text-indigo-700",
        violet: "border-violet-200 bg-violet-50/60 text-violet-700",
        emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
        cyan: "border-cyan-200 bg-cyan-50/60 text-cyan-700",
    }
    return (
        <div className={cn("flex flex-col px-4 py-3 rounded-lg border", map[tone])}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
            <span className="font-bold text-lg tabular-nums">{value}</span>
        </div>
    )
}
