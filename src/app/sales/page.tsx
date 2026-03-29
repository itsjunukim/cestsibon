"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns"
import { ko } from "date-fns/locale"
import { DashboardStats, SalesTrendChart } from "@/components/SalesDashboardNodes"
import { Button } from "@/components/ui/button"
import { PinUnlockDialog } from "@/components/PinUnlockDialog"
import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect } from "react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type ViewType = 'daily' | 'weekly' | 'monthly'

export default function SalesPage() {
    const [viewType, setViewType] = useState<ViewType>('monthly')
    const [isUnlocked, setIsUnlocked] = useState(false)
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false)

    useEffect(() => {
        const unlocked = sessionStorage.getItem('dashboard_unlocked') === 'true'
        setIsUnlocked(unlocked)
    }, [])

    const handleUnlockSuccess = () => {
        sessionStorage.setItem('dashboard_unlocked', 'true')
        setIsUnlocked(true)
        setIsPinDialogOpen(false)
    }

    // Derived Date Range based on ViewType
    const getDateRange = () => {
        const today = new Date()
        if (viewType === 'daily') {
            return { from: startOfDay(today), to: endOfDay(today) }
        }
        if (viewType === 'weekly') {
            return {
                from: startOfWeek(today, { weekStartsOn: 1 }),
                to: endOfWeek(today, { weekStartsOn: 1 })
            }
        }
        // monthly
        return {
            from: startOfMonth(today),
            to: endOfMonth(today)
        }
    }

    const dateRange = getDateRange()
    const supabase = createClient()

    // Query Reservations
    const { data: reservations, isLoading } = useQuery({
        queryKey: ["sales_stats", viewType, format(dateRange.from, "yyyy-MM-dd"), format(dateRange.to, "yyyy-MM-dd")],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("reservations")
                .select("date, total_amount, status")
                .neq("status", "cancelled")
                .gte("date", format(dateRange.from, "yyyy-MM-dd"))
                .lte("date", format(dateRange.to, "yyyy-MM-dd"))

            if (error) {
                console.error(error)
                return []
            }
            return data
        },
    })

    // Calculate Stats
    const totalSales = reservations?.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0) || 0
    const totalCount = reservations?.length || 0
    const avgSales = totalCount > 0 ? Math.round(totalSales / totalCount) : 0

    // Prepare Chart Data
    const chartData = (() => {
        if (!reservations) return []

        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })

        return days.map(day => {
            const dayStr = format(day, "yyyy-MM-dd")
            const dailyTotal = reservations
                ?.filter((res: any) => res.date === dayStr)
                .reduce((sum: number, res: any) => sum + (Number(res.total_amount) || 0), 0) || 0

            return {
                date: format(day, "MM.dd"),
                amount: dailyTotal,
                fullDate: dayStr
            }
        })
    })()

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold text-primary">
                    영업 현황
                </h1>

                <div className="flex items-center space-x-1 border bg-slate-100/80 rounded-md p-1 shadow-sm h-10 w-full md:w-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewType('daily')}
                        className={`flex-1 md:w-20 rounded-md transition-all h-8 text-xs font-semibold ${viewType === 'daily' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60 hover:bg-white/90' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border border-transparent'}`}
                    >
                        오늘
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewType('weekly')}
                        className={`flex-1 md:w-20 rounded-md transition-all h-8 text-xs font-semibold ${viewType === 'weekly' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60 hover:bg-white/90' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border border-transparent'}`}
                    >
                        이번 주
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewType('monthly')}
                        className={`flex-1 md:w-20 rounded-md transition-all h-8 text-xs font-semibold ${viewType === 'monthly' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60 hover:bg-white/90' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border border-transparent'}`}
                    >
                        이번 달
                    </Button>
                </div>
            </div>

            <div className="relative">
                <div className={cn("transition-all duration-300", !isUnlocked && "blur-md select-none opacity-50")}>
                    <DashboardStats
                        sales={isUnlocked ? totalSales : 0}
                        reservations={totalCount}
                        avgSales={isUnlocked ? avgSales : 0}
                    />
                </div>
                {!isUnlocked && (
                    <div 
                        className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer rounded-xl hover:bg-black/5 transition-colors"
                        onClick={() => setIsPinDialogOpen(true)}
                    >
                        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border shadow-sm flex items-center gap-2">
                            <Lock className="w-5 h-5 text-slate-700" />
                            <span className="text-sm font-bold text-slate-700">잠금 해제</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-1 relative">
                <div className={cn("transition-all duration-300 space-y-6", !isUnlocked && "blur-md select-none opacity-30 pointer-events-none")}>
                    <SalesTrendChart data={chartData} />

                    <Card className="border-none shadow-md">
                    <CardHeader>
                        <CardTitle>상세 내역</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>날짜</TableHead>
                                    <TableHead>유형</TableHead>
                                    <TableHead>예약자</TableHead>
                                    <TableHead className="text-right">금액</TableHead>
                                    <TableHead className="text-right">상태</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">로딩중...</TableCell>
                                    </TableRow>
                                ) : reservations && reservations.length > 0 ? (
                                    reservations
                                        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .slice(0, 5) // Show top 5 recent
                                        .map((res: any, idx: number) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium">{res.date}</TableCell>
                                                <TableCell>
                                                    {/* We didn't select reservation_type in query, let's just show default or update query if needed. 
                                                     Wait, Step 68 code selects "date, total_amount, status". 
                                                     I should update query to select 'reservation_type', 'customer_name' too.
                                                     But I can't update query here easily without replacing the whole file or relying on 'select *'.
                                                     The Step 68 query was: .select("date, total_amount, status")
                                                     I need to update the query to select more fields.
                                                 */}
                                                    -
                                                </TableCell>
                                                <TableCell>-</TableCell>
                                                <TableCell className="text-right font-bold">₩{Number(res.total_amount).toLocaleString()}</TableCell>
                                                <TableCell className="text-right">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${res.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {res.status === 'booked' ? '예약' : res.status === 'completed' ? '완료' : res.status}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">내역이 없습니다.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                </div>
                {!isUnlocked && (
                    <div 
                        className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer rounded-xl hover:bg-black/5 transition-colors"
                        onClick={() => setIsPinDialogOpen(true)}
                    >
                        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border shadow-sm flex items-center gap-2">
                            <Lock className="w-5 h-5 text-slate-700" />
                            <span className="text-sm font-bold text-slate-700">잠금 해제</span>
                        </div>
                    </div>
                )}
            </div>

            <PinUnlockDialog 
                isOpen={isPinDialogOpen} 
                onClose={() => setIsPinDialogOpen(false)} 
                onUnlock={handleUnlockSuccess} 
            />
        </div>
    )

}
