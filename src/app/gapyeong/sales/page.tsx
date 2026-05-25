"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns"
import { ko } from "date-fns/locale"
import { DashboardStats, SalesTrendChart } from "@/components/SalesDashboardNodes"
import { Button } from "@/components/ui/button"
import { PinUnlockDialog } from "@/components/PinUnlockDialog"
import { Lock } from "lucide-react"
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

    // Next.js Router Cache가 컴포넌트 state를 유지하므로,
    // 다른 페이지에서 돌아올 때 pathname 변화를 감지해 잠금 초기화
    const pathname = usePathname()
    const prevPathRef = useRef(pathname)
    useEffect(() => {
        if (prevPathRef.current !== '/sales' && pathname === '/sales') {
            setIsUnlocked(false)
        }
        prevPathRef.current = pathname
    }, [pathname])

    const handleUnlockSuccess = () => {
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

            {isUnlocked ? (
                <DashboardStats
                    sales={totalSales}
                    reservations={totalCount}
                    avgSales={avgSales}
                />
            ) : (
                <div
                    className="flex items-center justify-center h-28 bg-slate-100 rounded-xl cursor-pointer border border-slate-200"
                    onClick={() => setIsPinDialogOpen(true)}
                >
                    <div className="bg-white px-5 py-3 rounded-full border shadow-md flex items-center gap-2">
                        <Lock className="w-5 h-5 text-slate-700" />
                        <span className="text-sm font-bold text-slate-700">클릭하여 잠금 해제</span>
                    </div>
                </div>
            )}

            {isUnlocked ? (
                <div className="space-y-6">
                    <SalesTrendChart data={chartData} />

                    <Card className="border-none shadow-md">
                        <CardHeader>
                            <CardTitle>상세 내역</CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table className="min-w-[500px]">
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
                                            .slice(0, 5)
                                            .map((res: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium">{res.date}</TableCell>
                                                    <TableCell className="text-muted-foreground">-</TableCell>
                                                    <TableCell className="text-muted-foreground">-</TableCell>
                                                    <TableCell className="text-right font-bold">₩{Number(res.total_amount).toLocaleString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${res.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
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
            ) : (
                <div
                    className="flex items-center justify-center h-64 bg-slate-100 rounded-xl cursor-pointer border border-slate-200"
                    onClick={() => setIsPinDialogOpen(true)}
                >
                    <div className="bg-white px-5 py-3 rounded-full border shadow-md flex items-center gap-2">
                        <Lock className="w-5 h-5 text-slate-700" />
                        <span className="text-sm font-bold text-slate-700">클릭하여 잠금 해제</span>
                    </div>
                </div>
            )}

            <PinUnlockDialog 
                isOpen={isPinDialogOpen} 
                onClose={() => setIsPinDialogOpen(false)} 
                onUnlock={handleUnlockSuccess} 
            />
        </div>
    )

}
