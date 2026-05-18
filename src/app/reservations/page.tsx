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
import { Plus, Check, Filter, Pencil, Trash2, ArrowUpDown, Download, Columns, Search, Ban, Share2 } from "lucide-react"
import { useUserRole } from "@/hooks/useUserRole"
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
import { ko } from "date-fns/locale"
import { useSearchParams, useRouter } from "next/navigation"

import { DateRange } from "react-day-picker"
import { DateRangePicker } from "@/components/DateRangePicker"
import { formatPhone } from "@/lib/utils"

type SortConfig = {
    key: string
    direction: 'asc' | 'desc'
}

function ReservationsContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { isAdmin } = useUserRole()

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

    const [paymentFilter, setPaymentFilter] = useState<string | null>(searchParams.get('payment'))

    useEffect(() => {
        const startParam = searchParams.get('start')
        const endParam = searchParams.get('end')
        if (startParam && endParam) {
            setDateRange({ from: new Date(startParam), to: new Date(endParam) })
        }
        const paymentParam = searchParams.get('payment')
        if (paymentParam !== null) {
            setPaymentFilter(paymentParam)
        }
    }, [searchParams])

    const [searchKeyword, setSearchKeyword] = useState<string>("")

    // ?edit=id 파라미터 처리: 알림 등에서 진입 시 해당 예약을 자동으로 수정 다이얼로그로 오픈
    const editIdParam = searchParams.get('edit')
    useEffect(() => {
        if (!editIdParam) return
        const loadAndEdit = async () => {
            const client = createClient()
            const { data } = await client
                .from("reservations")
                .select("*, accommodations(name), reservation_rooms(room_id, rooms(name)), reservation_tickets(ticket_id, quantity, tickets(name))")
                .eq("id", editIdParam)
                .single()
            if (data) {
                setEditingReservation(data)
                setSelectedRowId(data.id)
                setIsDialogOpen(true)
                router.replace('/reservations', { scroll: false })
            }
        }
        loadAndEdit()
    }, [editIdParam])

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
                .select("*, accommodations(name), reservation_rooms(room_id, rooms(name)), reservation_tickets(ticket_id, quantity, tickets(name))")

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
        queryClient.invalidateQueries({ queryKey: ["deposit-alerts"] })
    }

    const handleStatusChange = async (res: any, newStatus: string) => {
        if (newStatus === res.status) return;
        if (newStatus === 'cancelled') {
            if (!confirm("정말 이 예약을 취소하시겠습니까?\n시스템에서 완전히 삭제되지 않으며 '취소됨' 상태로 보존됩니다.")) return;
        }
        await updateStatus(res.id, newStatus);
    }

    const updateVisitStatus = async (id: string, is_visited: boolean) => {
        // Optimistic UI Update
        queryClient.setQueriesData({ queryKey: ["reservations"] }, (old: any) => {
            if (!old) return old
            return old.map((res: any) => res.id === id ? { ...res, is_visited } : res)
        })

        await supabase.from("reservations").update({ is_visited }).eq("id", id)
        queryClient.invalidateQueries({ queryKey: ["reservations"] })
        queryClient.invalidateQueries({ queryKey: ["deposit-alerts"] })
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
        queryClient.invalidateQueries({ queryKey: ["deposit-alerts"] })
    }

    const updateBalanceMethod = async (id: string, balance_payment_method: string | null) => {
        // Optimistic UI Update
        queryClient.setQueriesData({ queryKey: ["reservations"] }, (old: any) => {
            if (!old) return old
            return old.map((res: any) => res.id === id ? { ...res, balance_payment_method } : res)
        })

        await supabase.from("reservations").update({ balance_payment_method }).eq("id", id)
        queryClient.invalidateQueries({ queryKey: ["reservations"] })
        queryClient.invalidateQueries({ queryKey: ["deposit-alerts"] })
    }

    const deleteReservation = async (id: string) => {
        if (!confirm("데이터가 완전히 삭제되며 복구할 수 없습니다.\n정말 '영구 삭제' 하시겠습니까?")) return
        const { error } = await supabase.from("reservations").delete().eq("id", id)
        if (error) {
            console.error(error)
            alert("삭제 실패")
        } else {
            queryClient.invalidateQueries({ queryKey: ["reservations"] })
            queryClient.invalidateQueries({ queryKey: ["deposit-alerts"] })
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
        if (searchKeyword) {
            const kw = searchKeyword.toLowerCase();
            if (!(
                res.customer_name?.toLowerCase().includes(kw) ||
                res.phone?.includes(kw) ||
                res.notes?.toLowerCase().includes(kw)
            )) {
                return false;
            }
        }
        
        if (paymentFilter) {
            const total = Number(res.total_amount) || 0
            const deposit = Number(res.deposit) || 0
            const balance = total - deposit
            const legacyMethod = res.balance_payment_method
            const splitPayments = Array.isArray(res.balance_payments) ? res.balance_payments : []

            const balanceMatchesFilter = splitPayments.length > 0
                ? splitPayments.some((p: any) => p?.method === paymentFilter && (Number(p?.amount) || 0) > 0)
                : (balance > 0 && legacyMethod === paymentFilter)

            if (paymentFilter === 'transfer') {
                if (!(deposit > 0 || balanceMatchesFilter)) return false;
            } else {
                if (!balanceMatchesFilter) return false;
            }
        }
        
        return true;
    });

    // Helper to format currency
    const fmtMoney = (amount: any) => Number(amount || 0).toLocaleString() + "원"

    const handleShareTomorrow = async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedTomorrow = format(tomorrow, "yyyy-MM-dd");
        
        try {
            // 화면의 날짜 필터와 무관하게 DB에서 내일 예약을 직접 조회
            const { data: tomorrowReservations, error } = await supabase
                .from("reservations")
                .select("*, accommodations(name), reservation_rooms(room_id, rooms(name)), reservation_tickets(ticket_id, quantity, tickets(name))")
                .eq("date", formattedTomorrow)
                .order('pickup_time', { ascending: true });

            if (error) throw error;

            const list = tomorrowReservations || [];
            const totalCount = list.length;
            const totalHeadcount = list.reduce((sum: number, res: any) => sum + (Number(res.headcount) || 0), 0);
            
            let shareText = `[📅 ${format(tomorrow, "M월 d일(E)", { locale: ko })} 예약 현황]\n`;
            shareText += `총 예약: ${totalCount}건 / 방문 예정: ${totalHeadcount}명\n\n`;

            if (totalCount === 0) {
                shareText += "내일은 예약이 없습니다.\n\n";
            } else {
                list.forEach((res: any, idx: number) => {
                    const name = res.customer_name || "이름없음";
                    const count = res.headcount ? `${res.headcount}명` : "-";
                    const typeStr = res.reservation_type === 'accommodation' ? `숙박(${res.accommodations?.name || ""})` : `당일`;
                    
                    // Get main ticket name
                    let ticketName = "";
                    if (res.reservation_tickets && res.reservation_tickets.length > 0) {
                        const firstTicket = res.reservation_tickets.find((rt: any) => rt.quantity > 0 && rt.tickets?.name);
                        if (firstTicket) {
                            ticketName = firstTicket.tickets.name;
                        }
                    }
                    
                    const ticketInfo = ticketName ? ` | ${ticketName}` : "";
                    
                    let extra = "";
                    if (res.pickup_location) extra += ` | 픽업: ${res.pickup_location}`;
                    
                    shareText += `${idx + 1}. ${name}(${count}) | ${typeStr}${ticketInfo}${extra}\n`;
                });
                shareText += `\n`;
            }

            shareText += `내일도 화이팅합시다! 🚀`;

            if (navigator.share) {
                await navigator.share({
                    title: '내일 예약 현황',
                    text: shareText,
                });
            } else {
                await navigator.clipboard.writeText(shareText);
                alert("내일 예약 내역이 클립보드에 복사되었습니다.\n원하는 곳에 붙여넣기 해주세요!");
            }
        } catch (error) {
            console.error("공유 실패:", error);
            if ((error as any).name !== 'AbortError') {
                try {
                    // Try fallback copy text if possible
                    await navigator.clipboard.writeText(`[에러] 데이터를 가져오지 못했습니다.`);
                } catch(e) {}
                alert("데이터를 가져오거나 복사하는데 실패했습니다.");
            }
        }
    }

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
                    {paymentFilter && (
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium">
                            결제 필터: {
                                paymentFilter === 'transfer' ? '계좌이체 (예약금 포함)' :
                                paymentFilter === 'cash' ? '현금' :
                                paymentFilter === 'card' ? '카드' :
                                paymentFilter === 'place' ? '플레이스' :
                                paymentFilter === 'store' ? '스토어' :
                                paymentFilter === 'social' ? '소셜' : paymentFilter
                            }
                            <button onClick={() => {
                                setPaymentFilter(null)
                                // Remove payment param from URL
                                const url = new URL(window.location.href)
                                url.searchParams.delete('payment')
                                router.replace(url.pathname + url.search)
                            }} className="ml-1 hover:text-blue-900 rounded-full p-0.5 hover:bg-blue-200/50">
                                <Ban className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
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

                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted text-blue-600" onClick={handleShareTomorrow} title="내일 예약 카톡 공유">
                            <Share2 className="h-4 w-4" />
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
                            <Button onClick={openCreateDialog} disabled={!isAdmin} className="w-full md:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                새 예약
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-5xl xl:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
                            <DialogHeader>
                                <DialogTitle>{editingReservation ? "예약 수정" : "새 예약 생성"}</DialogTitle>
                            </DialogHeader>
                            <ReservationForm
                                key={editingReservation?.id || 'new'}
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
                                            {format(new Date(res.date), "MM-dd(E)", { locale: ko })}
                                        </TableCell>
                                    )}
                                    {visibleColumns.visit && (
                                        <TableCell className="p-0 align-middle">
                                            <div className="flex justify-center items-center w-full h-full min-h-[40px]">
                                                <Checkbox
                                                    checked={res.is_visited || false}
                                                    onCheckedChange={(checked) => updateVisitStatus(res.id, !!checked)}
                                                    disabled={!isAdmin}
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
                                        <TableCell className="max-w-[120px] truncate" title={res.accommodations?.name ? `${res.accommodations.name}${res.reservation_rooms && res.reservation_rooms.length > 0 ? ` (${res.reservation_rooms.map((rr:any)=>rr.rooms?.name).join(', ')})` : ""}` : ""}>
                                            {res.accommodations?.name ? (
                                                <span className="font-medium text-indigo-600">
                                                    🏠 {res.accommodations.name}{res.reservation_rooms && res.reservation_rooms.length > 0 ? ` (${res.reservation_rooms.map((rr:any)=>rr.rooms?.name).join(', ')})` : ""}
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
                                    {visibleColumns.payment && (() => {
                                        const settled = !!res.balance_payment_method && res.balance_payment_method !== 'none'
                                        const methodLabel = res.balance_payment_method === 'transfer' ? '이체' : res.balance_payment_method === 'card' ? '카드' : res.balance_payment_method === 'cash' ? '현금' : res.balance_payment_method === 'place' ? '플레이스' : res.balance_payment_method === 'store' ? '스토어' : res.balance_payment_method === 'social' ? '소셜' : null
                                        return (
                                        <TableCell className="whitespace-nowrap">
                                            <div className={`flex flex-col space-y-1.5 text-xs p-2 rounded-md border min-w-[150px] shadow-sm ${settled ? "bg-green-50 border-green-200 border-l-[3px] border-l-green-400" : "bg-slate-50/50 border-slate-200"}`}>
                                                <div className={`flex justify-between items-center border-b pb-1.5 mb-0.5 ${settled ? "border-green-100" : "border-slate-200"}`}>
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
                                                {Number(res.balance) > 0 && (
                                                    <div className="flex justify-between items-center text-[11px] mt-0.5">
                                                        <span className={settled ? "text-slate-600 font-bold" : "text-red-600 font-bold"}>잔금</span>
                                                        <div className={`flex items-center gap-1.5 font-bold ${settled ? "text-green-700" : "text-red-700"}`}>
                                                            <span>{fmtMoney(res.balance)}</span>
                                                            {methodLabel ? (
                                                                <span className={settled
                                                                    ? "text-[10px] text-green-800 bg-green-100 px-1 rounded-sm font-bold shadow-sm"
                                                                    : "text-[10px] bg-white px-1 border border-red-200 rounded-sm text-red-700 font-bold shadow-sm"
                                                                }>
                                                                    {methodLabel}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] bg-red-100 px-1 rounded-sm text-red-600 font-bold shadow-sm">미정</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        )
                                    })()}
                                    {visibleColumns.notes && (
                                        <TableCell className="max-w-[150px] truncate text-xs text-gray-500" title={res.notes}>
                                            {res.notes || "-"}
                                        </TableCell>
                                    )}
                                    {visibleColumns.status && (
                                        <TableCell>
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <Select value={res.status} onValueChange={(val) => handleStatusChange(res, val)} disabled={!isAdmin}>
                                                    <SelectTrigger className={`h-7 px-3 py-1 border-0 rounded-full text-xs font-semibold whitespace-nowrap w-fit shadow-sm focus:ring-0 focus:ring-offset-0 ${res.status === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-200' : res.status === 'cancelled' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="booked">예약됨</SelectItem>
                                                        <SelectItem value="completed">완료</SelectItem>
                                                        <SelectItem value="cancelled">취소됨</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </TableCell>
                                    )}
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" title={isAdmin ? "수정" : "조회"} onClick={() => openEditDialog(res)} className="h-8 w-8">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            {res.status === 'cancelled' && (
                                                <Button variant="ghost" size="icon" title="영구 삭제" onClick={() => deleteReservation(res.id)} disabled={!isAdmin} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
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
                                            {format(new Date(res.date), "yyyy-MM-dd(E)", { locale: ko })} • {formatPhone(res.phone || "") || "연락처 없음"}
                                        </CardDescription>
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <Select value={res.status} onValueChange={(val) => handleStatusChange(res, val)} disabled={!isAdmin}>
                                            <SelectTrigger className={`h-7 px-3 py-1 border-0 rounded-full text-xs font-semibold whitespace-nowrap w-fit shadow-sm focus:ring-0 focus:ring-offset-0 ${res.status === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-200' : res.status === 'cancelled' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="booked">예약됨</SelectItem>
                                                <SelectItem value="completed">완료</SelectItem>
                                                <SelectItem value="cancelled">취소됨</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
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
                                        <span className="font-bold">{fmtMoney(res.total_amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs mt-1">
                                        <span className="text-foreground font-medium">예약금</span>
                                        <span className="font-medium">{fmtMoney(res.deposit)}</span>
                                    </div>
                                    {Number(res.balance) > 0 &&
                                        <div className="flex justify-between text-red-600 font-bold">
                                            <span>잔금</span>
                                            <span>{fmtMoney(res.balance)}</span>
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
                                <Button size="sm" variant="ghost" onClick={() => openEditDialog(res)}>
                                    <Pencil className="h-4 w-4 mr-1" /> {isAdmin ? "수정" : "조회"}
                                </Button>
                                {res.status === 'cancelled' && (
                                    <Button size="sm" variant="ghost" title="영구 삭제" onClick={() => deleteReservation(res.id)} disabled={!isAdmin} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
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
