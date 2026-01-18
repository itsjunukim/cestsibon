"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CreditCard, Calendar as CalendarIcon, TrendingUp, DollarSign, Activity, CalendarDays } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useQuery } from "@tanstack/react-query"
import { StatsChart } from "@/components/StatsChart"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns"
import { ko } from "date-fns/locale"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

type ViewMode = 'daily' | 'weekly' | 'monthly'

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  // Fixed reference date to today since picker is removed
  const date = new Date()
  const supabase = createClient()
  const router = useRouter()

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
        start: startOfWeek(date, { locale: ko }),
        end: endOfWeek(date, { locale: ko }),
        label: `${format(startOfWeek(date, { locale: ko }), "MMM d일", { locale: ko })} - ${format(endOfWeek(date, { locale: ko }), "MMM d일", { locale: ko })}`
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
        .select("date, total_amount, status, customer_name, reservation_type")
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

      // 3. Visitor/Transaction Count (Usage of reservations as proxy for visitors/transactions)
      const visitorCount = reservations?.length || 0

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
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-500">
            영업 현황 (홈)
          </h1>
          <p className="text-sm text-muted-foreground">{label} 현황</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-muted rounded-lg shadow-sm">
            <Button
              variant={viewMode === 'daily' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('daily')}
              className="w-16 rounded-md transition-all duration-300"
            >
              일간
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('weekly')}
              className="w-16 rounded-md transition-all duration-300"
            >
              주간
            </Button>
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('monthly')}
              className="w-16 rounded-md transition-all duration-300"
            >
              월간
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 animate-fade-up delay-100">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover-lift">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 opacity-10">
            <DollarSign className="h-full w-full" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-100">총 매출</CardTitle>
            <DollarSign className="h-4 w-4 text-indigo-100" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₩{finalStats.totalSales.toLocaleString()}</div>
            <p className="text-xs text-indigo-200 mt-1 flex items-center">
              <TrendingUp className="mr-1 h-3 w-3" />
              {label} 매출
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-orange-400 to-pink-500 text-white shadow-lg hover-lift">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 opacity-10">
            <Users className="h-full w-full" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-100">예약</CardTitle>
            <CalendarDays className="h-4 w-4 text-orange-100" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finalStats.activeReservations}건</div>
            <p className="text-xs text-orange-200 mt-1 flex items-center">
              <Users className="mr-1 h-3 w-3" />
              {label} 예약
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg hover-lift">
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 opacity-10">
            <Activity className="h-full w-full" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-100">방문/거래</CardTitle>
            <CreditCard className="h-4 w-4 text-emerald-100" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finalStats.visitorCount}건</div>
            <p className="text-xs text-emerald-200 mt-1 flex items-center">
              <Activity className="mr-1 h-3 w-3" />
              {label} 거래수
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 animate-fade-up delay-200">
        <Card className="col-span-4 border-none shadow-md hover-lift transition-all duration-300">
          <CardHeader>
            <CardTitle>매출 추이</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <StatsChart
              data={finalStats.chartData}
              onBarClick={handleChartClick}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
