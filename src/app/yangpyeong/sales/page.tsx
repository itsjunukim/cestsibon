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
    deposit_transfer_amount: number
    naver_amount: number
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
    deposit_transfer: string
    naver: string
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
                .order("created_at", { ascending: false })
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
                deposit_transfer: String(r.deposit_transfer_amount || 0),
                naver: String(r.naver_amount || 0),
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
        // 같은 날짜 여러 행 허용
        setDrafts(prev => [{ _key: randKey(), id: null, date: today, card: "", cash: "", transfer: "", deposit_transfer: "", naver: "", memo: "", dirty: true }, ...prev])
    }

    const saveRow = async (d: DraftRow) => {
        if (!d.date) { alert("날짜를 입력해주세요."); return }

        setSavingKey(d._key)
        const payload = {
            date: d.date,
            card_amount: num(d.card),
            cash_amount: num(d.cash),
            transfer_amount: num(d.transfer),
            deposit_transfer_amount: num(d.deposit_transfer),
            naver_amount: num(d.naver),
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
        deposit_transfer: a.deposit_transfer + Number(r.deposit_transfer_amount || 0),
        naver: a.naver + Number(r.naver_amount || 0),
        total: a.total + Number(r.total_amount || 0),
    }), { card: 0, cash: 0, transfer: 0, deposit_transfer: 0, naver: 0, total: 0 })

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <CreditCard className="h-7 w-7 text-cyan-500" />
                        매출 현황
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">일자별 결제 수단별 매출을 입력합니다. 총매출은 자동 합산됩니다.</p>
                </div>
                <Button onClick={addRow} disabled={!isAdmin} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                    <Plus className="h-4 w-4 mr-1.5" />
                    행 추가
                </Button>
            </div>

            {/* 합계 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Stat label="총 매출" value={fmtMoney(grand.total)} tone="indigo" />
                <Stat label="카드" value={fmtMoney(grand.card)} tone="violet" />
                <Stat label="현금" value={fmtMoney(grand.cash)} tone="emerald" />
                <Stat label="이체" value={fmtMoney(grand.transfer)} tone="cyan" />
                <Stat label="예약금(이체)" value={fmtMoney(grand.deposit_transfer)} tone="amber" />
                <Stat label="네이버" value={fmtMoney(grand.naver)} tone="rose" />
            </div>

            <Card className="border border-slate-200 rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800">일별 매출</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* 데스크탑: 테이블 */}
                    <div className="hidden md:block overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-center w-[130px]">날짜</TableHead>
                                    <TableHead className="text-center w-[140px]">총매출</TableHead>
                                    <TableHead className="text-center w-[120px]">카드</TableHead>
                                    <TableHead className="text-center w-[120px]">현금</TableHead>
                                    <TableHead className="text-center w-[120px]">이체</TableHead>
                                    <TableHead className="text-center w-[120px]">예약금(이체)</TableHead>
                                    <TableHead className="text-center w-[120px]">네이버</TableHead>
                                    <TableHead className="text-center w-[300px]">메모</TableHead>
                                    <TableHead className="text-center w-[80px]">관리</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-sm text-slate-400">불러오는 중...</TableCell></TableRow>
                                ) : drafts.length === 0 ? (
                                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-sm text-slate-400">매출 데이터가 없습니다. "행 추가"로 입력하세요.</TableCell></TableRow>
                                ) : (
                                    drafts.map(d => {
                                        const rowTotal = num(d.card) + num(d.cash) + num(d.transfer) + num(d.deposit_transfer) + num(d.naver)
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
                                                <TableCell>
                                                    <Input inputMode="numeric" disabled={!isAdmin} value={comma(d.deposit_transfer)}
                                                        onChange={(e) => patch(d._key, { deposit_transfer: e.target.value.replace(/[^0-9]/g, "") })}
                                                        className="h-9 text-right tabular-nums" placeholder="0" />
                                                </TableCell>
                                                <TableCell>
                                                    <Input inputMode="numeric" disabled={!isAdmin} value={comma(d.naver)}
                                                        onChange={(e) => patch(d._key, { naver: e.target.value.replace(/[^0-9]/g, "") })}
                                                        className="h-9 text-right tabular-nums" placeholder="0" />
                                                </TableCell>
                                                <TableCell className="align-top group/memo">
                                                    <div className="relative">
                                                        <Textarea readOnly={!isAdmin} value={d.memo}
                                                            rows={1}
                                                            onChange={(e) => patch(d._key, { memo: e.target.value })}
                                                            className={cn(
                                                                "resize-none transition-all duration-150 h-9 min-h-9 w-full py-1.5 leading-6 overflow-hidden whitespace-nowrap text-ellipsis",
                                                                "focus:h-24 focus:min-h-24 focus:whitespace-pre-wrap focus:overflow-auto",
                                                                d.memo && "group-hover/memo:h-24 group-hover/memo:min-h-24 group-hover/memo:whitespace-pre-wrap group-hover/memo:overflow-auto"
                                                            )}
                                                            placeholder="메모 입력" />
                                                        {d.memo.includes('\n') && (
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm font-bold group-hover/memo:hidden group-focus-within/memo:hidden">⋯</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-1">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-cyan-600 hover:bg-cyan-50 disabled:text-slate-300"
                                                            title="저장" disabled={!isAdmin || !d.dirty || savingKey === d._key}
                                                            onClick={() => saveRow(d)}>
                                                            <Save className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                                                            title="삭제" disabled={!isAdmin} onClick={() => deleteRow(d)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* 모바일: 카드 리스트 */}
                    <div className="md:hidden space-y-3">
                        {isLoading ? (
                            <div className="py-8 text-center text-sm text-slate-400">불러오는 중...</div>
                        ) : drafts.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-400">매출 데이터가 없습니다. "행 추가"로 입력하세요.</div>
                        ) : (
                            drafts.map(d => {
                                const rowTotal = num(d.card) + num(d.cash) + num(d.transfer) + num(d.deposit_transfer) + num(d.naver)
                                return (
                                    <div key={d._key} className={cn("rounded-xl border p-4 space-y-3", d.dirty ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-white")}>
                                        {/* 날짜 + 총매출 + 액션 */}
                                        <div className="flex items-center justify-between gap-2">
                                            <Input type="date" value={d.date} disabled={!isAdmin}
                                                onChange={(e) => patch(d._key, { date: e.target.value })}
                                                className="h-9 w-[150px]" />
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-cyan-600 hover:bg-cyan-50 disabled:text-slate-300"
                                                    title="저장" disabled={!isAdmin || !d.dirty || savingKey === d._key}
                                                    onClick={() => saveRow(d)}>
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-500 hover:bg-rose-50"
                                                    title="삭제" disabled={!isAdmin} onClick={() => deleteRow(d)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between rounded-lg bg-indigo-50/60 border border-indigo-100 px-3 py-2">
                                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">총매출</span>
                                            <span className="text-lg font-bold text-indigo-700 tabular-nums">{fmtMoney(rowTotal)}</span>
                                        </div>

                                        {/* 결제수단별 입력 */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-[11px] font-semibold text-slate-500 block mb-1">카드</label>
                                                <Input inputMode="numeric" disabled={!isAdmin} value={comma(d.card)}
                                                    onChange={(e) => patch(d._key, { card: e.target.value.replace(/[^0-9]/g, "") })}
                                                    className="h-9 text-right tabular-nums" placeholder="0" />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-semibold text-slate-500 block mb-1">현금</label>
                                                <Input inputMode="numeric" disabled={!isAdmin} value={comma(d.cash)}
                                                    onChange={(e) => patch(d._key, { cash: e.target.value.replace(/[^0-9]/g, "") })}
                                                    className="h-9 text-right tabular-nums" placeholder="0" />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-semibold text-slate-500 block mb-1">이체</label>
                                                <Input inputMode="numeric" disabled={!isAdmin} value={comma(d.transfer)}
                                                    onChange={(e) => patch(d._key, { transfer: e.target.value.replace(/[^0-9]/g, "") })}
                                                    className="h-9 text-right tabular-nums" placeholder="0" />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-semibold text-slate-500 block mb-1">예약금(이체)</label>
                                                <Input inputMode="numeric" disabled={!isAdmin} value={comma(d.deposit_transfer)}
                                                    onChange={(e) => patch(d._key, { deposit_transfer: e.target.value.replace(/[^0-9]/g, "") })}
                                                    className="h-9 text-right tabular-nums" placeholder="0" />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-semibold text-slate-500 block mb-1">네이버</label>
                                                <Input inputMode="numeric" disabled={!isAdmin} value={comma(d.naver)}
                                                    onChange={(e) => patch(d._key, { naver: e.target.value.replace(/[^0-9]/g, "") })}
                                                    className="h-9 text-right tabular-nums" placeholder="0" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500 block mb-1">메모</label>
                                            <Textarea readOnly={!isAdmin} value={d.memo}
                                                rows={2}
                                                onChange={(e) => patch(d._key, { memo: e.target.value })}
                                                className="resize-none min-h-[60px]"
                                                placeholder="메모 입력" />
                                        </div>
                                    </div>
                                )
                            })
                        )}
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

function Stat({ label, value, tone }: { label: string; value: string; tone: "indigo" | "violet" | "emerald" | "cyan" | "amber" | "rose" }) {
    const map = {
        indigo: "border-indigo-200 bg-indigo-50/60 text-indigo-700",
        violet: "border-violet-200 bg-violet-50/60 text-violet-700",
        emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
        cyan: "border-cyan-200 bg-cyan-50/60 text-cyan-700",
        amber: "border-amber-200 bg-amber-50/60 text-amber-700",
        rose: "border-rose-200 bg-rose-50/60 text-rose-700",
    }
    return (
        <div className={cn("flex flex-col px-4 py-3 rounded-lg border", map[tone])}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
            <span className="font-bold text-lg tabular-nums">{value}</span>
        </div>
    )
}
