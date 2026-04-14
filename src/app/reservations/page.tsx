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
import { Plus, Check, Filter, Pencil, Trash2, ArrowUpDown, Download, Columns, Search, Ban } from "lucide-react"
import * as XLSX from 'xlsx';
import { ReservationForm } from "@/components/ReservationForm"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { useState, Suspense, useEffect, useRef } from "react"
import { format, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import { useSearchParams } from "next/navigation"

import { DateRange } from "react-day-picker"
import { DateRangePicker } from "@/components/DateRangePicker"
import { formatPhone } from "@/lib/utils"

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
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
    const tableRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
                const target = event.target as Element;
                if (!target.closest('[role="dialog"]') && !target.closest('button')) {
                    setSelectedRowId(null)
                }
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Date Range State
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        const dateParam = searchParams.get('date')
        if (dateParam) {
            const d = new Date(dateParam)
            return { from: d, to: d }
        }
        const today = new Date();
        return {
            from: startOfDay(today),
            to: endOfDay(today),
        }
    })

    const [searchKeyword, setSearchKeyword] = useState<string>("")

    // Quick Date Filters
    const setToday = () => {
        const today = new Date()
        setDateRange({ from: startOfDay(today), to: endOfDay(today) })
    }

    const setThisWeek = () => {
        const today = new Date()
        setDateRange({ 
            from: startOfWeek(today, { weekStartsOn: 1 }), 
            to: endOfWeek(today, { weekStartsOn: 1 }) 
        })
    }

    const setThisMonth = () => {
        const today = new Date()
        setDateRange({ 
            from: startOfMonth(today), 
            to: endOfMonth(today) 
        })
    }

    // Sorting State
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'reservation_type', direction: 'asc' })

    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState({
        type: true, date: true, customer: true, headcount: true,
        accommodation: true, ticket: true, pickup: true,
        payment: true, notes: true, status: true, visit: true,
    })
    const toggleColumn = (key: keyof typeof visibleColumns) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const supabase = createClient()
    const queryClient = useQueryClient()

    const { data: reservations, isLoading } = useQuery({
        queryKey: ["reservations", dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "all", dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "all", sortConfig],
        queryFn: async () => {
            let query = supabase
                .from("reservations")
                .select("*, accommodations(name), rooms(name), reservation_tickets(ticket_id, quantity, tickets(name))")

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

    const updateVisitStatus = async (id: string, is_visited: boolean) => {
        // Optimistic UI Update
        queryClient.setQueriesData({ queryKey: ["reservations"] }, (old: any) => {
            if (!old) return old
            return old.map((res: any) => res.id === id ? { ...res, is_visited } : res)
        })

        await supabase.from("reservations").update({ is_visited }).eq("id", id)
        queryClient.invalidateQueries({ queryKey: ["reservations"] })
    }

    const updateDeposit = async (id: string, is_deposit_paid: boolean, deposit_paid_date: string | null) => {
        let dateToSave = deposit_paid_date;
        if (is_deposit_paid && !dateToSave) {
            dateToSave = format(new Date(), "yyyy-MM-dd")
        }
        
        // Optimistic UI Update
        queryClient.setQueriesData({ queryKey: ["reservations"] }, (old: any) => {
            if (!old) return old
            return old.map((res: any) => res.id === id ? { ...res, is_deposit_paid, deposit_paid_date: is_deposit_paid ? dateToSave : null } : res)
        })

        await supabase.from("reservations").update({ is_deposit_paid, deposit_paid_date: is_deposit_paid ? dateToSave : null }).eq("id", id)
        queryClient.invalidateQueries({ queryKey: ["reservations"] })
    }

    const updateBalanceMethod = async (id: string, balance_payment_method: string | null) => {
        // Optimistic UI Update
        queryClient.setQueriesData({ queryKey: ["reservations"] }, (old: any) => {
            if (!old) return old
            return old.map((res: any) => res.id === id ? { ...res, balance_payment_method } : res)
        })

        await supabase.from("reservations").update({ balance_payment_method }).eq("id", id)
        queryClient.invalidateQueries({ queryKey: ["reservations"] })
    }

    const deleteReservation = async (id: string, currentStatus?: string) => {
        if (currentStatus === 'cancelled') {
            if (!confirm("이미 취소된 예약입니다. 데이터가 완전히 삭제되며 복구할 수 없습니다.\n정말 '영구 삭제' 하시겠습니까?")) return
            const { error } = await supabase.from("reservations").delete().eq("id", id)
            if (error) {
                console.error(error)
                alert("삭제 실패")
            } else {
                queryClient.invalidateQueries({ queryKey: ["reservations"] })
            }
        } else {
            if (!confirm("정말 이 예약을 취소하시겠습니까?\n시스템에서 완전히 삭제되지 않으며 '취소됨' 상태로 보존됩니다.")) return
            const { error } = await supabase.from("reservations").update({ status: 'cancelled' }).eq("id", id)
            if (error) {
                console.error(error)
                alert("취소 처리 실패")
            } else {
                queryClient.invalidateQueries({ queryKey: ["reservations"] })
            }
        }
    }

    const openCreateDialog = () => {
        setEditingReservation(null)
        setIsDialogOpen(true)
    }

    const openEditDialog = (res: any) => {
        setEditingReservation(res)
        setSelectedRowId(res.id)
        setIsDialogOpen(true)
    }

    const getTypeLabel = (type: string) => {
        if (type === 'accommodation') return '숙박'
        if (type === 'day') return '당일'
        return type || '-'
    }

    // Client-side filtering
    const filteredReservations = reservations?.filter((res: any) => {
        if (!searchKeyword) return true;
        const kw = searchKeyword.toLowerCase();
        return (
            res.customer_name?.toLowerCase().includes(kw) ||
            res.phone?.includes(kw) ||
            res.notes?.toLowerCase().includes(kw)
        );
    });

    // Helper to format currency
    const fmtMoney = (amount: any) => Number(amount || 0).toLocaleString() + "원"

    const handleExportExcel = () => {
        if (!filteredReservations || filteredReservations.length === 0) {
            alert("다운로드할 데이터가 없습니다.")
            return
        }

        // Format data for Excel (A4 세로 출력 최적화 컬럼 순서)
        const excelData = filteredReservations.map((res: any) => ({
            "예약자명": res.customer_name,
            "전화번호": formatPhone(res.phone || ""),
            "인원": res.headcount,
            "이용권": (res.reservation_tickets || []).map((rt: any) => `${rt.tickets?.name}(${rt.quantity})`).join(", ") || "",
            "숙박": res.accommodations?.name ? `${res.accommodations.name}${res.rooms?.name ? ` (${res.rooms.name})` : ""}` : "",
            "예약금": Number(res.deposit || 0),
            "픽업위치": res.pickup_location || "",
            "시간": res.pickup_time || "",
            "총 결제금액": Number(res.total_amount || 0),
        }))

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // A4 세로 출력에 맞춘 컬럼 너비
        ws['!cols'] = [
            { wch: 12 }, // 예약자명
            { wch: 16 }, // 전화번호
            { wch: 6  }, // 인원
            { wch: 22 }, // 이용권
            { wch: 18 }, // 숙박
            { wch: 12 }, // 예약금
            { wch: 16 }, // 픽업위치
            { wch: 8  }, // 시간
            { wch: 14 }, // 총 결제금액
        ];

        // A4 세로 인쇄 설정
        ws['!pageSetup'] = {
            paperSize: 9,        // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
        };

        // 인쇄 여백 (인치 단위)
        ws['!margins'] = {
            left: 0.5, right: 0.5,
            top: 0.75, bottom: 0.75,
            header: 0.3, footer: 0.3,
        };

        XLSX.utils.book_append_sheet(wb, ws, "예약목록");

        // Generate file name with date range
        const fileName = `예약목록_${dateRange?.from ? format(dateRange.from, "yyyyMMdd") : "all"}${dateRange?.to ? "_" + format(dateRange.to, "yyyyMMdd") : ""}.xlsx`;

        // Download file
        XLSX.writeFile(wb, fileName);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold text-primary">
                    예약 관리
                </h1>

                <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0 w-full md:w-auto">
                    <div className="relative w-full md:w-56 lg:w-64">
                        <Search className="absolute left-2.5 top-[8.5px] h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="이름, 연락처, 메모 검색..."
                            className="pl-8 bg-white h-9 shadow-sm"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center space-x-1 border bg-slate-100/80 rounded-md p-1 shadow-sm h-9 w-full md:w-auto">
                        <Button variant="ghost" size="sm" onClick={setToday} className="flex-1 md:flex-none h-7 text-xs px-2.5 font-semibold hover:bg-white text-slate-700">오늘</Button>
                        <Button variant="ghost" size="sm" onClick={setThisWeek} className="flex-1 md:flex-none h-7 text-xs px-2.5 font-semibold hover:bg-white text-slate-700">이번주</Button>
                        <Button variant="ghost" size="sm" onClick={setThisMonth} className="flex-1 md:flex-none h-7 text-xs px-2.5 font-semibold hover:bg-white text-slate-700">이번달</Button>
                    </div>

                    <DateRangePicker
                        date={dateRange}
                        onDateChange={setDateRange}
                    />

                    <div className="flex items-center space-x-1 border bg-background rounded-md h-9 px-1 shadow-sm">
                        <Button variant="ghost" className="h-7 w-7 p-0 hover:bg-muted" onClick={() => setDateRange(undefined)} title="날짜 필터 초기화(전체 보기)">
                            <Filter className="h-4 w-4 text-foreground" />
                        </Button>

                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted" onClick={handleExportExcel} title="엑셀 저장">
                            <Download className="h-4 w-4 text-foreground" />
                        </Button>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted" title="목록 표시 설정">
                                    <Columns className="h-4 w-4 text-foreground" />
                                </Button>
                            </PopoverTrigger>
                        <PopoverContent className="w-56" align="end">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b">
                                    <h4 className="font-medium text-sm">표시할 항목</h4>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 px-2 text-xs"
                                        onClick={() => {
                                            const allChecked = Object.values(visibleColumns).every(Boolean);
                                            const newState = Object.keys(visibleColumns).reduce((acc, key) => {
                                                acc[key as keyof typeof visibleColumns] = !allChecked;
                                                return acc;
                                            }, {} as typeof visibleColumns);
                                            setVisibleColumns(newState);
                                        }}
                                    >
                                        {Object.values(visibleColumns).every(Boolean) ? "전체 해제" : "전체 선택"}
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries({
                                        type: "유형", date: "날짜", customer: "예약자", headcount: "인원", 
                                        accommodation: "숙소", ticket: "이용권", pickup: "픽업", 
                                        payment: "결제", notes: "메모", status: "상태", visit: "방문"
                                    }).map(([key, label]) => (
                                        <div key={key} className="flex items-center space-x-2">
                                            <Checkbox 
                                                id={`col-${key}`}
                                                checked={visibleColumns[key as keyof typeof visibleColumns]}
                                                onCheckedChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                                            />
                                            <label htmlFor={`col-${key}`} className="text-sm font-medium leading-none cursor-pointer">
                                                {label}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                    </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openCreateDialog} className="w-full md:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                새 예약
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-5xl xl:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
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
            <Card ref={tableRef} className="hidden md:block">
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
                                <TableHead className="whitespace-nowrap w-12 text-center">No.</TableHead>
                                {visibleColumns.type && (
                                    <TableHead className="whitespace-nowrap cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('reservation_type')}>
                                        <div className="flex items-center gap-1">유형<ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                )}
                                {visibleColumns.date && (
                                    <TableHead className="whitespace-nowrap cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('date')}>
                                        <div className="flex items-center gap-1">날짜<ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                )}
                                {visibleColumns.visit && <TableHead className="whitespace-nowrap text-center w-[60px]">방문</TableHead>}
                                {visibleColumns.customer && (
                                    <TableHead className="whitespace-nowrap cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('customer_name')}>
                                        <div className="flex items-center gap-1">예약자<ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                )}
                                {visibleColumns.headcount && <TableHead className="whitespace-nowrap">인원</TableHead>}
                                {visibleColumns.accommodation && <TableHead className="whitespace-nowrap">숙소</TableHead>}
                                {visibleColumns.ticket && <TableHead className="whitespace-nowrap">이용권</TableHead>}
                                {visibleColumns.pickup && <TableHead className="whitespace-nowrap">픽업</TableHead>}
                                {visibleColumns.payment && <TableHead className="whitespace-nowrap">결제 정보</TableHead>}
                                {visibleColumns.notes && <TableHead className="whitespace-nowrap">메모</TableHead>}
                                {visibleColumns.status && <TableHead className="whitespace-nowrap">상태</TableHead>}
                                <TableHead className="text-right whitespace-nowrap">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={13} className="text-center">불러오는 중...</TableCell>
                                </TableRow>
                            ) : filteredReservations?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                                        {searchKeyword ? "검색 결과가 없습니다." : "해당 기간에 예약이 없습니다."}
                                    </TableCell>
                                </TableRow>
                            ) : filteredReservations?.map((res: any, index: number) => (
                                <TableRow 
                                    key={res.id}
                                    onClick={(e) => {
                                        const target = e.target as HTMLElement;
                                        if (target.tagName !== 'BUTTON' && target.tagName !== 'INPUT' && !target.closest('button')) {
                                            setSelectedRowId(res.id);
                                        }
                                    }}
                                    className={cn(
                                        "text-sm transition-colors cursor-pointer", 
                                        res.is_visited && "bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40",
                                        selectedRowId === res.id && "bg-amber-100/80 hover:bg-amber-200 shadow-[inset_0_0_0_2px_#f59e0b] z-10 relative"
                                    )}
                                >
                                    <TableCell className="text-center font-medium text-muted-foreground">{index + 1}</TableCell>
                                    {visibleColumns.type && (
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${res.reservation_type === 'accommodation' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {getTypeLabel(res.reservation_type)}
                                            </span>
                                        </TableCell>
                                    )}
                                    {visibleColumns.date && (
                                        <TableCell className="whitespace-nowrap font-medium text-gray-700">
                                            {format(new Date(res.date), "MM-dd")}
                                        </TableCell>
                                    )}
                                    {visibleColumns.visit && (
                                        <TableCell className="p-0 align-middle">
                                            <div className="flex justify-center items-center w-full h-full min-h-[40px]">
                                                <Checkbox 
                                                    checked={res.is_visited || false} 
                                                    onCheckedChange={(checked) => updateVisitStatus(res.id, !!checked)}
                                                    className="h-5 w-5 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                    title={res.is_visited ? "방문 취소" : "방문 확인"}
                                                />
                                            </div>
                                        </TableCell>
                                    )}
                                    {visibleColumns.customer && (
                                        <TableCell className="whitespace-nowrap">
                                            <div className="font-semibold">{res.customer_name}</div>
                                            <div className="text-xs text-foreground font-medium mt-1">{formatPhone(res.phone || "") || "-"}</div>
                                        </TableCell>
                                    )}
                                    {visibleColumns.headcount && <TableCell>{res.headcount || 1}명</TableCell>}
                                    {visibleColumns.accommodation && (
                                        <TableCell className="whitespace-nowrap">
                                            {res.accommodations?.name ? (
                                                <span className="font-medium text-indigo-600">
                                                    🏠 {res.accommodations.name}{res.rooms?.name ? ` (${res.rooms.name})` : ""}
                                                </span>
                                            ) : "-"}
                                        </TableCell>
                                    )}
                                    {visibleColumns.ticket && (
                                        <TableCell className="max-w-[200px]">
                                            {res.reservation_tickets?.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {res.reservation_tickets.map((rt: any, idx: number) => (
                                                        <span key={idx} className="font-medium text-orange-700 text-[11px] bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 whitespace-nowrap">
                                                            🎫 {rt.tickets?.name}({rt.quantity})
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : "-"}
                                        </TableCell>
                                    )}
                                    {visibleColumns.pickup && (
                                        <TableCell className="whitespace-nowrap text-xs">
                                            {res.pickup_location || res.pickup_time ? (
                                                <div className="flex flex-col">
                                                    <span>{res.pickup_location || "-"}</span>
                                                    <span className="text-gray-500">{res.pickup_time || ""}</span>
                                                </div>
                                            ) : <span className="text-gray-300">-</span>}
                                        </TableCell>
                                    )}
                                    {visibleColumns.payment && (
                                        <TableCell className="whitespace-nowrap">
                                            <div className="flex flex-col space-y-1.5 text-xs bg-slate-50/50 p-2 rounded-md border border-slate-200 min-w-[150px] shadow-sm">
                                                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5 mb-0.5">
                                                    <span className="text-slate-700 font-bold text-[11px]">총 결제 금액</span>
                                                    <span className="font-extrabold text-foreground text-[14px]">{fmtMoney(res.total_amount)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[11px]">
                                                    <span className="text-slate-600 font-bold">예약금</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={res.is_deposit_paid ? "text-green-700 font-bold" : "text-slate-800 font-bold"}>{fmtMoney(res.deposit)}</span>
                                                        {res.is_deposit_paid && res.deposit_paid_date && (
                                                            <span className="text-[10px] text-green-800 bg-green-100 px-1 rounded-sm font-bold shadow-sm">
                                                                {format(new Date(res.deposit_paid_date), "MM/dd")} 완
                                                            </span>
                                                        )}
                                                        {!res.is_deposit_paid && Number(res.deposit) > 0 && (
                                                            <span className="text-[10px] text-amber-800 bg-amber-100 px-1 rounded-sm font-bold shadow-sm">미입금</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {Number(res.balance) > 0 &&
                                                    <div className="flex justify-between items-center text-[11px] mt-0.5">
                                                        <span className="text-red-600 font-bold">잔금</span>
                                                        <div className="flex items-center gap-1.5 text-red-700 font-bold">
                                                            <span>{fmtMoney(res.balance)}</span>
                                                            {res.balance_payment_method ? (
                                                                <span className="text-[10px] bg-white px-1 border border-red-200 rounded-sm text-red-700 font-bold shadow-sm">
                                                                    {res.balance_payment_method === 'transfer' ? '이체' : res.balance_payment_method === 'card' ? '카드' : res.balance_payment_method === 'cash' ? '현금' : '미정'}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] bg-red-100 px-1 rounded-sm text-red-600 font-bold shadow-sm">미정</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                }
                                            </div>
                                        </TableCell>
                                    )}
                                    {visibleColumns.notes && (
                                        <TableCell className="max-w-[150px] truncate text-xs text-gray-500" title={res.notes}>
                                            {res.notes || "-"}
                                        </TableCell>
                                    )}
                                    {visibleColumns.status && (
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${res.status === 'completed' ? 'bg-green-100 text-green-700' : res.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {res.status === 'booked' ? '예약됨' : res.status === 'completed' ? '완료' : res.status === 'cancelled' ? '취소됨' : res.status}
                                            </span>
                                        </TableCell>
                                    )}
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
                                            <Button variant="ghost" size="icon" title={res.status === 'cancelled' ? '영구 삭제' : '취소'} onClick={() => deleteReservation(res.id, res.status)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8">
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
                ) : filteredReservations?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg bg-white p-4">
                        {searchKeyword ? "검색 결과가 없습니다." : "해당 기간에 예약이 없습니다."}
                    </div>
                ) : (
                    filteredReservations?.map((res: any) => (
                        <Card key={res.id} className="overflow-hidden">
                            <div className={`h-2 w-full ${res.reservation_type === 'accommodation' ? 'bg-indigo-500' : 'bg-orange-500'}`} />
                            <CardHeader className="pb-2 pt-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            {res.customer_name}
                                            <span className="text-sm font-normal text-muted-foreground">({res.headcount}명)</span>
                                        </CardTitle>
                                        <CardDescription className="mt-1 text-foreground font-medium">
                                            {format(new Date(res.date), "yyyy-MM-dd")} • {formatPhone(res.phone || "") || "연락처 없음"}
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
                                            <span className="font-medium text-indigo-700">🏠 {res.accommodations.name}{res.rooms?.name ? ` (${res.rooms.name})` : ""}</span>
                                        </div>
                                    )}
                                    {res.reservation_tickets?.length > 0 && (
                                        <div className="col-span-2 flex items-start gap-2">
                                            <span className="text-muted-foreground w-12 shrink-0 pt-0.5">이용권</span>
                                            <div className="flex flex-wrap gap-1">
                                                {res.reservation_tickets.map((rt: any, idx: number) => (
                                                    <span key={idx} className="font-medium text-orange-700 text-xs bg-orange-50 px-1.5 py-0.5 rounded-sm border border-orange-100">
                                                        🎫 {rt.tickets?.name}({rt.quantity})
                                                    </span>
                                                ))}
                                            </div>
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
                                        <span className="text-foreground font-medium">총액</span>
                                        <span className="font-bold">{fmtMoney(res.total_amount)}원</span>
                                    </div>
                                    <div className="flex justify-between text-xs mt-1">
                                        <span className="text-foreground font-medium">예약금</span>
                                        <span className="font-medium">{fmtMoney(res.deposit)}원</span>
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
                                <Button size="sm" variant="ghost" title={res.status === 'cancelled' ? '영구 삭제' : '취소'} onClick={() => deleteReservation(res.id, res.status)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
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
