"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ChevronLeft, ChevronRight, Calculator, Home, CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ko } from "date-fns/locale"

export default function SettlementsPage() {
    const supabase = createClient()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [settlementsData, setSettlementsData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchSettlements = async (date: Date) => {
        setIsLoading(true)
        const start = format(startOfMonth(date), "yyyy-MM-dd")
        const end = format(endOfMonth(date), "yyyy-MM-dd")
        const monthString = format(startOfMonth(date), "yyyy-MM-dd")

        // 1. 해당 월의 정산 완료 상태 데이터를 가져옴
        const { data: monthlyStatus } = await supabase
            .from("monthly_settlements")
            .select("*")
            .eq("settlement_month", monthString)

        // 2. 해당 월의 숙박 예약과 연관된 정산 데이터를 모두 가져옴
        const { data: reservations, error } = await supabase
            .from("reservations")
            .select(`
                id,
                date,
                reservation_type,
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
            console.error("Error fetching settlements:", error)
            setIsLoading(false)
            return
        }

        // 3. 숙소별로 정산 금액 취합
        const aggregated: Record<string, any> = {}

        reservations?.forEach((res: any) => {
            const accId = res.accommodation_id
            if (!accId) return // 숙소가 지정되지 않은 예약은 패스

            if (!aggregated[accId]) {
                const status = monthlyStatus?.find(s => s.accommodation_id === accId)
                aggregated[accId] = {
                    accommodation_id: accId,
                    accommodation_name: res.accommodations?.name || "숙소명 없음",
                    accommodation_total: 0,
                    meat_total: 0,
                    other_total: 0,
                    total: 0,
                    is_paid: status?.is_paid || false,
                    paid_date: status?.paid_date || ""
                }
            }

            res.accommodation_settlements?.forEach((settlement: any) => {
                const amount = settlement.amount || 0
                if (settlement.category === "accommodation") {
                    aggregated[accId].accommodation_total += amount
                } else if (settlement.category === "meat") {
                    aggregated[accId].meat_total += amount
                } else if (settlement.category === "other") {
                    aggregated[accId].other_total += amount
                }
                aggregated[accId].total += amount
            })
        })

        setSettlementsData(Object.values(aggregated))
        setIsLoading(false)
    }

    useEffect(() => {
        fetchSettlements(currentDate)
    }, [currentDate])

    const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1))
    const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1))

    const handleUpdatePaymentStatus = async (accId: string, updates: Partial<{ is_paid: boolean, paid_date: string | null }>) => {
        const monthString = format(startOfMonth(currentDate), "yyyy-MM-dd")
        
        // Optimistic UI Update
        setSettlementsData(prev => prev.map(item => 
            item.accommodation_id === accId ? { ...item, ...updates } : item
        ))

        // Get the most up-to-date item from the previous state (before this optimistic update)
        // to merge with the new updates. This avoids stale closure issues.
        setSettlementsData(prev => {
            const currentItem = prev.find(s => s.accommodation_id === accId)
            
            // Execute DB update asynchronously using the freshest state
            const executeUpdate = async () => {
                const isPaid = updates.is_paid !== undefined ? updates.is_paid : (currentItem?.is_paid || false)
                const paidDate = updates.paid_date !== undefined ? updates.paid_date : (currentItem?.paid_date || null)

                const { error } = await supabase
                    .from("monthly_settlements")
                    .upsert({
                        accommodation_id: accId,
                        settlement_month: monthString,
                        is_paid: isPaid,
                        paid_date: paidDate ? paidDate : null,
                        updated_at: new Date().toISOString()
                    }, { onConflict: "accommodation_id, settlement_month" })
                
                if (error) {
                    console.error("Error updating payment status:", error)
                    alert("정산 상태 업데이트에 실패했습니다.")
                    fetchSettlements(currentDate)
                }
            }
            
            executeUpdate()
            
            return prev // We already optimistically updated in the previous setSettlementsData
        })
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ko-KR').format(amount) + '원'
    }

    // 전체 합계 계산
    const grandTotal = settlementsData.reduce((acc, curr) => ({
        accommodation_total: acc.accommodation_total + curr.accommodation_total,
        meat_total: acc.meat_total + curr.meat_total,
        other_total: acc.other_total + curr.other_total,
        total: acc.total + curr.total,
    }), { accommodation_total: 0, meat_total: 0, other_total: 0, total: 0 })

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Calculator className="h-6 w-6 text-primary" />
                        숙소별 정산 관리
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        해당 월에 진행된 예약 기준으로 숙소별 지급할 정산 금액을 취합합니다.
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

            <Card className="border-t-4 border-t-primary shadow-md">
                <CardHeader>
                    <CardTitle className="text-xl">월간 정산 내역</CardTitle>
                    <CardDescription>
                        {format(currentDate, "MM월 1일")}부터 {format(endOfMonth(currentDate), "MM월 d일")}까지의 예약 기준
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="py-12 text-center text-muted-foreground">데이터를 불러오는 중입니다...</div>
                    ) : settlementsData.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                            <Home className="h-10 w-10 text-muted-foreground/30" />
                            <p>이 달에 등록된 숙소 정산 내역이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50 whitespace-nowrap">
                                    <TableRow>
                                        <TableHead className="font-semibold text-center py-4">숙소명</TableHead>
                                        <TableHead className="font-semibold text-right">숙소 정산</TableHead>
                                        <TableHead className="font-semibold text-right">고기 정산</TableHead>
                                        <TableHead className="font-semibold text-right">기타 정산</TableHead>
                                        <TableHead className="font-semibold text-right text-primary">총 지급액</TableHead>
                                        <TableHead className="font-semibold text-center">정산 여부</TableHead>
                                        <TableHead className="font-semibold text-center min-w-[140px]">정산일</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {settlementsData.map((data, idx) => (
                                        <TableRow key={idx} className={data.is_paid ? "bg-slate-50/50" : "hover:bg-muted/30"}>
                                            <TableCell className="font-medium text-center">{data.accommodation_name}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(data.accommodation_total)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(data.meat_total)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(data.other_total)}</TableCell>
                                            <TableCell className="text-right font-bold text-primary bg-primary/5">
                                                {formatCurrency(data.total)}
                                            </TableCell>
                                            <TableCell className="text-center align-middle">
                                                <div className="flex justify-center">
                                                        <Checkbox 
                                                        checked={data.is_paid}
                                                        onCheckedChange={(checked) => {
                                                            const isPaid = !!checked;
                                                            const newDate = isPaid && !data.paid_date ? format(new Date(), "yyyy-MM-dd") : (!isPaid ? null : data.paid_date);
                                                            handleUpdatePaymentStatus(data.accommodation_id, {
                                                                is_paid: isPaid,
                                                                paid_date: newDate
                                                            });
                                                        }}
                                                        className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 shadow-sm"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center align-middle">
                                                {data.is_paid && (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant={"outline"}
                                                                className={cn("w-[130px] h-9 bg-white px-3 text-left font-normal border-green-200 shadow-sm", !data.paid_date && "text-muted-foreground")}
                                                            >
                                                                {data.paid_date ? (
                                                                    format(new Date(data.paid_date), "MM월 dd일", { locale: ko })
                                                                ) : (
                                                                    <span>날짜 선택</span>
                                                                )}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="center">
                                                            <Calendar
                                                                mode="single"
                                                                selected={data.paid_date ? new Date(data.paid_date) : undefined}
                                                                onSelect={(date) => {
                                                                    if (date) {
                                                                        handleUpdatePaymentStatus(data.accommodation_id, { paid_date: format(date, "yyyy-MM-dd") })
                                                                    }
                                                                }}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {/* Grand Total Row */}
                                    <TableRow className="bg-slate-50 font-bold border-t-2">
                                        <TableCell className="text-center text-slate-700">전체 합계</TableCell>
                                        <TableCell className="text-right text-slate-700">{formatCurrency(grandTotal.accommodation_total)}</TableCell>
                                        <TableCell className="text-right text-slate-700">{formatCurrency(grandTotal.meat_total)}</TableCell>
                                        <TableCell className="text-right text-slate-700">{formatCurrency(grandTotal.other_total)}</TableCell>
                                        <TableCell className="text-right text-primary text-lg">{formatCurrency(grandTotal.total)}</TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
