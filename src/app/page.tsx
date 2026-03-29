"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CreditCard, Calendar as CalendarIcon, TrendingUp, DollarSign, Activity, CalendarDays, Lock } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useQuery } from "@tanstack/react-query"
import { StatsChart } from "@/components/StatsChart"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns"
import { ko } from "date-fns/locale"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { PinUnlockDialog } from "@/components/PinUnlockDialog"

type ViewMode = 'daily' | 'weekly' | 'monthly'

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false)

  // Fixed reference date to today since picker is removed
  const date = new Date()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const unlocked = sessionStorage.getItem('dashboard_unlocked') === 'true'
    setIsUnlocked(unlocked)
  }, [])

  const handleUnlockSuccess = () => {
    sessionStorage.setItem('dashboard_unlocked', 'true')
    setIsUnlocked(true)
    setIsPinDialogOpen(false)
  }

  // Calculate range based on mode
  const getRange = () => {
    const start = date // default
    const end = date // default

    if (viewMode === 'daily') {
      return {
        start: date,
        end: date,
        label: format(date, "PPP", { locale: ko })
      }
    }
    if (viewMode === 'weekly') {
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }),
        end: endOfWeek(date, { weekStartsOn: 1 }),
        label: `${format(startOfWeek(date, { weekStartsOn: 1 }), "MMM d일", { locale: ko })} - ${format(endOfWeek(date, { weekStartsOn: 1 }), "MMM d일", { locale: ko })}`
      }
    }
    if (viewMode === 'monthly') {
      return {
        start: startOfMonth(date),
        end: endOfMonth(date),
        label: format(date, "yyyy년 MMMM", { locale: ko })
      }
    }
    return { start, end, label: '' }
  }

  const { start, end, label } = getRange()

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", viewMode], // Removed 'date' from key as it's constant 'now' basically, or viewMode changes range
    queryFn: async () => {
      const startStr = format(start, "yyyy-MM-dd")
      const endStr = format(end, "yyyy-MM-dd")

      // Query Reservations for EVERYTHING (Sales, Count, Chart)
      // User requested Sales to be based on reservations total_amount
      const { data: reservations, error } = await supabase
        .from("reservations")
        .select("date, total_amount, status, customer_name, reservation_type, headcount")
        .gte("date", startStr)
        .lte("date", endStr)
        .neq("status", "cancelled")
        .order('date', { ascending: false })

      if (error) {
        console.error("Error fetching reservations:", error)
        return { totalSales: 0, activeReservations: 0, visitorCount: 0, chartData: [] }
      }

      // 1. Calculate Total Sales
      const totalSales = reservations?.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0) || 0

      // 2. Reservations Count
      const activeReservations = reservations?.length || 0

      // 3. Visitor Count (Sum of headcount from all reservations)
      const visitorCount = reservations?.reduce((acc, curr) => acc + (Number(curr.headcount) || 0), 0) || 0

      // 4. Chart Data
      let chartData = []
      if (viewMode === 'daily') {
        // Single bar for the day
        chartData = [{
          name: format(start, "MMM dd일", { locale: ko }),
          total: totalSales,
          fullDate: startStr
        }]
      } else {
        const days = eachDayOfInterval({ start, end })
        chartData = days.map(day => {
          const dayStr = format(day, "yyyy-MM-dd")
          const dayTotal = reservations
            ?.filter(res => res.date === dayStr)
            .reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0) || 0

          return {
            name: format(day, "d일", { locale: ko }),
            total: dayTotal,
            fullDate: dayStr
          }
        })
      }

      return {
        totalSales,
        activeReservations,
        visitorCount,
        chartData
      }
    }
  })

  const finalStats = stats || {
    totalSales: 0,
    activeReservations: 0,
    visitorCount: 0,
    chartData: []
  }

  const handleChartClick = (data: any) => {
    if (data && data.fullDate) {
      router.push(`/reservations?date=${data.fullDate}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            영업 현황 (홈)
          </h1>
          <p className="text-sm text-muted-foreground">{label} 현황</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-1 border bg-slate-100/80 rounded-md p-1 shadow-sm h-10 w-full md:w-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('daily')}
              className={`flex-1 md:w-16 rounded-md transition-all duration-300 h-8 text-xs font-semibold ${viewMode === 'daily' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60 hover:bg-white/90' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border border-transparent'}`}
            >
              오늘
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('weekly')}
              className={`flex-1 md:w-16 rounded-md transition-all duration-300 h-8 text-xs font-semibold ${viewMode === 'weekly' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60 hover:bg-white/90' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border border-transparent'}`}
            >
              이번 주
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('monthly')}
              className={`flex-1 md:w-16 rounded-md transition-all duration-300 h-8 text-xs font-semibold ${viewMode === 'monthly' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60 hover:bg-white/90' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border border-transparent'}`}
            >
              이번 달
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 animate-fade-up delay-100">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover-lift">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 opacity-10">
            <DollarSign className="h-full w-full" />
          </div>
          <div className={cn("transition-all duration-300 h-full", !isUnlocked && "blur-md select-none opacity-50")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-indigo-100">총 매출</CardTitle>
              <DollarSign className="h-4 w-4 text-indigo-100" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₩{isUnlocked ? finalStats.totalSales.toLocaleString() : "***,***"}</div>
              <p className="text-xs text-indigo-200 mt-1 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                {label} 매출
              </p>
            </CardContent>
          </div>
          {!isUnlocked && (
            <div 
              className="absolute inset-0 z-10 flex flex-col items-center justify-center cursor-pointer hover:bg-black/10 transition-colors rounded-xl"
              onClick={() => setIsPinDialogOpen(true)}
            >
              <Lock className="w-6 h-6 text-white drop-shadow-md mb-1" />
              <span className="text-xs font-medium text-white drop-shadow-md">잠금 해제</span>
            </div>
          )}
        </Card>

        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-orange-400 to-pink-500 text-white shadow-lg hover-lift">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 opacity-10">
            <Users className="h-full w-full" />
          </div>
          <div className={cn("transition-all duration-300 h-full", !isUnlocked && "blur-md select-none opacity-50")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-100">예약</CardTitle>
              <CalendarDays className="h-4 w-4 text-orange-100" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isUnlocked ? finalStats.activeReservations : "***"}건</div>
              <p className="text-xs text-orange-200 mt-1 flex items-center">
                <Users className="mr-1 h-3 w-3" />
                {label} 예약
              </p>
            </CardContent>
          </div>
          {!isUnlocked && (
            <div 
              className="absolute inset-0 z-10 flex flex-col items-center justify-center cursor-pointer hover:bg-black/10 transition-colors rounded-xl"
              onClick={() => setIsPinDialogOpen(true)}
            >
              <Lock className="w-6 h-6 text-white drop-shadow-md mb-1" />
              <span className="text-xs font-medium text-white drop-shadow-md">잠금 해제</span>
            </div>
          )}
        </Card>

        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg hover-lift">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 opacity-10">
            <Activity className="h-full w-full" />
          </div>
          <div className={cn("transition-all duration-300 h-full", !isUnlocked && "blur-md select-none opacity-50")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100">총 방문객</CardTitle>
              <Users className="h-4 w-4 text-emerald-100" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isUnlocked ? finalStats.visitorCount : "***"}명</div>
              <p className="text-xs text-emerald-200 mt-1 flex items-center">
                <Users className="mr-1 h-3 w-3" />
                {label} 방문 수
              </p>
            </CardContent>
          </div>
          {!isUnlocked && (
            <div 
              className="absolute inset-0 z-10 flex flex-col items-center justify-center cursor-pointer hover:bg-black/10 transition-colors rounded-xl"
              onClick={() => setIsPinDialogOpen(true)}
            >
              <Lock className="w-6 h-6 text-white drop-shadow-md mb-1" />
              <span className="text-xs font-medium text-white drop-shadow-md">잠금 해제</span>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 animate-fade-up delay-200">
        <Card className="col-span-4 border-none shadow-md hover-lift transition-all duration-300 relative">
          <div className={cn("transition-all duration-300 h-full", !isUnlocked && "blur-md select-none opacity-30 pointer-events-none")}>
            <CardHeader>
              <CardTitle>매출 추이</CardTitle>
            </CardHeader>
            <CardContent className="pl-2 relative">
              <StatsChart
                data={finalStats.chartData}
                onBarClick={handleChartClick}
              />
            </CardContent>
          </div>
          {!isUnlocked && (
            <div 
              className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer hover:bg-muted/10 transition-colors rounded-xl"
              onClick={() => setIsPinDialogOpen(true)}
            >
              <div className="bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full border shadow-sm flex items-center gap-2 text-foreground">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">잠금 해제</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      <PinUnlockDialog 
        isOpen={isPinDialogOpen} 
        onClose={() => setIsPinDialogOpen(false)} 
        onUnlock={handleUnlockSuccess} 
      />
    </div>
  )
}
