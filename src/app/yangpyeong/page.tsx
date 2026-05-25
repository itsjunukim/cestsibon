"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, DollarSign, CalendarDays, PiggyBank, ReceiptText, Activity, Sailboat } from "lucide-react"
import { type ComponentType, type ReactNode } from "react"
import { cn } from "@/lib/utils"

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
}

function KPICard({ label, value, icon: Icon, tone, hint }: KPICardProps) {
  const c = ACCENT_CLASSES[tone]
  return (
    <Card className={cn("rounded-xl shadow-sm hover:shadow-md transition-shadow border", c.border, c.cardBg)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold text-slate-700">{label}</CardTitle>
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", c.iconBg)}>
          <Icon className={cn("h-5 w-5", c.iconText)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-bold tracking-tight tabular-nums", c.valueText)}>{value}</div>
        {hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function YangpyeongDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sailboat className="h-7 w-7 text-cyan-500" />
            양평 쎄시봉 수상레저
          </h1>
          <p className="text-sm text-slate-500 mt-1">실시간 운영 현황</p>
        </div>
      </div>

      {/* KPI Grid (가평과 동일 스타일, 데이터는 준비중) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="총 예상 매출"  value="-" icon={PiggyBank}    tone="violet"  hint="미정산·미입금 포함" />
        <KPICard label="총 매출"       value="-" icon={DollarSign}   tone="indigo"  hint="정산 완료된 실현 매출" />
        <KPICard label="예약"          value="-" icon={CalendarDays} tone="amber"   hint="유효 예약 건수" />
        <KPICard label="총 방문객"     value="-" icon={Users}        tone="emerald" hint="기간 내 방문자 합계" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KPICard label="평균 예약 단가" value="-" icon={ReceiptText} tone="violet" hint="예약 1건당 평균 매출" />
        <KPICard label="객단가"        value="-" icon={Activity}    tone="cyan"   hint="방문객 1인당 평균 매출" />
        <KPICard label="예약금 미입금" value="-" icon={PiggyBank}    tone="rose"   hint="미입금 예약금 합계" />
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-12 text-center">
        <p className="text-sm font-semibold text-slate-700 mb-1">데이터 연동 준비 중</p>
        <p className="text-xs text-slate-500">양평 수상스키 예약·매출 데이터가 연결되면 위 카드에 자동 집계됩니다.</p>
      </div>
    </div>
  )
}
