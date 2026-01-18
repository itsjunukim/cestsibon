"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid } from "recharts"
import { Users, DollarSign, Activity, TrendingUp, CreditCard, CalendarDays } from "lucide-react"

interface DashboardStatsProps {
    sales: number
    reservations: number
    avgSales: number
}

interface SalesChartProps {
    data: any[]
}

export function DashboardStats({ sales, reservations, avgSales }: DashboardStatsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="relative overflow-hidden border-none bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
                <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 opacity-10">
                    <DollarSign className="h-full w-full" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-indigo-100">총 매출</CardTitle>
                    <DollarSign className="h-4 w-4 text-indigo-100" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₩{sales.toLocaleString()}</div>
                    <p className="text-xs text-indigo-200 mt-1 flex items-center">
                        <TrendingUp className="mr-1 h-3 w-3" />
                        선택 기간 총 매출액
                    </p>
                </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-none bg-gradient-to-br from-orange-400 to-pink-500 text-white shadow-lg">
                <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 opacity-10">
                    <Users className="h-full w-full" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-orange-100">총 예약</CardTitle>
                    <CalendarDays className="h-4 w-4 text-orange-100" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{reservations}건</div>
                    <p className="text-xs text-orange-200 mt-1 flex items-center">
                        <Users className="mr-1 h-3 w-3" />
                        선택 기간 완료/예약됨
                    </p>
                </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-none bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg">
                <div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 opacity-10">
                    <Activity className="h-full w-full" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-emerald-100">평균 객단가</CardTitle>
                    <CreditCard className="h-4 w-4 text-emerald-100" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₩{avgSales.toLocaleString()}</div>
                    <p className="text-xs text-emerald-200 mt-1 flex items-center">
                        <Activity className="mr-1 h-3 w-3" />
                        건당 평균 결제 내역
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}

export function SalesTrendChart({ data }: SalesChartProps) {
    return (
        <Card className="col-span-4 border-none shadow-md">
            <CardHeader>
                <CardTitle>매출 추이</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="date"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `₩${value.toLocaleString()}`}
                        />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', color: '#000', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: '#000' }}
                            labelStyle={{ color: '#000', fontWeight: 'bold' }}
                            formatter={(value: any) => [`₩${Number(value || 0).toLocaleString()}`, '매출']}
                        />
                        <Area
                            type="monotone"
                            dataKey="amount"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorTotal)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
