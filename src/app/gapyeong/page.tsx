"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, DollarSign, Activity, CalendarDays, Lock, Wallet, ReceiptText, MapPin, Clock, ChevronRight, TrendingUp, CreditCard, Store, Share2, PiggyBank, Dog } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useQuery } from "@tanstack/react-query"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, startOfDay, endOfDay, isSameDay, addDays, differenceInCalendarDays } from "date-fns"
import { ko } from "date-fns/locale"
import { useState, useEffect, useRef, type ReactNode, type ComponentType } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRouter, usePathname } from "next/navigation"
import { PinUnlockDialog } from "@/components/PinUnlockDialog"
import { DateRange } from "react-day-picker"
import { DateRangePicker } from "@/components/DateRangePicker"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts"

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type AccentTone = "indigo" | "amber" | "emerald" | "violet" | "cyan" | "rose"

const ACCENT_CLASSES: Record<AccentTone, { cardBg: string; border: string; iconBg: string; iconText: string; valueText: string }> = {
  indigo:  { cardBg: "bg-gradient-to-br from-indigo-50/80 to-white",   border: "border-indigo-100",  iconBg: "bg-indigo-100",  iconText: "text-indigo-600",  valueText: "text-indigo-900"  },
  amber:   { cardBg: "bg-gradient-to-br from-amber-50/80 to-white",    border: "border-amber-100",   iconBg: "bg-amber-100",   iconText: "text-amber-600",   valueText: "text-amber-900"   },
  emerald: { cardBg: "bg-gradient-to-br from-emerald-50/80 to-white",  border: "border-emerald-100", iconBg: "bg-emerald-100", iconText: "text-emerald-600", valueText: "text-emerald-900" },
  violet:  { cardBg: "bg-gradient-to-br from-violet-50/80 to-white",   border: "border-violet-100",  iconBg: "bg-violet-100",  iconText: "text-violet-600",  valueText: "text-violet-900"  },
  cyan:    { cardBg: "bg-gradient-to-br from-cyan-50/80 to-white",     border: "border-cyan-100",    iconBg: "bg-cyan-100",    iconText: "text-cyan-600",    valueText: "text-cyan-900"    },
  rose:    { cardBg: "bg-gradient-to-br from-rose-50/80 to-white",     border: "border-rose-100",    iconBg: "bg-rose-100",    iconText: "text-rose-600",    valueText: "text-rose-900"    },
}

interface KPICardProps {
  label: string
  value: ReactNode
  icon: ComponentType<{ className?: string }>
  tone: AccentTone
  hint?: string
  onClick?: () => void
}

