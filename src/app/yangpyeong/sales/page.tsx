"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { useUserRole } from "@/hooks/useUserRole"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Pencil, CalendarIcon, ChevronLeft, ChevronRight, CreditCard, X } from "lucide-react"
import { cn } from "@/lib/utils"

type PaymentMethod = "transfer" | "card" | "cash" | "place" | "store" | "social"

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
    transfer: "이체", card: "카드", cash: "현금", place: "플레이스", store: "스토어", social: "소셜",
}

interface Product { id: string; name: string; price: number }

interface SaleItem {
    id?: string
    product_id: string
    quantity: number
    unit_price: number
    amount: number
}

interface PaymentSplit { method: PaymentMethod; amount: number }

interface SaleRow {
    id: string
    date: string
    customer_name: string | null
    headcount: number | null
    total_amount: number
    payment_method: PaymentMethod | null
    payments: PaymentSplit[] | null
    is_paid: boolean
    notes: string | null
    yp_sale_items: (SaleItem & { yp_products: { name: string } | null })[]
}

interface DraftItem extends SaleItem { _key: string; productName: string }

const fmtMoney = (v: number | null | undefined) => `${Number(v || 0).toLocaleString()}원`
const randKey = () => Math.random().toString(36).slice(2)

export default function YangpyeongSalesPage() {
    const { canAdminSite } = useUserRole()
    const isAdmin = canAdminSite("yangpyeong")
    const supabase = createClient()
    const queryClient = useQueryClient()

    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const [formDate, setFormDate] = useState<Date>(new Date())
    const [customerName, setCustomerName] = useState("")
    const [headcount, setHeadcount] = useState("")
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("")
    const [splitPayments, setSplitPayments] = useState<{ method: PaymentMethod | ""; amount: string }[]>([])
    const [totalAmount, setTotalAmount] = useState("0")  // 사용자 수정 가능. 이용권 변경 시 자동 가감
    const [notes, setNotes] = useState("")
    const [items, setItems] = useState<DraftItem[]>([])
    const [productPicker, setProductPicker] = useState("")

    const dateStr = format(selectedDate, "yyyy-MM-dd")

    const { data: products } = useQuery<Product[]>({
        queryKey: ["yp-products-pick"],
        queryFn: async () => {
            const { data } = await supabase
                .from("yp_products")
                .select("id, name, price")
                .order("display_order", { ascending: true, nullsFirst: false })
                .order("name", { ascending: true })
            return (data as Product[]) || []
        },
    })

    const { data: sales, isLoading } = useQuery<SaleRow[]>({
        queryKey: ["yp-sales", dateStr],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("yp_sales")
                .select("*, yp_sale_items(*, yp_products(name))")
                .eq("date", dateStr)
                .order("created_at", { ascending: true })
            if (error) { console.error(error); return [] }
            return (data as any) || []
        },
    })

    const dayTotal = sales?.reduce((acc, r) => acc + Number(r.total_amount || 0), 0) || 0

    // 이용권 자동 합계 (참고용)
    const itemsSum = items.reduce((acc, i) => acc + Number(i.quantity) * Number(i.unit_price), 0)
    // 사용자가 수정 가능한 총 결제 금액 (분할 결제 검증/표시 기준)
    const draftTotal = Number(String(totalAmount).replace(/[^0-9]/g, "")) || 0

    const resetForm = () => {
        setEditingId(null)
        setFormDate(selectedDate)
        setCustomerName("")
        setHeadcount("")
        setPaymentMethod("")
        setSplitPayments([])
        setTotalAmount("0")
        setNotes("")
        setItems([])
        setProductPicker("")
    }

    const openCreate = () => { resetForm(); setIsDialogOpen(true) }

    const openEdit = (s: SaleRow) => {
        setEditingId(s.id)
        setFormDate(new Date(s.date))
        setCustomerName(s.customer_name || "")
        setHeadcount(s.headcount != null ? String(s.headcount) : "")
        setPaymentMethod((s.payment_method || "") as PaymentMethod | "")
        setSplitPayments(Array.isArray(s.payments) && s.payments.length > 0
            ? s.payments.map(p => ({ method: p.method, amount: String(p.amount) }))
            : [])
        setTotalAmount(String(s.total_amount || 0))
        setNotes(s.notes || "")
        setItems(s.yp_sale_items.map(it => ({
            _key: randKey(),
            product_id: it.product_id,
            quantity: it.quantity,
            unit_price: it.unit_price,
            amount: it.amount,
            productName: it.yp_products?.name || "(삭제된 이용권)",
        })))
        setProductPicker("")
        setIsDialogOpen(true)
    }

    const addItem = (productId: string) => {
        if (!productId || !products) return
        const p = products.find(x => x.id === productId)
        if (!p) return
        setItems(prev => [...prev, {
            _key: randKey(),
            product_id: p.id,
            quantity: 1,
            unit_price: p.price,
            amount: p.price,
            productName: p.name,
        }])
        // 총액 자동 누적 (사용자가 직접 수정해놓은 값에 더함)
        setTotalAmount(prev => String((Number(String(prev).replace(/[^0-9]/g, "")) || 0) + Number(p.price)))
        setProductPicker("")
    }

    const updateItem = (key: string, patch: Partial<DraftItem>) => {
        let delta = 0
        setItems(prev => prev.map(i => {
            if (i._key !== key) return i
            const next = { ...i, ...patch }
            next.amount = Number(next.quantity) * Number(next.unit_price)
            delta = next.amount - i.amount
            return next
        }))
        if (delta !== 0) setTotalAmount(prev => String((Number(String(prev).replace(/[^0-9]/g, "")) || 0) + delta))
    }

    const removeItem = (key: string) => {
        const target = items.find(i => i._key === key)
        if (target) setTotalAmount(prev => String(Math.max(0, (Number(String(prev).replace(/[^0-9]/g, "")) || 0) - target.amount)))
        setItems(prev => prev.filter(i => i._key !== key))
    }

    const handleSave = async () => {
        if (items.length === 0) { alert("이용권을 1개 이상 추가해주세요."); return }

        // 분할 결제 검증
        let payments: PaymentSplit[] = []
        let headerMethod: PaymentMethod | null = null
        if (splitPayments.length > 0) {
            const cleaned = splitPayments.map(p => ({ method: p.method, amount: Number(p.amount) || 0 }))
            if (cleaned.some(p => !p.method)) { alert("분할 결제의 각 행 수단을 선택해주세요."); return }
            const sum = cleaned.reduce((a, c) => a + c.amount, 0)
            if (sum !== draftTotal) { alert(`분할 결제 합계(${sum.toLocaleString()}원)가 총액(${draftTotal.toLocaleString()}원)과 일치하지 않습니다.`); return }
            payments = cleaned as PaymentSplit[]
            headerMethod = (cleaned[0].method || null) as PaymentMethod | null
        } else {
            if (!paymentMethod && draftTotal > 0) { alert("결제 수단을 선택해주세요."); return }
            headerMethod = paymentMethod || null
        }
        setIsSaving(true)

        const headerPayload: any = {
            date: format(formDate, "yyyy-MM-dd"),
            customer_name: customerName.trim() || null,
            headcount: headcount ? Number(headcount) : null,
            payment_method: headerMethod,
            payments,
            total_amount: draftTotal,
            notes: notes.trim() || null,
        }

        let saleId = editingId
        if (editingId) {
            const { error } = await supabase.from("yp_sales").update(headerPayload).eq("id", editingId)
            if (error) { setIsSaving(false); alert("저장 실패: " + error.message); return }
            await supabase.from("yp_sale_items").delete().eq("sale_id", editingId)
        } else {
            const { data, error } = await supabase.from("yp_sales").insert(headerPayload).select("id").single()
            if (error || !data) { setIsSaving(false); alert("저장 실패: " + (error?.message || "")); return }
            saleId = data.id
        }

        const itemsPayload = items.map(i => ({
            sale_id: saleId,
            product_id: i.product_id,
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price),
        }))
        const { error: itemErr } = await supabase.from("yp_sale_items").insert(itemsPayload)
        setIsSaving(false)
        if (itemErr) { alert("아이템 저장 실패: " + itemErr.message); return }

        setIsDialogOpen(false)
        setSelectedDate(formDate)
        queryClient.invalidateQueries({ queryKey: ["yp-sales"] })
    }

    const handleDelete = async (id: string) => {
        if (!confirm("이 매출을 삭제하시겠습니까?")) return
        const { error } = await supabase.from("yp_sales").delete().eq("id", id)
        if (error) { alert("삭제 실패: " + error.message); return }
        queryClient.invalidateQueries({ queryKey: ["yp-sales"] })
    }

    const shiftDate = (days: number) => {
        const next = new Date(selectedDate)
        next.setDate(next.getDate() + days)
        setSelectedDate(next)
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <CreditCard className="h-7 w-7 text-cyan-500" />
                        매출 현황
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">한 손님(또는 단체)이 사용한 여러 이용권을 한 매출로 묶어 기록합니다.</p>
                </div>
                <Button onClick={openCreate} disabled={!isAdmin} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                    <Plus className="h-4 w-4 mr-1.5" />
                    매출 추가
                </Button>
            </div>

            {/* 날짜 네비 + 합계 */}
            <Card className="border border-slate-200 rounded-xl shadow-sm">
                <CardContent className="p-4 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} className="h-9 w-9"><ChevronLeft className="h-4 w-4" /></Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="data-[size=default]:h-9 px-3 min-w-[200px] justify-start font-semibold">
                                    <CalendarIcon className="h-4 w-4 mr-2 text-slate-500" />
                                    {format(selectedDate, "yyyy년 M월 d일 (EEE)", { locale: ko })}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" locale={ko} selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <Button variant="outline" size="icon" onClick={() => shiftDate(1)} className="h-9 w-9"><ChevronRight className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setSelectedDate(new Date())}>오늘</Button>
                    </div>
                    <div className="flex-1 flex flex-wrap gap-3 lg:justify-end">
                        <Stat label="총 매출" value={fmtMoney(dayTotal)} tone="indigo" />
                        <Stat label="건수" value={`${sales?.length || 0}건`} tone="slate" />
                    </div>
                </CardContent>
            </Card>

            {/* 목록 */}
            <Card className="border border-slate-200 rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800">일자별 매출</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12 text-center">No.</TableHead>
                                    <TableHead className="whitespace-nowrap">손님</TableHead>
                                    <TableHead className="whitespace-nowrap w-16 text-center">인원</TableHead>
                                    <TableHead>이용권</TableHead>
                                    <TableHead className="whitespace-nowrap w-[90px] text-center">결제수단</TableHead>
                                    <TableHead className="whitespace-nowrap text-right w-[120px]">합계</TableHead>
                                    <TableHead className="whitespace-nowrap text-right w-[100px]">관리</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-slate-400">불러오는 중...</TableCell></TableRow>
                                ) : (sales?.length || 0) === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-slate-400">이 날짜에 등록된 매출이 없습니다.</TableCell></TableRow>
                                ) : (
                                    sales!.map((s, idx) => (
                                        <TableRow key={s.id} className="hover:bg-slate-50/50">
                                            <TableCell className="text-center text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                                            <TableCell className="font-semibold text-slate-900">
                                                {s.customer_name || <span className="text-slate-300 font-normal">이름없음</span>}
                                                {s.notes && <div className="text-[11px] font-normal text-slate-500 mt-0.5 truncate max-w-[160px]" title={s.notes}>{s.notes}</div>}
                                            </TableCell>
                                            <TableCell className="text-center text-sm text-slate-600 tabular-nums">{s.headcount || "-"}</TableCell>
                                            <TableCell className="max-w-[280px]">
                                                {s.yp_sale_items.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {s.yp_sale_items.map((it) => (
                                                            <span key={it.id} className="font-medium text-cyan-700 text-[11px] bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-100 whitespace-nowrap">
                                                                🎫 {it.yp_products?.name || "(삭제됨)"}({it.quantity})
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : <span className="text-slate-300">-</span>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {Array.isArray(s.payments) && s.payments.length > 0 ? (
                                                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                                        {s.payments.map(p => PAYMENT_LABEL[p.method]).join("+")}
                                                    </span>
                                                ) : s.payment_method ? (
                                                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                                        {PAYMENT_LABEL[s.payment_method]}
                                                    </span>
                                                ) : <span className="text-slate-300">-</span>}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-slate-900 tabular-nums">{fmtMoney(s.total_amount)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" title={isAdmin ? "수정" : "조회"} onClick={() => openEdit(s)}>
                                                    <Pencil className="h-4 w-4 text-slate-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" disabled={!isAdmin} onClick={() => handleDelete(s.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* 입력/수정 다이얼로그 */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "매출 수정" : "매출 추가"}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* 기본 정보 섹션 */}
                        <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl p-5 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-slate-400"></div>
                            <div className="border-b border-slate-100 pb-3 mb-4 mt-1">
                                <h3 className="font-bold text-slate-800 text-[15px] flex items-center gap-2">📝 기본 정보</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs font-semibold">날짜</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full mt-1.5 justify-start font-normal">
                                                <CalendarIcon className="h-4 w-4 mr-2 opacity-60" />
                                                {format(formDate, "yyyy-MM-dd", { locale: ko })}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" locale={ko} selected={formDate} onSelect={(d) => d && setFormDate(d)} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold">이름</Label>
                                    <Input className="mt-1.5" placeholder="예: 김준우" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <div>
                                    <Label className="text-xs font-semibold">인원</Label>
                                    <Input type="number" min="1" className="mt-1.5" placeholder="-" value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
                                </div>
                            </div>

                            {/* 이용권 */}
                            <div className="space-y-3 mt-5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-slate-700">이용권</Label>
                                </div>
                                <Select value={productPicker} onValueChange={addItem}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="추가할 이용권을 선택하세요..." /></SelectTrigger>
                                    <SelectContent>
                                        {!products || products.length === 0 ? (
                                            <SelectItem value="__empty__" disabled>등록된 이용권이 없습니다 (이용권 관리에서 먼저 등록)</SelectItem>
                                        ) : (
                                            products.map(p => {
                                                const added = items.find(i => i.product_id === p.id)
                                                if (added) return null
                                                return (
                                                    <SelectItem key={p.id} value={p.id}>{p.name} ({fmtMoney(p.price)})</SelectItem>
                                                )
                                            })
                                        )}
                                    </SelectContent>
                                </Select>

                                {items.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {items.map(it => (
                                            <div key={it._key} className="relative flex items-center justify-between bg-white px-4 py-3 border border-slate-200 rounded-md shadow-sm border-l-4 border-l-cyan-500">
                                                <div className="font-semibold text-slate-800 text-sm">
                                                    {it.productName}
                                                    <div className="text-cyan-600 font-bold mt-0.5 text-xs">({fmtMoney(it.unit_price)})</div>
                                                </div>
                                                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-md px-1 py-1 mr-6">
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-700 hover:bg-slate-200 rounded" onClick={() => {
                                                        if (it.quantity > 1) updateItem(it._key, { quantity: it.quantity - 1 })
                                                    }}>-</Button>
                                                    <span className="w-6 text-center font-extrabold text-slate-900 text-sm">{it.quantity}</span>
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-700 hover:bg-slate-200 rounded" onClick={() => updateItem(it._key, { quantity: it.quantity + 1 })}>+</Button>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" title="삭제" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" onClick={() => removeItem(it._key)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 결제 정보 섹션 */}
                        <div className="w-full bg-white border border-blue-200 shadow-sm shadow-blue-100/50 rounded-2xl p-5 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                            <div className="border-b border-blue-100 pb-3 mb-4 mt-1">
                                <h3 className="font-bold text-blue-800 text-[15px] flex items-center gap-2">💳 결제 정보</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex items-center justify-between h-6">
                                        <Label className="text-xs font-semibold">결제 수단</Label>
                                        {splitPayments.length === 0 ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-xs text-blue-600 hover:bg-blue-50"
                                                onClick={() => {
                                                    setSplitPayments([
                                                        { method: paymentMethod || "transfer", amount: String(draftTotal) },
                                                        { method: "", amount: "0" },
                                                    ])
                                                }}
                                            >+ 분할 결제</Button>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-xs text-slate-500 hover:bg-slate-100"
                                                onClick={() => setSplitPayments([])}
                                            >단일 결제로 복귀</Button>
                                        )}
                                    </div>
                                    {splitPayments.length === 0 ? (
                                        <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                                            <SelectTrigger className="mt-1.5 bg-white"><SelectValue placeholder="선택" /></SelectTrigger>
                                            <SelectContent>
                                                {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map(m => (
                                                    <SelectItem key={m} value={m}>{PAYMENT_LABEL[m]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="mt-1.5 flex h-10 items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                                            분할 {splitPayments.length}건
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center justify-between h-6">
                                        <Label className="text-xs font-semibold text-blue-800">총 결제 금액</Label>
                                    </div>
                                    <div className="mt-1.5 relative">
                                        <Input
                                            type="text"
                                            className="bg-blue-50 border-blue-200 font-extrabold text-blue-700 text-[16px] text-right pr-7 h-10 tabular-nums shadow-sm focus-visible:ring-blue-300"
                                            value={draftTotal ? draftTotal.toLocaleString() : ""}
                                            onChange={(e) => setTotalAmount(e.target.value.replace(/[^0-9]/g, ""))}
                                            placeholder="0"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-700 font-extrabold pointer-events-none">원</span>
                                    </div>
                                </div>
                            </div>

                            {/* 분할 결제 행 리스트 */}
                            {splitPayments.length > 0 && (
                                <div className="mt-4 space-y-2 rounded-md border border-blue-100 bg-blue-50/40 p-3">
                                    {splitPayments.map((p, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-500 w-5 text-center">{idx + 1}</span>
                                            <Select value={p.method} onValueChange={(v) => {
                                                setSplitPayments(prev => prev.map((x, i) => i === idx ? { ...x, method: v as PaymentMethod } : x))
                                            }}>
                                                <SelectTrigger className="flex-1 bg-white"><SelectValue placeholder="수단" /></SelectTrigger>
                                                <SelectContent>
                                                    {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map(m => (
                                                        <SelectItem key={m} value={m}>{PAYMENT_LABEL[m]}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <div className="relative w-[140px]">
                                                <Input
                                                    type="text"
                                                    className="bg-white text-right pr-7 tabular-nums font-semibold"
                                                    value={p.amount ? Number(String(p.amount).replace(/[^0-9]/g, '')).toLocaleString() : ""}
                                                    onChange={(e) => {
                                                        const v = e.target.value.replace(/[^0-9]/g, '')
                                                        setSplitPayments(prev => prev.map((x, i) => i === idx ? { ...x, amount: v } : x))
                                                    }}
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">원</span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                                                onClick={() => {
                                                    setSplitPayments(prev => prev.filter((_, i) => i !== idx))
                                                }}
                                            ><X className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    ))}
                                    {/* 합계 + 추가 버튼 */}
                                    {(() => {
                                        const sum = splitPayments.reduce((a, c) => a + (Number(String(c.amount).replace(/[^0-9]/g, '')) || 0), 0)
                                        const diff = draftTotal - sum
                                        const ok = sum === draftTotal
                                        return (
                                            <div className="flex items-center justify-between pt-2 mt-1 border-t border-blue-100">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => setSplitPayments(prev => [...prev, { method: "", amount: String(Math.max(0, diff)) }])}
                                                >+ 결제 수단 추가</Button>
                                                <span className={cn("text-xs font-bold tabular-nums", ok ? "text-emerald-600" : "text-rose-600")}>
                                                    합계 {sum.toLocaleString()}원 {ok ? "✓" : `(차액 ${diff.toLocaleString()}원)`}
                                                </span>
                                            </div>
                                        )
                                    })()}
                                </div>
                            )}

                            <div className="mt-4">
                                <Label className="text-xs font-semibold">메모</Label>
                                <Textarea className="mt-1.5 bg-white" rows={2} placeholder="추가 메모" value={notes} onChange={(e) => setNotes(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
                        <Button onClick={handleSave} disabled={!isAdmin || isSaving || items.length === 0} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                            {isSaving ? "저장 중..." : editingId ? "수정" : "저장"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "indigo" | "emerald" | "rose" | "slate" }) {
    const map = {
        indigo: "border-indigo-200 bg-indigo-50/60 text-indigo-700",
        emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
        rose: "border-rose-200 bg-rose-50/60 text-rose-700",
        slate: "border-slate-200 bg-slate-50/60 text-slate-700",
    }
    return (
        <div className={cn("flex flex-col px-4 py-2 rounded-lg border", map[tone])}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
            <span className="font-bold text-base tabular-nums">{value}</span>
        </div>
    )
}
