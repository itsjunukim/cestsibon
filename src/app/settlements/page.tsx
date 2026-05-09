"use client"

import { useState, useEffect } from "react"
import { useUserRole } from "@/hooks/useUserRole"
import { createClient } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ChevronLeft, ChevronRight, Calculator, Home, CalendarIcon, Beef, Building2, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { ko } from "date-fns/locale"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ReservationForm } from "@/components/ReservationForm"

type DailySettlement = {
    accommodation_id: string;
    category: 'accommodation' | 'meat' | 'other';
    settlement_date: string;
    is_paid: boolean;
    paid_date: string | null;
}

type AggregatedData = {
    accommodation_id: string;
    accommodation_name: string;
    dates: {
        [date: string]: {
            date: string;
            reservations: { name: string, id: string }[];
            accommodation_amount: number;
            meat_amount: number;
            other_amount: number;
        }
    }
}

export default function SettlementsPage() {
    const { isAdmin } = useUserRole()
    const supabase = createClient()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [aggregatedData, setAggregatedData] = useState<Record<string, AggregatedData>>({})
    const [dailySettlements, setDailySettlements] = useState<DailySettlement[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingReservation, setEditingReservation] = useState<any>(null)

    const handleOpenReservation = async (id: string) => {
        const { data } = await supabase
            .from("reservations")
            .select("*, accommodations(name), reservation_rooms(room_id, rooms(name)), reservation_tickets(ticket_id, quantity, tickets(name))")
            .eq("id", id)
            .single()
        if (data) {
            setEditingReservation(data)
            setIsDialogOpen(true)
        }
    }

    const fetchSettlements = async (date: Date) => {
        setIsLoading(true)
        const start = format(startOfMonth(date), "yyyy-MM-dd")
        const end = format(endOfMonth(date), "yyyy-MM-dd")

        // 1. Fetch daily settlements status
        const { data: statuses } = await supabase
            .from("daily_settlements")
            .select("*")
            .gte("settlement_date", start)
            .lte("settlement_date", end)

        if (statuses) {
            setDailySettlements(statuses)
        }

        // 2. Fetch reservations and amounts
        const { data: reservations, error } = await supabase
            .from("reservations")
            .select(`
                id,
                date,
                customer_name,
                accommodation_id,
                accommodations (
                    name
                ),
                accommodation_settlements (
                    category,
                    amount
                )
            `)
            .eq("reservation_type", "accommodation")
            .gte("date", start)
            .lte("date", end)

        if (error) {
            console.error("Error fetching reservations:", error)
            setIsLoading(false)
            return
        }

        const aggregated: Record<string, AggregatedData> = {}

        reservations?.forEach((res: any) => {
            const accId = res.accommodation_id
            if (!accId) return

            if (!aggregated[accId]) {
                aggregated[accId] = {
                    accommodation_id: accId,
                    accommodation_name: res.accommodations?.name || "숙소명 없음",
                    dates: {}
                }
            }

            const rDate = res.date
            if (!aggregated[accId].dates[rDate]) {
                aggregated[accId].dates[rDate] = {
                    date: rDate,
                    reservations: [],
                    accommodation_amount: 0,
                    meat_amount: 0,
                    other_amount: 0,
                }
            }

            // Add reservation name if not already added
            if (!aggregated[accId].dates[rDate].reservations.find(r => r.id === res.id)) {
                aggregated[accId].dates[rDate].reservations.push({ id: res.id, name: res.customer_name })
            }

            res.accommodation_settlements?.forEach((settlement: any) => {
                const amount = settlement.amount || 0
                if (settlement.category === "accommodation") {
                    aggregated[accId].dates[rDate].accommodation_amount += amount
                } else if (settlement.category === "meat") {
                    aggregated[accId].dates[rDate].meat_amount += amount
                } else if (settlement.category === "other") {
                    aggregated[accId].dates[rDate].other_amount += amount
                }
            })
        })

        setAggregatedData(aggregated)
        setIsLoading(false)
    }

    useEffect(() => {
        fetchSettlements(currentDate)
    }, [currentDate])

    const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1))
    const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1))

    const handleUpdatePaymentStatus = async (
        accId: string,
        category: 'accommodation' | 'meat' | 'other',
        dateStr: string,
        updates: Partial<{ is_paid: boolean, paid_date: string | null }>
    ) => {
        const existing = dailySettlements.find(s =>
            s.accommodation_id === accId && s.category === category && s.settlement_date === dateStr
        )
        const isPaid = updates.is_paid !== undefined ? updates.is_paid : (existing?.is_paid ?? false)
        const paidDate = updates.paid_date !== undefined ? updates.paid_date : (existing?.paid_date ?? null)

        // Optimistic update (pure setState updater)
        setDailySettlements(prev => {
            const idx = prev.findIndex(s =>
                s.accommodation_id === accId && s.category === category && s.settlement_date === dateStr
            )
            if (idx >= 0) {
                const next = [...prev]
                next[idx] = { ...next[idx], is_paid: isPaid, paid_date: paidDate }
                return next
            }
            return [...prev, {
                accommodation_id: accId,
                category,
                settlement_date: dateStr,
                is_paid: isPaid,
                paid_date: paidDate,
            }]
        })

        const { error } = await supabase
            .from("daily_settlements")
            .upsert({
                accommodation_id: accId,
                category,
                settlement_date: dateStr,
                is_paid: isPaid,
                paid_date: paidDate ? paidDate : null,
                updated_at: new Date().toISOString()
            }, { onConflict: "accommodation_id, category, settlement_date" })

        if (error) {
            console.error("Error updating payment status:", error)
            alert("정산 상태 업데이트에 실패했습니다.")
            fetchSettlements(currentDate)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ko-KR').format(amount) + '원'
    }

    const getStatus = (accId: string, category: string, dateStr: string) => {
        return dailySettlements.find(s => s.accommodation_id === accId && s.category === category && s.settlement_date === dateStr)
    }

    const getAmountForCategory = (d: any, category: string) => {
        if (category === 'accommodation') return d.accommodation_amount;
        if (category === 'meat') return d.meat_amount;
        if (category === 'other') return d.other_amount;
        return 0;
    }

    const renderSettlementRow = (
        rowKey: string,
        accommodationId: string,
        category: 'accommodation' | 'meat' | 'other',
        date: string,
        reservations: { id: string; name: string }[],
        amount: number,
        isPaid: boolean,
        paidDate: string | null,
        accommodationName?: string,
    ) => (
        <TableRow key={rowKey} className={isPaid ? "bg-slate-50/50" : "hover:bg-muted/30"}>
            <TableCell className="font-medium text-center">
                {format(new Date(date), "MM.dd")}
            </TableCell>
            {accommodationName !== undefined && (
                <TableCell className="text-center font-medium text-slate-700">
                    {accommodationName}
                </TableCell>
            )}
            <TableCell className="text-left max-w-[200px] truncate" title={reservations.map(r => r.name).join(", ")}>
                {reservations.map((r, i) => (
                    <span key={r.id}>
                        <button
                            onClick={() => handleOpenReservation(r.id)}
                            className="hover:underline text-indigo-600 font-semibold"
                        >
                            {r.name}
                        </button>
                        {i < reservations.length - 1 && ", "}
                    </span>
                ))}
            </TableCell>
            <TableCell className="text-right font-bold text-primary">
                {formatCurrency(amount)}
            </TableCell>
            <TableCell className="text-center align-middle">
                <div className="flex justify-center">
                    <Checkbox
                        checked={isPaid}
                        disabled={!isAdmin}
                        onCheckedChange={(checked) => {
                            const paid = !!checked
                            const newDate = paid && !paidDate ? format(new Date(), "yyyy-MM-dd") : (!paid ? null : paidDate)
                            handleUpdatePaymentStatus(accommodationId, category, date, {
                                is_paid: paid,
                                paid_date: newDate
                            })
                        }}
                        className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 shadow-sm"
                    />
                </div>
            </TableCell>
            <TableCell className="text-center align-middle">
                {isPaid && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                disabled={!isAdmin}
                                className={cn("w-[130px] h-9 bg-white px-3 text-left font-normal border-green-200 shadow-sm", !paidDate && "text-muted-foreground")}
                            >
                                {paidDate ? (
                                    format(new Date(paidDate), "MM월 dd일", { locale: ko })
                                ) : (
                                    <span>날짜 선택</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="center">
                            <Calendar
                                mode="single"
                                selected={paidDate ? new Date(paidDate) : undefined}
                                onSelect={(d) => {
                                    if (d) {
                                        handleUpdatePaymentStatus(accommodationId, category, date, { paid_date: format(d, "yyyy-MM-dd") })
                                    }
                                }}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                )}
            </TableCell>
        </TableRow>
    )

    const renderAccordionContent = (accData: AggregatedData, category: 'accommodation' | 'other') => {
        // Filter dates that have actual amount for this category
        const dates = Object.values(accData.dates)
            .filter(d => getAmountForCategory(d, category) > 0)
            .sort((a, b) => a.date.localeCompare(b.date))

        if (dates.length === 0) {
            return <div className="p-4 text-center text-muted-foreground">내역이 없습니다.</div>
        }

        return (
            <div className="rounded-md border overflow-x-auto bg-white mb-2">
                <Table>
                    <TableHeader className="bg-slate-50 whitespace-nowrap">
                        <TableRow>
                            <TableHead className="text-center w-[120px]">일자</TableHead>
                            <TableHead className="text-left">예약건</TableHead>
                            <TableHead className="text-right">정산 금액</TableHead>
                            <TableHead className="text-center w-[100px]">정산 여부</TableHead>
                            <TableHead className="text-center w-[160px]">정산일</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dates.map((d) => {
                            const amount = getAmountForCategory(d, category)
                            const status = getStatus(accData.accommodation_id, category, d.date)
                            return renderSettlementRow(
                                d.date,
                                accData.accommodation_id,
                                category,
                                d.date,
                                d.reservations,
                                amount,
                                status?.is_paid || false,
                                status?.paid_date || null,
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        )
    }

    const renderTabContent = (category: 'accommodation' | 'other') => {
        if (isLoading) {
            return <div className="py-12 text-center text-muted-foreground">데이터를 불러오는 중입니다...</div>
        }

        const accommodations = Object.values(aggregatedData).filter(acc => {
            return Object.values(acc.dates).some(d => getAmountForCategory(d, category) > 0)
        }).sort((a, b) => a.accommodation_name.localeCompare(b.accommodation_name))

        if (accommodations.length === 0) {
            return (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <Home className="h-10 w-10 text-muted-foreground/30" />
                    <p>이 달에 등록된 {category === 'accommodation' ? '숙소' : '기타'} 정산 내역이 없습니다.</p>
                </div>
            )
        }

        return (
            <Accordion type="multiple" className="w-full space-y-4">
                {accommodations.map((acc) => {
                    // Calculate totals
                    let totalAmount = 0;
                    let unpaidAmount = 0;

                    Object.values(acc.dates).forEach(d => {
                        const amount = getAmountForCategory(d, category);
                        if (amount > 0) {
                            totalAmount += amount;
                            const status = getStatus(acc.accommodation_id, category, d.date);
                            if (!status?.is_paid) {
                                unpaidAmount += amount;
                            }
                        }
                    });

                    return (
                        <AccordionItem value={acc.accommodation_id} key={acc.accommodation_id} className="border rounded-lg bg-card shadow-sm px-2">
                            <AccordionTrigger className="hover:no-underline px-4 py-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-4 text-left gap-2">
                                    <span className="text-lg font-semibold flex items-center gap-2">
                                        {category === 'accommodation' ? <Building2 className="h-5 w-5 text-indigo-500" /> : <MoreHorizontal className="h-5 w-5 text-amber-500" />}
                                        {acc.accommodation_name}
                                    </span>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex flex-col items-end">
                                            <span className="text-muted-foreground">총 정산금액</span>
                                            <span className="font-bold text-slate-700 text-base">{formatCurrency(totalAmount)}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-muted-foreground">미정산 잔액</span>
                                            <span className={cn("font-bold text-base", unpaidAmount > 0 ? "text-rose-600" : "text-green-600")}>
                                                {formatCurrency(unpaidAmount)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                                {renderAccordionContent(acc, category)}
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
        )
    }

    const renderMeatContent = () => {
        if (isLoading) {
            return <div className="py-12 text-center text-muted-foreground">데이터를 불러오는 중입니다...</div>
        }

        const flatList: any[] = [];
        let totalAmount = 0;
        let unpaidAmount = 0;

        Object.values(aggregatedData).forEach(acc => {
            Object.values(acc.dates).forEach(d => {
                if (d.meat_amount > 0) {
                    const status = getStatus(acc.accommodation_id, 'meat', d.date);
                    flatList.push({
                        accommodation_id: acc.accommodation_id,
                        accommodation_name: acc.accommodation_name,
                        date: d.date,
                        reservations: d.reservations,
                        amount: d.meat_amount,
                        is_paid: status?.is_paid || false,
                        paid_date: status?.paid_date || null
                    });
                    totalAmount += d.meat_amount;
                    if (!status?.is_paid) {
                        unpaidAmount += d.meat_amount;
                    }
                }
            });
        });

        if (flatList.length === 0) {
            return (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <Beef className="h-10 w-10 text-muted-foreground/30" />
                    <p>이 달에 등록된 고기 정산 내역이 없습니다.</p>
                </div>
            )
        }

        flatList.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.accommodation_name.localeCompare(b.accommodation_name);
        });

        return (
            <div className="space-y-4">
                <div className="flex justify-end gap-4 bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex flex-col items-end">
                        <span className="text-muted-foreground text-sm">총 정산금액</span>
                        <span className="font-bold text-slate-700 text-lg">{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-muted-foreground text-sm">미정산 잔액</span>
                        <span className={cn("font-bold text-lg", unpaidAmount > 0 ? "text-rose-600" : "text-green-600")}>
                            {formatCurrency(unpaidAmount)}
                        </span>
                    </div>
                </div>

                <div className="rounded-md border overflow-x-auto bg-white">
                    <Table>
                        <TableHeader className="bg-slate-50 whitespace-nowrap">
                            <TableRow>
                                <TableHead className="text-center w-[120px]">일자</TableHead>
                                <TableHead className="text-center w-[150px]">숙소</TableHead>
                                <TableHead className="text-left">예약건</TableHead>
                                <TableHead className="text-right">정산 금액</TableHead>
                                <TableHead className="text-center w-[100px]">정산 여부</TableHead>
                                <TableHead className="text-center w-[160px]">정산일</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {flatList.map((item, idx) => renderSettlementRow(
                                `${item.accommodation_id}-${item.date}-${idx}`,
                                item.accommodation_id,
                                'meat',
                                item.date,
                                item.reservations,
                                item.amount,
                                item.is_paid,
                                item.paid_date,
                                item.accommodation_name,
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Calculator className="h-6 w-6 text-primary" />
                        정산 관리
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        일자별, 숙소별 지급할 정산 금액을 관리합니다.
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-card px-4 py-2 rounded-lg border shadow-sm w-full md:w-auto justify-between md:justify-start">
                    <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <span className="text-lg font-semibold min-w-[120px] text-center">
                        {format(currentDate, "yyyy년 MM월")}
                    </span>
                    <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="accommodation" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6 h-12">
                    <TabsTrigger value="accommodation" className="text-base h-10">숙소 정산</TabsTrigger>
                    <TabsTrigger value="meat" className="text-base h-10">고기 정산</TabsTrigger>
                    <TabsTrigger value="other" className="text-base h-10">기타 정산</TabsTrigger>
                </TabsList>
                
                <TabsContent value="accommodation" className="mt-0">
                    {renderTabContent('accommodation')}
                </TabsContent>
                
                <TabsContent value="meat" className="mt-0">
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg mb-4 flex items-start gap-3 shadow-sm">
                        <Beef className="h-5 w-5 mt-0.5 shrink-0" />
                        <div>
                            <h4 className="font-semibold">양지촌 일괄 정산</h4>
                            <p className="text-sm mt-1 opacity-90">고기 정산은 숙소별로 나누지 않고 <strong>양지촌</strong>으로 모두 취합하여 진행됩니다. 전체 일자별 내역을 확인하고 정산 상태를 체크하세요.</p>
                        </div>
                    </div>
                    {renderMeatContent()}
                </TabsContent>

                <TabsContent value="other" className="mt-0">
                    {renderTabContent('other')}
                </TabsContent>
            </Tabs>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-5xl xl:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto bg-slate-50" onInteractOutside={(e) => e.preventDefault()}>
                    <DialogTitle className="sr-only">예약 조회 및 수정</DialogTitle>
                    <ReservationForm initialData={editingReservation} onSuccess={() => {
                        setIsDialogOpen(false)
                        setEditingReservation(null)
                        fetchSettlements(currentDate)
                    }} />
                </DialogContent>
            </Dialog>
        </div>
    )
}