function KPICard({ label, value, icon: Icon, tone, hint, onClick }: KPICardProps) {
  const c = ACCENT_CLASSES[tone]
  return (
    <Card 
      onClick={onClick}
      className={cn(
        "rounded-xl shadow-sm transition-all border", 
        c.border, c.cardBg,
        onClick ? "cursor-pointer hover:shadow-md hover:scale-[1.02]" : "hover:shadow-md"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold text-slate-700">
          {label}
        </CardTitle>
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", c.iconBg)}>
          <Icon className={cn("h-5 w-5", c.iconText)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-bold tracking-tight tabular-nums", c.valueText)}>
          {value}
        </div>
        {hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function formatWonShort(v: number): string {
  if (v === 0) return "0원"
  if (Math.abs(v) >= 100000000) {
    const n = v / 100000000
    return `${n % 1 === 0 ? n : n.toFixed(1)}억원`
  }
  if (Math.abs(v) >= 10000) {
    return `${Math.round(v / 10000).toLocaleString()}만원`
  }
  return `${v.toLocaleString()}원`
}

export default function DashboardPage() {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false)

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date()
    return { from: startOfMonth(today), to: endOfMonth(today) }
  })

  const supabase = createClient()
  const router = useRouter()

  const pathname = usePathname()
  const prevPathRef = useRef(pathname)
  useEffect(() => {
    if (prevPathRef.current !== '/' && pathname === '/') {
      setIsUnlocked(false)
    }
    prevPathRef.current = pathname
  }, [pathname])

  const handleUnlockSuccess = () => {
    setIsUnlocked(true)
    setIsPinDialogOpen(false)
  }

  const start = dateRange?.from ? startOfDay(dateRange.from) : startOfDay(new Date())
  const end = dateRange?.to ? endOfDay(dateRange.to) : endOfDay(start)
  const isSingleDay = isSameDay(start, end)
  const label = isSingleDay
    ? format(start, "yyyy년 M월 d일", { locale: ko })
    : `${format(start, "yyyy.MM.dd", { locale: ko })} - ${format(end, "yyyy.MM.dd", { locale: ko })}`

  const startStr = format(start, "yyyy-MM-dd")
  const endStr = format(end, "yyyy-MM-dd")

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", startStr, endStr],
    queryFn: async () => {
      const { data: reservations, error } = await supabase
        .from("reservations")
        .select("date, total_amount, deposit, is_deposit_paid, status, customer_name, reservation_type, headcount, dog_count, balance_payment_method, balance_payments")
        .gte("date", startStr)
        .lte("date", endStr)
        .neq("status", "cancelled")
        .order('date', { ascending: false })

      if (error) {
        console.error("Error fetching reservations:", error)
        return {
          totalSales: 0, expectedSales: 0, activeReservations: 0, visitorCount: 0, dogCount: 0,
          avgPerReservation: 0, avgPerVisitor: 0, unpaidDepositTotal: 0,
          chartData: [], weekdayChart: [],
          salesBreakdown: { transfer: 0, cash: 0, card: 0, place: 0, social: 0, store: 0 }
        }
      }

      let totalSales = 0
      let expectedSales = 0
      let unpaidDepositTotal = 0
      const salesBreakdown = { transfer: 0, cash: 0, card: 0, place: 0, social: 0, store: 0 }
      const chartMap: Record<string, number> = {}
      const weekdaySales = [0, 0, 0, 0, 0, 0, 0]

      const addToBreakdown = (method: string | null | undefined, amount: number) => {
        if (!method || amount <= 0) return
        if (method === 'transfer') salesBreakdown.transfer += amount
        else if (method === 'cash') salesBreakdown.cash += amount
        else if (method === 'card') salesBreakdown.card += amount
        else if (method === 'place') salesBreakdown.place += amount
        else if (method === 'social') salesBreakdown.social += amount
        else if (method === 'store') salesBreakdown.store += amount
      }

      reservations?.forEach(res => {
        const total = Number(res.total_amount) || 0
        const deposit = Number(res.deposit) || 0
        const balance = total - deposit
        const legacyMethod = res.balance_payment_method
        const splitPayments = Array.isArray(res.balance_payments) ? res.balance_payments : []

        // 총 예상 매출: 미입금 예약금 + 미정산 잔금까지 전부 포함
        expectedSales += total

        // --- 실현(정산 완료) 매출 계산 ---
        let realized = 0

        // 예약금: booked + 미입금이면 제외, 그 외엔 실현으로 인정
        const isUnpaidDeposit = !res.is_deposit_paid && res.status === 'booked' && deposit > 0
        if (isUnpaidDeposit) {
            unpaidDepositTotal += deposit
        } else if (deposit > 0) {
            realized += deposit
            salesBreakdown.transfer += deposit
        }

        // 잔금: 결제수단이 확정(정산)된 부분만 실현으로 인정, 미정산은 제외
        if (balance > 0) {
            if (splitPayments.length > 0) {
                splitPayments.forEach((p: any) => {
                    const m = p?.method
                    const amt = Number(p?.amount) || 0
                    if (m && m !== 'none' && amt > 0) {
                        realized += amt
                        addToBreakdown(m, amt)
                    }
                })
            } else if (legacyMethod && legacyMethod !== 'none' && legacyMethod !== '') {
                realized += balance
                addToBreakdown(legacyMethod, balance)
            }
            // else: 미정산 잔금 → 실현 매출에서 제외
        }

        totalSales += realized

        if (res.date) {
            if (!chartMap[res.date]) chartMap[res.date] = 0
            chartMap[res.date] += realized

            const wd = new Date(res.date).getDay()
            weekdaySales[wd] += realized
        }
      })

      const activeReservations = reservations?.length || 0
      const visitorCount = reservations?.reduce((acc, curr) => acc + (Number(curr.headcount) || 0), 0) || 0
      const dogCount = reservations?.reduce((acc, curr) => acc + (Number(curr.dog_count) || 0), 0) || 0
      const avgPerReservation = activeReservations > 0 ? Math.round(totalSales / activeReservations) : 0
      const avgPerVisitor = visitorCount > 0 ? Math.round(totalSales / visitorCount) : 0

      const days = eachDayOfInterval({ start, end })
      const chartData = days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd")
        return {
          name: format(day, "d", { locale: ko }),
          total: chartMap[dayStr] || 0,
          fullDate: dayStr,
        }
      })

      const weekdayChart = WEEKDAY_ORDER.map(idx => ({
        name: WEEKDAY_LABELS[idx],
        total: weekdaySales[idx],
      }))

      return {
        totalSales, expectedSales, activeReservations, visitorCount, dogCount,
        avgPerReservation, avgPerVisitor, unpaidDepositTotal,
        chartData, weekdayChart, salesBreakdown,
      }
    }
  })

  const { data: ops } = useQuery({
    queryKey: ["dashboard-ops"],
    queryFn: async () => {
      const today = startOfDay(new Date())
      const todayStr = format(today, "yyyy-MM-dd")
      const threeDaysLaterStr = format(addDays(today, 3), "yyyy-MM-dd")

      const [pickupsRes, arrivalsRes] = await Promise.all([
        supabase
          .from("reservations")
          .select("id, customer_name, pickup_time, pickup_location, headcount")
          .eq("date", todayStr)
          .not("pickup_location", "is", null)
          .neq("status", "cancelled")
          .order("pickup_time", { ascending: true, nullsFirst: false }),
        supabase
          .from("reservations")
          .select("id, customer_name, date, headcount, reservation_type, accommodations(name)")
          .gte("date", todayStr)
          .lte("date", threeDaysLaterStr)
          .neq("status", "cancelled")
          .order("date", { ascending: true }),
      ])

      return {
        pickups: (pickupsRes.data || []).filter(p => p.pickup_location && p.pickup_location.trim().length > 0),
        arrivals: arrivalsRes.data || [],
      }
    },
    refetchInterval: 10 * 60 * 1000,
  })

  const finalStats = stats || {
    totalSales: 0, expectedSales: 0, activeReservations: 0, visitorCount: 0, dogCount: 0,
    avgPerReservation: 0, avgPerVisitor: 0, unpaidDepositTotal: 0,
    chartData: [], weekdayChart: [],
    salesBreakdown: { transfer: 0, cash: 0, card: 0, place: 0, social: 0, store: 0 }
  }

  const handleChartClick = (data: any) => {
    if (data && data.fullDate) {
      router.push(`/gapyeong/reservations?date=${data.fullDate}`)
    }
  }

  const handleReservationClick = (id: string) => {
    router.push(`/gapyeong/reservations?edit=${id}`)
  }

  const handleNavigateWithFilter = (paymentMethod?: string) => {
    let url = `/gapyeong/reservations?start=${startStr}&end=${endStr}`
    if (paymentMethod) {
      url += `&payment=${paymentMethod}`
    }
    router.push(url)
  }

  const getDayLabel = (dateStr: string) => {
    const diff = differenceInCalendarDays(new Date(dateStr), startOfDay(new Date()))
    if (diff === 0) return { label: "오늘", color: "text-red-600 bg-red-50 border-red-200" }
    if (diff === 1) return { label: "내일", color: "text-orange-600 bg-orange-50 border-orange-200" }
    if (diff === 2) return { label: "모레", color: "text-amber-600 bg-amber-50 border-amber-200" }
    return { label: `D-${diff}`, color: "text-slate-600 bg-slate-50 border-slate-200" }
  }

  const formatWon = (v: number) => `${v.toLocaleString()}원`

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            영업 현황 대시보드
          </h1>
          {isUnlocked && (
            <p className="text-sm text-slate-500 mt-1">{label}</p>
          )}
        </div>

        {isUnlocked && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 border border-slate-200 bg-white rounded-lg p-1 shadow-sm h-10">
              <Button variant="ghost" size="sm" onClick={() => {
                const today = new Date()
                setDateRange({ from: startOfDay(today), to: endOfDay(today) })
              }} className="md:w-16 rounded-md h-8 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100">오늘</Button>
              <Button variant="ghost" size="sm" onClick={() => {
                const today = new Date()
                setDateRange({ from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) })
              }} className="md:w-16 rounded-md h-8 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100">이번 주</Button>
              <Button variant="ghost" size="sm" onClick={() => {
                const today = new Date()
                setDateRange({ from: startOfMonth(today), to: endOfMonth(today) })
              }} className="md:w-16 rounded-md h-8 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100">이번 달</Button>
            </div>
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          </div>
        )}
      </div>

      <div className="relative">
        <div className={cn("space-y-6 transition-all duration-300", !isUnlocked && "blur-md select-none pointer-events-none")}>
          {/* KPI Grid (Top) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KPICard
              label="총 예상 매출"
              value={formatWon(finalStats.expectedSales)}
              icon={PiggyBank}
              tone="violet"
              hint="미정산·미입금 모두 포함"
              onClick={() => handleNavigateWithFilter()}
            />
            <KPICard
              label="총 매출"
              value={formatWon(finalStats.totalSales)}
              icon={DollarSign}
              tone="indigo"
              hint="정산 완료된 실현 매출"
              onClick={() => handleNavigateWithFilter()}
            />
            <KPICard
              label="예약"
              value={`${finalStats.activeReservations.toLocaleString()}건`}
              icon={CalendarDays}
              tone="amber"
              hint="유효 예약 건수"
              onClick={() => handleNavigateWithFilter()}
            />
            <KPICard
              label="총 방문객"
              value={`${finalStats.visitorCount.toLocaleString()}명`}
              icon={Users}
              tone="emerald"
              hint="기간 내 방문자 합계"
              onClick={() => handleNavigateWithFilter()}
            />
            <KPICard
              label="총 댕댕이"
              value={`${finalStats.dogCount.toLocaleString()}마리`}
              icon={Dog}
              tone="rose"
              hint="기간 내 반려견 동반 합계"
              onClick={() => handleNavigateWithFilter()}
            />
          </div>

          {/* Sales Breakdown Grid */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KPICard
              label="계좌이체"
              value={formatWon(finalStats.salesBreakdown.transfer)}
              icon={Wallet}
              tone="indigo"
              onClick={() => handleNavigateWithFilter('transfer')}
            />
            <KPICard
              label="현금"
              value={formatWon(finalStats.salesBreakdown.cash)}
              icon={DollarSign}
              tone="emerald"
              onClick={() => handleNavigateWithFilter('cash')}
            />
            <KPICard
              label="카드"
              value={formatWon(finalStats.salesBreakdown.card)}
              icon={CreditCard}
              tone="amber"
              onClick={() => handleNavigateWithFilter('card')}
            />
            <KPICard
              label="플레이스"
              value={formatWon(finalStats.salesBreakdown.place)}
              icon={MapPin}
              tone="cyan"
              onClick={() => handleNavigateWithFilter('place')}
            />
            <KPICard
              label="스토어"
              value={formatWon(finalStats.salesBreakdown.store)}
              icon={Store}
              tone="rose"
              onClick={() => handleNavigateWithFilter('store')}
            />
            <KPICard
              label="소셜"
              value={formatWon(finalStats.salesBreakdown.social)}
              icon={Share2}
              tone="violet"
              onClick={() => handleNavigateWithFilter('social')}
            />
          </div>

          {/* KPI Grid (Bottom) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard
              label="평균 예약 단가"
              value={formatWon(finalStats.avgPerReservation)}
              icon={ReceiptText}
              tone="violet"
              hint="예약 1건당 평균 매출"
            />
            <KPICard
              label="객단가"
              value={formatWon(finalStats.avgPerVisitor)}
              icon={Activity}
              tone="cyan"
              hint="방문객 1인당 평균 매출"
            />
            <KPICard
              label="예약금 미입금"
              value={formatWon(finalStats.unpaidDepositTotal)}
              icon={Wallet}
              tone="rose"
              hint="미입금 예약금 합계"
            />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border border-slate-200/80 bg-white rounded-xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">매출 추이</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">일별 매출 합계</p>
                </div>
                <TrendingUp className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={finalStats.chartData} onClick={(e: any) => e?.activePayload?.[0]?.payload && handleChartClick(e.activePayload[0].payload)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => formatWonShort(v as number)} />
                    <RTooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', fontSize: '12px' }}
                      formatter={(v) => [formatWon(Number(v)), '매출']}
                      labelFormatter={(label) => `${label}일`}
                    />
                    <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={36} className="cursor-pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/80 bg-white rounded-xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">요일별 매출</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">요일별 합계</p>
                </div>
                <CalendarDays className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={finalStats.weekdayChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatWonShort(v as number)} />
                    <RTooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', fontSize: '12px' }}
                      formatter={(v) => [formatWon(Number(v)), '매출']}
                    />
                    <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Operational Lists */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border border-slate-200/80 bg-white rounded-xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">오늘 픽업 일정</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">{ops?.pickups.length || 0}건</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!ops?.pickups || ops.pickups.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">예정된 픽업이 없습니다</p>
                ) : (
                  <div className="space-y-1.5">
                    {ops.pickups.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => handleReservationClick(p.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                      >
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-orange-50 border border-orange-100 shrink-0">
                          <Clock className="h-3 w-3 text-orange-500 mb-0.5" />
                          <div className="text-[11px] font-bold text-orange-700">
                            {p.pickup_time || '-'}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-900 truncate">
                            {p.customer_name}
                            {p.headcount && <span className="ml-2 text-xs font-normal text-slate-400">{p.headcount}명</span>}
                          </div>
                          <div className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {p.pickup_location}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-200/80 bg-white rounded-xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <CalendarDays className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">D-3 이내 도착 예정</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">{ops?.arrivals.length || 0}건</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!ops?.arrivals || ops.arrivals.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">예정된 예약이 없습니다</p>
                ) : (
                  <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
                    {ops.arrivals.map((a: any) => {
                      const day = getDayLabel(a.date)
                      return (
                        <button
                          key={a.id}
                          onClick={() => handleReservationClick(a.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                        >
                          <span className={cn(
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold shrink-0 w-12 justify-center",
                            day.color
                          )}>
                            {day.label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-slate-900 truncate">
                              {a.customer_name}
                              {a.headcount && <span className="ml-2 text-xs font-normal text-slate-400">{a.headcount}명</span>}
                            </div>
                            <div className="text-xs text-slate-500 truncate flex items-center gap-2 mt-0.5">
                              <span>{a.reservation_type === 'accommodation' ? '🌙 숙박' : '☀️ 당일'}</span>
                              {a.accommodations?.name && <span className="text-slate-300">·</span>}
                              {a.accommodations?.name && <span>{a.accommodations.name}</span>}
                            </div>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                            {format(new Date(a.date), "MM.dd")}
                          </span>
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {!isUnlocked && (
          <button
            type="button"
            onClick={() => setIsPinDialogOpen(true)}
            className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer transition-colors rounded-xl"
          >
            <div className="bg-white px-6 py-3 rounded-full border border-slate-200 shadow-md hover:shadow-lg transition-shadow flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-semibold text-slate-700">잠금 해제</span>
            </div>
          </button>
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
