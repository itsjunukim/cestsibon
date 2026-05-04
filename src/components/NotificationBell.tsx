"use client"

import { useRouter, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Bell, AlertCircle, CalendarDays, Users } from "lucide-react"
import { format, addDays, differenceInCalendarDays, startOfDay } from "date-fns"
import { cn, formatPhone } from "@/lib/utils"
import { useState } from "react"

interface DepositAlert {
    id: string
    date: string
    created_at: string
    customer_name: string
    phone: string | null
    reservation_type: string | null
    headcount: number | null
    total_amount: number | null
    deposit: number | null
    accommodations: { name: string } | null
}

export function NotificationBell() {
    const router = useRouter()
    const pathname = usePathname()
    const supabase = createClient()
    const [open, setOpen] = useState(false)

    const { data: alerts } = useQuery<DepositAlert[]>({
        queryKey: ["deposit-alerts"],
        queryFn: async () => {
            const today = startOfDay(new Date())
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000)

            const { data, error } = await supabase
                .from("reservations")
                .select("id, date, created_at, customer_name, phone, reservation_type, headcount, total_amount, deposit, accommodations(name)")
                .eq("is_deposit_paid", false)
                .eq("status", "booked")
                .gte("date", format(today, "yyyy-MM-dd"))
                .lte("created_at", twelveHoursAgo.toISOString())
                .order("created_at", { ascending: false })

            if (error) {
                console.error("Notification fetch error:", error)
                return []
            }
            return (data as any) || []
        },
        refetchInterval: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    })

    if (pathname === '/login' || pathname.startsWith('/auth')) return null

    const count = alerts?.length || 0

    const getDayLabel = (dateStr: string) => {
        const diff = differenceInCalendarDays(new Date(dateStr), startOfDay(new Date()))
        if (diff === 0) return { label: "오늘", color: "text-red-600 bg-red-50 border-red-200" }
        if (diff === 1) return { label: "내일", color: "text-orange-600 bg-orange-50 border-orange-200" }
        if (diff === 2) return { label: "모레", color: "text-amber-600 bg-amber-50 border-amber-200" }
        return { label: `D-${diff}`, color: "text-slate-600 bg-slate-50 border-slate-200" }
    }

    const getTypeLabel = (type: string | null) => {
        if (type === 'accommodation') return '숙박'
        if (type === 'day') return '당일'
        return type || '-'
    }

    const handleAlertClick = (id: string) => {
        setOpen(false)
        router.push(`/reservations?edit=${id}`)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 hover:bg-muted"
                    title="예약금 미입금 알림"
                >
                    <Bell className={cn("h-5 w-5", count > 0 ? "text-primary" : "text-muted-foreground")} />
                    {count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-background">
                            {count > 99 ? '99+' : count}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-[340px] p-0 overflow-hidden"
                sideOffset={8}
            >
                <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">예약금 미입금 알림</h4>
                        {count > 0 && (
                            <span className="ml-auto text-xs font-medium text-muted-foreground">
                                {count}건
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        예약 생성 후 12시간 경과된 예약금 미입금 건
                    </p>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                    {count === 0 ? (
                        <div className="py-10 px-4 text-center">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-50 mb-2">
                                <Bell className="h-5 w-5 text-green-600" />
                            </div>
                            <p className="text-sm font-medium text-foreground">알림이 없습니다</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                모든 예약금이 입금 완료되었습니다
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {alerts?.map((alert) => {
                                const day = getDayLabel(alert.date)
                                const balance = Number(alert.total_amount || 0) - Number(alert.deposit || 0)
                                return (
                                    <button
                                        key={alert.id}
                                        onClick={() => handleAlertClick(alert.id)}
                                        className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors active:bg-muted"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={cn(
                                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0",
                                                    day.color
                                                )}>
                                                    {day.label}
                                                </span>
                                                <span className="font-semibold text-sm truncate">
                                                    {alert.customer_name}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                                                {format(new Date(alert.date), "MM.dd")}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="inline-flex items-center gap-1">
                                                <CalendarDays className="h-3 w-3" />
                                                {getTypeLabel(alert.reservation_type)}
                                            </span>
                                            {alert.headcount && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Users className="h-3 w-3" />
                                                    {alert.headcount}명
                                                </span>
                                            )}
                                            {alert.phone && (
                                                <span className="truncate">
                                                    {formatPhone(alert.phone)}
                                                </span>
                                            )}
                                        </div>

                                        {Number(alert.total_amount) > 0 && (
                                            <div className="flex items-center justify-between mt-1.5 text-xs">
                                                <span className="text-muted-foreground">
                                                    {alert.accommodations?.name || ''}
                                                </span>
                                                <span className="font-bold text-red-600">
                                                    미입금 {balance.toLocaleString()}원
                                                </span>
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {count > 0 && (
                    <div className="border-t bg-muted/30 px-4 py-2">
                        <p className="text-[10px] text-muted-foreground text-center">
                            항목을 클릭하면 예약 수정 화면으로 이동합니다
                        </p>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
