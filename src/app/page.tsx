"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CreditCard, Calendar as CalendarIcon, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useQuery } from "@tanstack/react-query"
import { StatsChart } from "@/components/StatsChart"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

type ViewMode = 'daily' | 'weekly' | 'monthly'

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [date, setDate] = useState<Date>(new Date()) // Reference date
  const supabase = createClient()

  // Calculate range based on mode
  const getRange = () => {
    const start = date // default
    const end = date // default

    if (viewMode === 'daily') {
      return {
        start: date,
        end: date,
        label: format(date, "PPP")
      }
    }
    if (viewMode === 'weekly') {
      return {
        start: startOfWeek(date),
        end: endOfWeek(date),
        label: `${format(startOfWeek(date), "MMM d")} - ${format(endOfWeek(date), "MMM d")}`
      }
    }
    if (viewMode === 'monthly') {
      return {
        start: startOfMonth(date),
        end: endOfMonth(date),
        label: format(date, "MMMM yyyy")
      }
    }
    return { start, end, label: '' }
  }

  const { start, end, label } = getRange()

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", viewMode, date],
    queryFn: async () => {
      const startStr = format(start, "yyyy-MM-dd")
      const endStr = format(end, "yyyy-MM-dd")

      // 1. Sales in Range
      const { data: sales } = await supabase
        .from("sales")
        .select("amount, created_at")
        .gte("created_at", startStr)
        .lte("created_at", endStr + " 23:59:59") // Ensure full day inclusion

      const totalSales = sales?.reduce((acc, curr) => acc + curr.amount, 0) || 0

      // 2. Reservations (Check-ins in range)
      const { count: activeReservations } = await supabase
        .from("reservations")
        .select("*", { count: 'exact', head: true })
        .gte("date", startStr)
        .lte("date", endStr)
        .neq("status", "cancelled")

      // 3. Visitors/Transactions count
      const visitorCount = sales?.length || 0

      // 4. Chart Data
      // Generate list of days in interval
      let chartData = []
      if (viewMode === 'daily') {
        // For daily, maybe show hourly if we had it, but for now just single bar or last few days?
        // Let's rely on standard daily bars. If single day, just 1 bar.
        chartData = [{ name: format(start, "MMM dd"), total: totalSales }]
      } else {
        const days = eachDayOfInterval({ start, end })
        chartData = days.map(day => {
          const dayStr = format(day, "yyyy-MM-dd")
          // Filter sales for this day (in memory is fine for small ranges)
          // For monthly this might be a bit heavy if thousands of sales, but okay for MVP.
          const dayTotal = sales
            ?.filter(s => s.created_at.startsWith(dayStr))
            .reduce((acc, curr) => acc + curr.amount, 0) || 0
          return {
            name: format(day, "d"), // just day number for denseness
            total: dayTotal
          }
        })
      }

      return {
        totalSales,
        activeReservations: activeReservations || 0,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-500">
            영업 현황
          </h1>
          <p className="text-sm text-muted-foreground">{label} 현황</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-muted rounded-lg">
            <Button
              variant={viewMode === 'daily' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('daily')}
              className="text-xs"
            >
              일간
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('weekly')}
              className="text-xs"
            >
              주간
            </Button>
            <Button
              variant={viewMode === 'monthly' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('monthly')}
              className="text-xs"
            >
              월간
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[200px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>날짜 선택</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-all duration-300 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">매출</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₩{finalStats.totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{label}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">예약</CardTitle>
            <CalendarIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finalStats.activeReservations}</div>
            <p className="text-xs text-muted-foreground">{label} 예약</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">방문/거래</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finalStats.visitorCount}</div>
            <p className="text-xs text-muted-foreground">{label} 거래수</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">성장률</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">데이터 부족</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1">
        <Card className="col-span-4 border-primary/10">
          <CardHeader>
            <CardTitle>매출 추이</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <StatsChart data={finalStats.chartData} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
