"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Check, Filter, Pencil, Trash2, ArrowUpDown, Download } from "lucide-react"
import * as XLSX from 'xlsx';
import { ReservationForm } from "@/components/ReservationForm"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { useState, Suspense } from "react"
import { format, addDays } from "date-fns"
import { useSearchParams } from "next/navigation"

import { DateRange } from "react-day-picker"
import { DateRangePicker } from "@/components/DateRangePicker"

type SortConfig = {
    key: string
    direction: 'asc' | 'desc'
}

function ReservationsContent() {
    const searchParams = useSearchParams()
    // ... (rest of the component logic stays same)

    // ... I need to be careful not to delete the body.
    // Replace_file_content typically replaces the chunks.
    // If I select lines 30-42, I am replacing imports and function declaration.
    // Then I need to append to the end.
    // I will do it in two chunks? No, Step 3 requires strictly sequential tools or single tool call.
    // "multi_replace_file_content" is better here.

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingReservation, setEditingReservation] = useState<any>(null)

    // Date Range State
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        const dateParam = searchParams.get('date')
        if (dateParam) {
            const d = new Date(dateParam)
            return { from: d, to: d }
        }
        return {
            from: new Date(),
            to: addDays(new Date(), 7), // Default to next 7 days
        }
    })


    // Sorting State
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'reservation_type', direction: 'asc' })

    const supabase = createClient()
    const queryClient = useQueryClient()

    const { data: reservations, isLoading } = useQuery({
        queryKey: ["reservations", dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "all", dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "all", sortConfig],
        queryFn: async () => {
            let query = supabase
                .from("reservations")
                .select("*, accommodations(name), tickets(name)")

            if (dateRange?.from) {
                const fromStr = format(dateRange.from, "yyyy-MM-dd")
                query = query.gte("date", fromStr)
            }
            if (dateRange?.to) {
                const toStr = format(dateRange.to, "yyyy-MM-dd")
                query = query.lte("date", toStr)
            }

            // Apply Sort
            // User requested: "Under any condition... listed by accommodation, day type"
            // We ensure reservation_type is always the primary or secondary sort if needed.
            // But to support "Sorting" feature, we let the user control the primary sort.
            // However, to satisfy "1.5", we'll default to type, then date.

            if (sortConfig.key === 'reservation_type') {
                query = query
                    .order('reservation_type', { ascending: sortConfig.direction === 'asc' })
                    .order('date', { ascending: true })
            } else if (sortConfig.key === 'date') {
                query = query
                    .order('date', { ascending: sortConfig.direction === 'asc' })
                    .order('reservation_type', { ascending: true })
            } else {
                query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
            }

            const { data, error } = await query

            if (error) {
                console.warn(error)
                return []
            }
            return data
        },
    })

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    // Status update function
    const updateStatus = async (id: string, status: string) => {
        await supabase.from("reservations").update({ status }).eq("id", id)
        queryClient.invalidateQueries({ queryKey: ["reservations"] })
    }

    const deleteReservation = async (id: string) => {
        if (!confirm("정말 예약을 삭제하시겠습니까?")) return
        const { error } = await supabase.from("reservations").delete().eq("id", id)
        if (error) {
            console.error(error)
            alert("삭제 실패")
        } else {
            queryClient.invalidateQueries({ queryKey: ["reservations"] })
        }
    }

    const openCreateDialog = () => {
        setEditingReservation(null)
        setIsDialogOpen(true)
    }

    const openEditDialog = (res: any) => {
        setEditingReservation(res)
        setIsDialogOpen(true)
    }

    const getTypeLabel = (type: string) => {
        if (type === 'accommodation') return '숙박'
        if (type === 'day') return '당일'
        return type || '-'
    }

    // Helper to format currency
    const fmtMoney = (amount: any) => Number(amount || 0).toLocaleString()

    const handleExportExcel = () => {
        if (!reservations || reservations.length === 0) {
            alert("다운로드할 데이터가 없습니다.")
            return
        }

        // Format data for Excel
        const excelData = reservations.map((res: any) => ({
            "유형": getTypeLabel(res.reservation_type),
            "날짜": format(new Date(res.date), "yyyy-MM-dd"),
            "예약자명": res.customer_name,
            "전화번호": res.phone || "",
            "인원": res.headcount,
            "숙소": res.accommodations?.name || "",
            "이용권": res.tickets?.name || "",
            "픽업위치": res.pickup_location || "",
            "픽업시간": res.pickup_time || "",
            "총액": Number(res.total_amount || 0),
            "예약금": Number(res.deposit || 0),
            "잔금": Number(res.balance || 0),
            "메모": res.notes || "",
            "상태": res.status === 'booked' ? '예약됨' :
                res.status === 'completed' ? '완료' :
                    res.status === 'cancelled' ? '취소됨' : res.status
        }))

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Adjust column widths (optional)
        const wscols = [
            { wch: 10 }, // 유형
            { wch: 12 }, // 날짜
            { wch: 10 }, // 예약자명
            { wch: 15 }, // 전화번호
            { wch: 6 },  // 인원
            { wch: 20 }, // 숙소
            { wch: 20 }, // 이용권
            { wch: 15 }, // 픽업위치
            { wch: 10 }, // 픽업시간
            { wch: 10 }, // 총액
            { wch: 10 }, // 예약금
            { wch: 10 }, // 잔금
            { wch: 30 }, // 메모
            { wch: 10 }, // 상태
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "예약목록");

        // Generate file name with date range
        const fileName = `예약목록_${dateRange?.from ? format(dateRange.from, "yyyyMMdd") : "all"}${dateRange?.to ? "_" + format(dateRange.to, "yyyyMMdd") : ""}.xlsx`;

        // Download file
        XLSX.writeFile(wb, fileName);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-500">
                    예약 관리
                </h1>

                <div className="flex items-center gap-2">
                    <DateRangePicker
                        date={dateRange}
                        onDateChange={setDateRange}
                    />

                    <Button variant="outline" onClick={() => setDateRange(undefined)} title="전체 보기">
                        <Filter className="h-4 w-4" />
                    </Button>

                    <Button variant="outline" onClick={handleExportExcel} title="엑셀 다운로드">
                        <Download className="h-4 w-4 mr-2" />
                        엑셀 저장
                    </Button>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openCreateDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                새 예약
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{editingReservation ? "예약 수정" : "새 예약 생성"}</DialogTitle>
                            </DialogHeader>
                            <ReservationForm
                                onSuccess={() => setIsDialogOpen(false)}
                                initialData={editingReservation}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Desktop View */}
            <Card className="hidden md:block">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>예약 목록
                            {dateRange?.from && (
                                <span className="text-sm font-normal text-muted-foreground ml-2">
                                    ({format(dateRange.from, "yyyy-MM-dd")} ~ {dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : ""})
                                </span>
                            )}
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="whitespace-nowrap cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('reservation_type')}>
                                    <div className="flex items-center gap-1">
                                        유형
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="whitespace-nowrap cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('date')}>
                                    <div className="flex items-center gap-1">
                                        날짜
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="whitespace-nowrap">예약자</TableHead>
                                <TableHead className="whitespace-nowrap">인원</TableHead>
                                <TableHead className="whitespace-nowrap">숙소</TableHead>
                                <TableHead className="whitespace-nowrap">이용권</TableHead>
                                <TableHead className="whitespace-nowrap">픽업</TableHead>
                                <TableHead className="whitespace-nowrap">결제 정보</TableHead>
                                <TableHead className="whitespace-nowrap">메모</TableHead>
                                <TableHead className="whitespace-nowrap">상태</TableHead>
                                <TableHead className="text-right whitespace-nowrap">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-center">불러오는 중...</TableCell>
                                </TableRow>
                            ) : reservations?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                                        해당 기간에 예약이 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : reservations?.map((res: any) => (
                                <TableRow key={res.id} className="text-sm">
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${res.reservation_type === 'accommodation' ? 'bg-indigo-100 text-indigo-700' :
                                            'bg-orange-100 text-orange-700'
                                            }`}>
                                            {getTypeLabel(res.reservation_type)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap font-medium text-gray-700">
                                        {format(new Date(res.date), "MM-dd")}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <div className="font-semibold">{res.customer_name}</div>
                                        <div className="text-xs text-muted-foreground">{res.phone || "-"}</div>
                                    </TableCell>
                                    <TableCell>{res.headcount || 1}명</TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {res.accommodations?.name ? (
                                            <span className="font-medium text-indigo-600">🏠 {res.accommodations.name}</span>
                                        ) : "-"}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {res.tickets?.name ? (
                                            <span className="font-medium text-orange-600">🎫 {res.tickets.name}</span>
                                        ) : "-"}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-xs">
                                        {res.pickup_location || res.pickup_time ? (
                                            <div className="flex flex-col">
                                                <span>{res.pickup_location || "-"}</span>
                                                <span className="text-gray-500">{res.pickup_time || ""}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <div className="flex flex-col space-y-1 text-xs">
                                            <div className="flex justify-between gap-2">
                                                <span className="text-muted-foreground">총액:</span>
                                                <span className="font-medium">{fmtMoney(res.total_amount)}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-muted-foreground">예약금:</span>
                                                <span>{fmtMoney(res.deposit)}</span>
                                            </div>
                                            {Number(res.balance) > 0 &&
                                                <div className="flex justify-between gap-2 text-red-600 font-bold bg-red-50 px-1 rounded">
                                                    <span>잔금:</span>
                                                    <span>{fmtMoney(res.balance)}</span>
                                                </div>
                                            }
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-[150px] truncate text-xs text-gray-500" title={res.notes}>
                                        {res.notes || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${res.status === 'completed' ? 'bg-green-100 text-green-700' :
                                            res.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {res.status === 'booked' ? '예약됨' :
                                                res.status === 'completed' ? '완료' :
                                                    res.status === 'cancelled' ? '취소됨' : res.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {res.status === 'booked' && (
                                                <Button variant="ghost" size="icon" title="완료 처리" onClick={() => updateStatus(res.id, 'completed')} className="text-green-600 hover:bg-green-50 h-8 w-8">
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" title="수정" onClick={() => openEditDialog(res)} className="h-8 w-8">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" title="삭제" onClick={() => deleteReservation(res.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {isLoading ? (
                    <div className="text-center py-8">불러오는 중...</div>
                ) : reservations?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg bg-white p-4">
                        해당 기간에 예약이 없습니다.
                    </div>
                ) : (
                    reservations?.map((res: any) => (
                        <Card key={res.id} className="overflow-hidden">
                            <div className={`h-2 w-full ${res.reservation_type === 'accommodation' ? 'bg-indigo-500' : 'bg-orange-500'}`} />
                            <CardHeader className="pb-2 pt-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            {res.customer_name}
                                            <span className="text-sm font-normal text-muted-foreground">({res.headcount}명)</span>
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            {format(new Date(res.date), "yyyy-MM-dd")} • {res.phone || "연락처 없음"}
                                        </CardDescription>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${res.status === 'completed' ? 'bg-green-100 text-green-700' :
                                        res.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {res.status === 'booked' ? '예약됨' :
                                            res.status === 'completed' ? '완료' :
                                                res.status === 'cancelled' ? '취소됨' : res.status}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm space-y-3 pb-3">
                                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg">
                                    {res.accommodations?.name && (
                                        <div className="col-span-2 flex items-center gap-2">
                                            <span className="text-muted-foreground w-12 shrink-0">숙소</span>
                                            <span className="font-medium text-indigo-700">🏠 {res.accommodations.name}</span>
                                        </div>
                                    )}
                                    {res.tickets?.name && (
                                        <div className="col-span-2 flex items-center gap-2">
                                            <span className="text-muted-foreground w-12 shrink-0">이용권</span>
                                            <span className="font-medium text-orange-700">🎫 {res.tickets.name}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground w-12 shrink-0">픽업</span>
                                        <span className="truncate">{res.pickup_location || "-"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground w-12 shrink-0">시간</span>
                                        <span>{res.pickup_time || "-"}</span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">총액</span>
                                        <span className="font-bold">{fmtMoney(res.total_amount)}원</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">예약금</span>
                                        <span>{fmtMoney(res.deposit)}원</span>
                                    </div>
                                    {Number(res.balance) > 0 &&
                                        <div className="flex justify-between text-red-600 font-bold">
                                            <span>잔금</span>
                                            <span>{fmtMoney(res.balance)}원</span>
                                        </div>
                                    }
                                </div>

                                {res.notes && (
                                    <div className="p-2 bg-yellow-50 text-yellow-800 rounded text-xs">
                                        Memo: {res.notes}
                                    </div>
                                )}
                            </CardContent>
                            <div className="flex items-center justify-end gap-2 p-3 border-t bg-muted/20">
                                {res.status === 'booked' && (
                                    <Button size="sm" variant="outline" onClick={() => updateStatus(res.id, 'completed')} className="text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50">
                                        <Check className="h-4 w-4 mr-1" /> 완료
                                    </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => openEditDialog(res)}>
                                    <Pencil className="h-4 w-4 mr-1" /> 수정
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteReservation(res.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}

export default function ReservationsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center p-8">불러오는 중...</div>}>
            <ReservationsContent />
        </Suspense>
    )
}
