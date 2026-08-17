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
import { Plus, Check, Filter, Pencil, Trash2, ArrowUpDown, Download, Columns, Search, Ban, Share2, ChevronLeft, ChevronRight, Bus, Copy } from "lucide-react"
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
import { useState, Suspense, useEffect, useRef, useMemo } from "react"
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

type PickupRow = { id: string; name: string; phone: string | null; people: number }
type PickupSlot = { time: string; label: string; people: number; rows: PickupRow[] }
type PickupLocation = { location: string; people: number; count: number; slots: PickupSlot[] }
type PickupDay = { date: string; people: number; count: number; locations: PickupLocation[] }

type OccupancySummary = {
    stays: { name: string; people: number; count: number }[]
    dayPeople: number
    dayCount: number
}

/**
 * 조회 기간의 숙소별 숙박 인원 + 당일 인원 요약 칩.
 * 색은 예약 유형 뱃지와 같은 규칙(숙박 인디고 / 당일 오렌지)을 그대로 쓴다.
 */
function OccupancyChips({ data, className }: { data: OccupancySummary; className?: string }) {
    if (data.stays.length === 0 && data.dayCount === 0) return null
    return (
        <div className={cn("flex items-center gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible", className)}>
            {data.stays.map((s) => (
                <span
                    key={s.name}
                    className="inline-flex shrink-0 items-baseline gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1"
                    title={`${s.name} · 숙박 ${s.count}건 ${s.people}명`}
                >
                    <span className="text-xs font-semibold text-indigo-700">🏠 {s.name}</span>
                    <span className="text-xs font-bold tabular-nums text-indigo-900">{s.people}명</span>
                    <span className="text-[10px] tabular-nums text-indigo-400">{s.count}건</span>
                </span>
            ))}
            {data.dayCount > 0 && (
                <span
                    className="inline-flex shrink-0 items-baseline gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1"
                    title={`당일 ${data.dayCount}건 ${data.dayPeople}명`}
                >
                    <span className="text-xs font-semibold text-orange-700">☀️ 당일</span>
                    <span className="text-xs font-bold tabular-nums text-orange-900">{data.dayPeople}명</span>
                    <span className="text-[10px] tabular-nums text-orange-400">{data.dayCount}건</span>
                </span>
            )}
        </div>
    )
}

function ReservationsContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { isAdmin } = useUserRole()

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isPickupOpen, setIsPickupOpen] = useState(false)
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
                router.replace('/gapyeong/reservations', { scroll: false })
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

    // 어제/내일: 현재 선택된 날짜 범위를 하루씩 이동 (범위 폭 유지)
    const shiftDays = (days: number) => {
        setDateRange(prev => {
            if (!prev?.from) {
                const target = addDays(new Date(), days)
                return { from: startOfDay(target), to: endOfDay(target) }
            }
            const from = addDays(prev.from, days)
            const to = prev.to ? addDays(prev.to, days) : from
            return { from, to }
        })
    }

    // Sorting State
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'reservation_type', direction: 'asc' })

    // Date filter mode: 'visit' = 방문일, 'created' = 등록일 (default: 방문일)
    const [dateFilterMode, setDateFilterMode] = useState<'visit' | 'created'>('visit')

    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState({
        type: true, date: true, customer: true, headcount: true, dog_count: true,
        accommodation: true, ticket: true, pickup: true,
        payment: true, notes: true, status: true, visit: true, created_at: true,
    })
    const toggleColumn = (key: keyof typeof visibleColumns) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const supabase = createClient()
    const queryClient = useQueryClient()

    // 목록에서 인라인으로 지정할 수 있는 유일한 숙소. 객실 구분이 없어 잘못 지정될 여지가 없다.
    const { data: blingAccommodation } = useQuery({
        queryKey: ["accommodation-bling"],
        queryFn: async () => {
            const { data } = await supabase
                .from("accommodations")
                .select("id, name")
                .eq("name", "블링블링")
                .maybeSingle()
            return data
        },
        staleTime: 1000 * 60 * 60,
    })
    const blingId: string | undefined = (blingAccommodation as any)?.id

    const { data: reservations, isLoading } = useQuery({
        queryKey: ["reservations", dateFilterMode, dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "all", dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "all", sortConfig],
        queryFn: async () => {
            let query = supabase
                .from("reservations")
                .select("*, accommodations(name), reservation_rooms(room_id, rooms(name)), reservation_tickets(ticket_id, quantity, tickets(name))")

            if (dateFilterMode === 'created') {
                // 등록일(created_at, timestamptz) 필터: 하루 전체 범위 포함
                if (dateRange?.from) {
                    query = query.gte("created_at", startOfDay(dateRange.from).toISOString())
                }
                if (dateRange?.to) {
                    query = query.lte("created_at", endOfDay(dateRange.to).toISOString())
                }
            } else {
                if (dateRange?.from) {
                    const fromStr = format(dateRange.from, "yyyy-MM-dd")
                    query = query.gte("date", fromStr)
                }
                if (dateRange?.to) {
                    const toStr = format(dateRange.to, "yyyy-MM-dd")
                    query = query.lte("date", toStr)
                }
            }

            // Apply Sort
            // User requested: "Under any condition... listed by accommodation, day type"
            // We ensure reservation_type is always the primary or secondary sort if needed.
            // But to support "Sorting" feature, we let the user control the primary sort.
            // However, to satisfy "1.5", we'll default to type, then date.

            if (sortConfig.key === 'reservation_type') {
                query = query
                    .order('reservation_type', { ascending: sortConfig.direction === 'asc' })
                    .order('created_at', { ascending: true })
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

    // 목록에서의 숙소 변경은 '블링블링' 또는 '없음'만 허용한다.
    // 두 값 모두 객실을 갖지 않으므로, 남아있던 객실 배정은 함께 정리한다.
    const updateAccommodation = async (id: string, accommodationId: string | null) => {
        // Optimistic UI Update
        queryClient.setQueriesData({ queryKey: ["reservations"] }, (old: any) => {
            if (!old) return old
            return old.map((res: any) => res.id === id
                ? {
                    ...res,
                    accommodation_id: accommodationId,
                    accommodations: accommodationId ? { name: "블링블링" } : null,
                    reservation_rooms: [],
                }
                : res)
        })

        await supabase.from("reservation_rooms").delete().eq("reservation_id", id)
        await supabase.from("reservations").update({ accommodation_id: accommodationId, room_id: null }).eq("id", id)
        queryClient.invalidateQueries({ queryKey: ["reservations"] })
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
                res.phone2?.includes(kw) ||
                res.notes?.toLowerCase().includes(kw)
            )) {
                return false;
            }
        }
        
        if (paymentFilter) {
            const total = Number(res.total_amount) || 0
            const deposit = Number(res.deposit) || 0
            const refund = Number(res.refund) || 0
            const balance = total - deposit + refund
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

    // 픽업 현황: 날짜 → 장소 → 시각 순으로 묶는다.
    // 같은 시각 건은 한 슬롯에 모여 합승 여부가 바로 보이고, 시각이 다른 건은 시간순으로 늘어놓아
    // 인접 시간(예: 08:50 / 09:00)을 묶을지는 운영자가 판단한다. 취소 예약은 제외한다.
    const pickupDays = useMemo<PickupDay[]>(() => {
        const dayMap = new Map<string, Map<string, Map<string, PickupRow[]>>>()

        ;(filteredReservations || [])
            .filter((res: any) => res.status !== 'cancelled' && String(res.pickup_location || "").trim())
            .forEach((res: any) => {
                const location = String(res.pickup_location).trim()
                const time = String(res.pickup_time || "").trim()

                if (!dayMap.has(res.date)) dayMap.set(res.date, new Map())
                const locationMap = dayMap.get(res.date)!
                if (!locationMap.has(location)) locationMap.set(location, new Map())
                const slotMap = locationMap.get(location)!
                if (!slotMap.has(time)) slotMap.set(time, [])

                slotMap.get(time)!.push({
                    id: res.id,
                    name: res.customer_name,
                    phone: res.phone,
                    people: Number(res.headcount) || 0,
                })
            })

        return Array.from(dayMap, ([date, locationMap]) => {
            const locations: PickupLocation[] = Array.from(locationMap, ([location, slotMap]) => {
                const slots: PickupSlot[] = Array.from(slotMap, ([time, rows]) => ({
                    time,
                    label: time || "시간 미정",
                    people: rows.reduce((acc, r) => acc + r.people, 0),
                    rows,
                })).sort((a, b) => {
                    // 시간 미정은 항상 마지막
                    if (!a.time) return 1
                    if (!b.time) return -1
                    return a.time.localeCompare(b.time)
                })
                return {
                    location,
                    slots,
                    people: slots.reduce((acc, s) => acc + s.people, 0),
                    count: slots.reduce((acc, s) => acc + s.rows.length, 0),
                }
            }).sort((a, b) => b.people - a.people)

            return {
                date,
                locations,
                people: locations.reduce((acc, l) => acc + l.people, 0),
                count: locations.reduce((acc, l) => acc + l.count, 0),
            }
        }).sort((a, b) => a.date.localeCompare(b.date))
    }, [filteredReservations])

    const pickupTotal = useMemo(() => ({
        count: pickupDays.reduce((acc, d) => acc + d.count, 0),
        people: pickupDays.reduce((acc, d) => acc + d.people, 0),
    }), [pickupDays])

    const handleCopyPickup = async () => {
        if (pickupDays.length === 0) {
            alert("복사할 픽업 일정이 없습니다.")
            return
        }
        const text = pickupDays.map((day) => {
            const head = `[🚌 ${format(new Date(day.date), "M월 d일(E)", { locale: ko })} 픽업]\n총 ${day.count}건 · ${day.people}명`
            const body = day.locations.map((loc) => {
                const lines = loc.slots.flatMap((slot) =>
                    slot.rows.map((r) => `${slot.label} ${r.name} ${r.people}명${r.phone ? ` ${formatPhone(r.phone)}` : ""}`)
                )
                return `■ ${loc.location} (${loc.people}명)\n${lines.join("\n")}`
            }).join("\n\n")
            return `${head}\n\n${body}`
        }).join("\n\n")

        try {
            await navigator.clipboard.writeText(text)
            alert("픽업 일정이 클립보드에 복사되었습니다.\n원하는 곳에 붙여넣기 해주세요!")
        } catch {
            alert("복사에 실패했습니다. 다시 시도해주세요.")
        }
    }

    // 숙소별 숙박 인원 / 당일 인원 요약. 이미 불러온 목록으로 계산하므로 추가 조회가 없다.
    // 취소된 예약은 방문자 합계와 동일하게 제외한다.
    const occupancy = useMemo<OccupancySummary>(() => {
        const byAccommodation = new Map<string, { people: number; count: number }>()
        let dayPeople = 0
        let dayCount = 0

        ;(filteredReservations || [])
            .filter((res: any) => res.status !== 'cancelled')
            .forEach((res: any) => {
                const people = Number(res.headcount) || 0
                if (res.reservation_type === 'accommodation') {
                    const name = res.accommodations?.name || "숙소 미지정"
                    const prev = byAccommodation.get(name) || { people: 0, count: 0 }
                    byAccommodation.set(name, { people: prev.people + people, count: prev.count + 1 })
                } else {
                    dayPeople += people
                    dayCount += 1
                }
            })

        return {
            stays: Array.from(byAccommodation, ([name, v]) => ({ name, ...v }))
                .sort((a, b) => b.people - a.people),
            dayPeople,
            dayCount,
        }
    }, [filteredReservations])

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
            "전화번호(예비)": formatPhone(res.phone2 || ""),
            "인원": res.headcount,
            "댕댕이": Number(res.dog_count) || 0,
            "이용권": (res.reservation_tickets || []).map((rt: any) => `${rt.tickets?.name}(${rt.quantity})`).join(", ") || "",
            "숙박": res.accommodations?.name ? `${res.accommodations.name}${res.rooms?.name ? ` (${res.rooms.name})` : ""}` : "",
            "예약금": Number(res.deposit || 0),
            "환불금": Number(res.refund || 0),
            "픽업위치": res.pickup_location || "",
            "시간": res.pickup_time || "",
            "총 결제금액": Number(res.total_amount || 0),
            "예약 등록일": res.created_at ? format(new Date(res.created_at), "yyyy-MM-dd HH:mm") : "",
        }))

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // A4 세로 출력에 맞춘 컬럼 너비
        ws['!cols'] = [
            { wch: 12 }, // 예약자명
            { wch: 16 }, // 전화번호
            { wch: 16 }, // 전화번호(예비)
            { wch: 6  }, // 인원
            { wch: 22 }, // 이용권
            { wch: 18 }, // 숙박
            { wch: 12 }, // 예약금
            { wch: 16 }, // 픽업위치
            { wch: 8  }, // 시간
            { wch: 14 }, // 총 결제금액
            { wch: 18 }, // 예약 등록일
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

                <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-3 mt-4 md:mt-0 w-full md:w-auto">
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

                    <div className="flex items-stretch gap-2 w-full md:contents">
                    <div className="flex items-center border bg-slate-100/80 rounded-md p-0.5 md:p-1 shadow-sm h-9 shrink-0" title="날짜 필터 기준">
                        <button
                            type="button"
                            onClick={() => setDateFilterMode('visit')}
                            className={cn(
                                "h-full px-2.5 md:px-3 text-xs font-semibold rounded transition-colors",
                                dateFilterMode === 'visit' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            방문일
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateFilterMode('created')}
                            className={cn(
                                "h-full px-2.5 md:px-3 text-xs font-semibold rounded transition-colors",
                                dateFilterMode === 'created' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            등록일
                        </button>
                    </div>

                    <div className="flex items-center space-x-1 border bg-slate-100/80 rounded-md p-0.5 md:p-1 shadow-sm h-9 flex-1 md:w-auto md:flex-none">
                        <Button variant="ghost" size="sm" onClick={setToday} className="flex-1 md:flex-none h-full text-xs px-1.5 md:px-2.5 font-semibold hover:bg-white text-slate-700">오늘</Button>
                        <Button variant="ghost" size="sm" onClick={setThisWeek} className="flex-1 md:flex-none h-full text-xs px-1.5 md:px-2.5 font-semibold hover:bg-white text-slate-700">이번주</Button>
                        <Button variant="ghost" size="sm" onClick={setThisMonth} className="flex-1 md:flex-none h-full text-xs px-1.5 md:px-2.5 font-semibold hover:bg-white text-slate-700">이번달</Button>
                    </div>
                    </div>

                    <div className="flex items-center gap-1.5 w-full md:w-auto">
                        <Button variant="outline" size="icon" onClick={() => shiftDays(-1)} className="h-9 w-9 shrink-0" title="어제">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <DateRangePicker
                            className="flex-1 md:flex-none"
                            date={dateRange}
                            onDateChange={setDateRange}
                        />
                        <Button variant="outline" size="icon" onClick={() => shiftDays(1)} className="h-9 w-9 shrink-0" title="내일">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex justify-end w-full md:contents">
                    <div className="flex items-center space-x-1 border bg-background rounded-md h-9 px-1 shadow-sm">
                        <Button variant="ghost" className="h-7 w-7 p-0 hover:bg-muted" onClick={() => setDateRange(undefined)} title="날짜 필터 초기화(전체 보기)">
                            <Filter className="h-4 w-4 text-foreground" />
                        </Button>

                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted text-indigo-600" onClick={() => setIsPickupOpen(true)} title="픽업 현황">
                            <Bus className="h-4 w-4" />
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
                                        type: "유형", date: "날짜", customer: "예약자", headcount: "인원", dog_count: "댕댕이",
                                        accommodation: "숙소", ticket: "이용권", pickup: "픽업",
                                        payment: "결제", notes: "메모", status: "상태", visit: "방문", created_at: "예약 등록일"
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

            {/* 픽업 현황 */}
            <Dialog open={isPickupOpen} onOpenChange={setIsPickupOpen}>
                <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Bus className="h-5 w-5 text-indigo-600" />
                            픽업 현황
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex items-center justify-between border-b pb-3">
                        <div className="text-sm">
                            {dateRange?.from && (
                                <span className="text-muted-foreground">
                                    {format(dateRange.from, "yyyy-MM-dd")}
                                    {dateRange.to && format(dateRange.to, "yyyy-MM-dd") !== format(dateRange.from, "yyyy-MM-dd")
                                        ? ` ~ ${format(dateRange.to, "yyyy-MM-dd")}`
                                        : ""}
                                </span>
                            )}
                            <span className="ml-2 font-bold text-slate-800 tabular-nums">
                                {pickupTotal.count}건 · {pickupTotal.people}명
                            </span>
                        </div>
                        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleCopyPickup} disabled={pickupDays.length === 0}>
                            <Copy className="h-3.5 w-3.5" />
                            복사
                        </Button>
                    </div>

                    {pickupDays.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">
                            이 기간에 픽업 예약이 없습니다.
                        </p>
                    ) : (
                        <div className="space-y-5 py-1">
                            {pickupDays.map((day) => (
                                <div key={day.date} className="space-y-3">
                                    {pickupDays.length > 1 && (
                                        <div className="flex items-baseline gap-2 rounded-md bg-slate-100 px-2.5 py-1.5">
                                            <span className="text-sm font-bold text-slate-800">
                                                {format(new Date(day.date), "M월 d일(E)", { locale: ko })}
                                            </span>
                                            <span className="text-xs tabular-nums text-slate-500">{day.count}건 · {day.people}명</span>
                                        </div>
                                    )}

                                    {day.locations.map((loc) => (
                                        <div key={loc.location} className="space-y-2">
                                            <div className="flex items-baseline justify-between border-b border-dashed pb-1">
                                                <span className="text-sm font-bold text-indigo-700">🚌 {loc.location}</span>
                                                <span className="text-xs font-semibold tabular-nums text-slate-500">
                                                    {loc.people}명 · {loc.count}건
                                                </span>
                                            </div>

                                            {loc.slots.map((slot) => (
                                                <div key={`${loc.location}-${slot.label}`} className="flex gap-3">
                                                    <div className={cn(
                                                        "w-16 shrink-0 pt-0.5 text-sm font-bold tabular-nums",
                                                        slot.time ? "text-slate-900" : "text-slate-400"
                                                    )}>
                                                        {slot.label}
                                                    </div>
                                                    <div className="min-w-0 flex-1 space-y-0.5">
                                                        {slot.rows.map((r) => (
                                                            <div key={r.id} className="flex items-baseline justify-between gap-2">
                                                                <span className="truncate text-sm">
                                                                    <span className="font-medium">{r.name}</span>
                                                                    <span className="ml-1 text-muted-foreground">{r.people}명</span>
                                                                </span>
                                                                {r.phone && (
                                                                    <a
                                                                        href={`tel:${r.phone}`}
                                                                        className="shrink-0 text-xs tabular-nums text-slate-500 hover:text-indigo-600 hover:underline"
                                                                    >
                                                                        {formatPhone(r.phone)}
                                                                    </a>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Desktop View */}
            <Card ref={tableRef} className="hidden md:block">
                <CardHeader>
                    <div className="flex justify-between items-center gap-4">
                        <CardTitle>예약 목록
                            {dateRange?.from && (
                                <span className="text-sm font-normal text-muted-foreground ml-2">
                                    ({dateFilterMode === 'created' ? '등록일' : '방문일'} {format(dateRange.from, "yyyy-MM-dd")} ~ {dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : ""})
                                </span>
                            )}
                        </CardTitle>
                        {(() => {
                            // 취소된 예약은 방문자·댕댕이 합계에서 제외 (영업 현황 대시보드와 동일 기준)
                            const activeForTotals = (filteredReservations || []).filter((r: any) => r.status !== 'cancelled')
                            const totalPeople = activeForTotals.reduce((acc: number, r: any) => acc + (Number(r.headcount) || 0), 0)
                            const totalDogs = activeForTotals.reduce((acc: number, r: any) => acc + (Number(r.dog_count) || 0), 0)
                            return (
                                <div className="flex justify-end gap-4">
                                    <div className="flex flex-col items-end">
                                        <span className="text-muted-foreground text-sm">방문자</span>
                                        <span className="font-bold text-slate-700 text-lg tabular-nums">{totalPeople.toLocaleString()}명</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-muted-foreground text-sm">댕댕이</span>
                                        <span className="font-bold text-slate-700 text-lg tabular-nums">{totalDogs.toLocaleString()}마리</span>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                    <OccupancyChips data={occupancy} className="mt-3" />
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
                                {visibleColumns.dog_count && <TableHead className="whitespace-nowrap">댕댕이</TableHead>}
                                {visibleColumns.accommodation && <TableHead className="whitespace-nowrap">숙소</TableHead>}
                                {visibleColumns.ticket && <TableHead className="whitespace-nowrap">이용권</TableHead>}
                                {visibleColumns.pickup && <TableHead className="whitespace-nowrap">픽업</TableHead>}
                                {visibleColumns.payment && <TableHead className="whitespace-nowrap">결제 정보</TableHead>}
                                {visibleColumns.notes && <TableHead className="whitespace-nowrap">메모</TableHead>}
                                {visibleColumns.status && <TableHead className="whitespace-nowrap">상태</TableHead>}
                                {visibleColumns.created_at && (
                                    <TableHead className="whitespace-nowrap cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('created_at')}>
                                        <div className="flex items-center gap-1">예약 등록일<ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                )}
                                <TableHead className="text-right whitespace-nowrap">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={15} className="text-center">불러오는 중...</TableCell>
                                </TableRow>
                            ) : filteredReservations?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
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
                                        selectedRowId === res.id && "bg-amber-100/80 hover:bg-amber-200 shadow-[inset_0_0_0_2px_#f59e0b] z-10 relative",
                                        // 취소된 예약: 라인 전체에 짙은 회색 레이어를 덮어 한눈에 구분 (상태 배지만 z-index로 레이어 위에 노출)
                                        res.status === 'cancelled' && "relative isolate bg-slate-300 hover:bg-slate-300 [&>td]:text-slate-500 after:absolute after:inset-0 after:z-[1] after:bg-slate-500/45 after:pointer-events-none after:content-['']"
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
                                            {res.phone2 && (
                                                <div className="text-xs text-muted-foreground font-medium mt-0.5">
                                                    <span className="text-[10px] text-slate-400 mr-1">예비</span>
                                                    {formatPhone(res.phone2)}
                                                </div>
                                            )}
                                        </TableCell>
                                    )}
                                    {visibleColumns.headcount && <TableCell>{res.headcount || 1}명</TableCell>}
                                    {visibleColumns.dog_count && <TableCell>{Number(res.dog_count) || 0}마리</TableCell>}
                                    {visibleColumns.accommodation && (() => {
                                        const roomSuffix = res.reservation_rooms && res.reservation_rooms.length > 0
                                            ? ` (${res.reservation_rooms.map((rr: any) => rr.rooms?.name).join(', ')})`
                                            : ""
                                        // 숙박 예약만 숙소를 가진다(수정 화면과 동일한 규칙). 그리고 객실이 있는 숙소는
                                        // 객실 배정이 어긋날 수 있어 목록에서 바꾸지 않고 수정 화면에서만 변경한다.
                                        const canPickInline = !!blingId
                                            && res.reservation_type === 'accommodation'
                                            && (!res.accommodation_id || res.accommodation_id === blingId)
                                        return (
                                        <TableCell className="max-w-[140px]" title={res.accommodations?.name ? `${res.accommodations.name}${roomSuffix}` : ""}>
                                            {canPickInline ? (
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <Select
                                                        value={res.accommodation_id || "none"}
                                                        onValueChange={(val) => updateAccommodation(res.id, val === "none" ? null : val)}
                                                        disabled={!isAdmin}
                                                    >
                                                        <SelectTrigger className={`h-7 w-fit gap-1 rounded-md border-0 bg-transparent px-2 text-xs font-medium shadow-none hover:bg-muted focus:ring-0 focus:ring-offset-0 ${res.accommodation_id ? "text-indigo-600" : "text-muted-foreground"}`}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value={blingId as string}>🏠 블링블링</SelectItem>
                                                            <SelectItem value="none">없음</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : res.accommodations?.name ? (
                                                <span className="block truncate font-medium text-indigo-600">
                                                    🏠 {res.accommodations.name}{roomSuffix}
                                                </span>
                                            ) : "-"}
                                        </TableCell>
                                        )
                                    })()}
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
                                        const mLabel = (m: string | null | undefined) => m === 'transfer' ? '이체' : m === 'card' ? '카드' : m === 'cash' ? '현금' : m === 'place' ? '플레이스' : m === 'store' ? '스토어' : m === 'social' ? '소셜' : null
                                        const splitPayments = Array.isArray(res.balance_payments) ? res.balance_payments.filter((p: any) => p?.method && p.method !== 'none') : []
                                        const isSplit = splitPayments.length > 0
                                        const fullyPaidByDeposit = Number(res.balance) === 0 && !!res.is_deposit_paid
                                        const settled = isSplit || (!!res.balance_payment_method && res.balance_payment_method !== 'none') || fullyPaidByDeposit
                                        // 예약금 미입금은 '아직 못 받은 돈'이라 잔금 수단이 확정(settled)됐더라도 우선해서 강조한다.
                                        // 조건은 아래 '미입금' 배지와 동일하게 맞춰, 박스 색과 배지가 어긋나지 않게 한다.
                                        const depositUnpaid = !res.is_deposit_paid && Number(res.deposit) > 0
                                        const methodLabel = isSplit
                                            ? splitPayments.map((p: any) => mLabel(p.method)).filter(Boolean).join('+')
                                            : mLabel(res.balance_payment_method)
                                        return (
                                        <TableCell className="whitespace-nowrap">
                                            <div className={cn(
                                                "flex flex-col space-y-1.5 text-xs p-2 rounded-md border min-w-[150px] shadow-sm",
                                                depositUnpaid
                                                    ? "bg-amber-50 border-amber-300 border-l-[3px] border-l-amber-500"
                                                    : settled
                                                        ? "bg-green-50 border-green-200 border-l-[3px] border-l-green-400"
                                                        : "bg-slate-50/50 border-slate-200"
                                            )}>
                                                <div className={cn(
                                                    "flex justify-between items-center border-b pb-1.5 mb-0.5",
                                                    depositUnpaid ? "border-amber-200" : settled ? "border-green-100" : "border-slate-200"
                                                )}>
                                                    <span className="text-slate-700 font-bold text-[11px]">총 결제 금액</span>
                                                    <span className="font-extrabold text-foreground text-[14px]">{fmtMoney(res.total_amount)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[11px]">
                                                    <span className="text-slate-600 font-bold">예약금</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn(
                                                            "font-bold",
                                                            res.is_deposit_paid ? "text-green-700" : depositUnpaid ? "text-amber-900" : "text-slate-800"
                                                        )}>{fmtMoney(res.deposit)}</span>
                                                        {res.is_deposit_paid && res.deposit_paid_date && (
                                                            <span className="text-[10px] text-green-800 bg-green-100 px-1 rounded-sm font-bold shadow-sm">
                                                                {format(new Date(res.deposit_paid_date), "MM/dd")} 완
                                                            </span>
                                                        )}
                                                        {depositUnpaid && (
                                                            <span className="text-[10px] text-amber-900 bg-amber-200 px-1 rounded-sm font-bold shadow-sm">미입금</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {Number(res.refund) > 0 && (
                                                    <div className="flex justify-between items-center text-[11px]">
                                                        <span className="text-slate-600 font-bold">환불금</span>
                                                        <span className="text-slate-800 font-bold">-{fmtMoney(res.refund)}</span>
                                                    </div>
                                                )}
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
                                        <TableCell className="relative z-[2]">
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
                                    {visibleColumns.created_at && (
                                        <TableCell className="whitespace-nowrap text-xs text-slate-600 tabular-nums">
                                            {res.created_at ? format(new Date(res.created_at), "yyyy-MM-dd HH:mm") : "-"}
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
                {/* 모바일 방문자/댕댕이 합계 요약 */}
                {(() => {
                    // 취소된 예약은 방문자·댕댕이 합계에서 제외 (영업 현황 대시보드와 동일 기준)
                    const activeForTotals = (filteredReservations || []).filter((r: any) => r.status !== 'cancelled')
                    const totalPeople = activeForTotals.reduce((acc: number, r: any) => acc + (Number(r.headcount) || 0), 0)
                    const totalDogs = activeForTotals.reduce((acc: number, r: any) => acc + (Number(r.dog_count) || 0), 0)
                    return (
                        <div className="rounded-lg border bg-white p-3 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-muted-foreground">
                                    예약 {(filteredReservations || []).length}건
                                </span>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xs text-muted-foreground">방문자</span>
                                        <span className="text-base font-bold text-slate-700 tabular-nums">{totalPeople.toLocaleString()}명</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xs text-muted-foreground">댕댕이</span>
                                        <span className="text-base font-bold text-slate-700 tabular-nums">{totalDogs.toLocaleString()}마리</span>
                                    </div>
                                </div>
                            </div>
                            <OccupancyChips data={occupancy} className="mt-2.5" />
                        </div>
                    )
                })()}
                {isLoading ? (
                    <div className="text-center py-8">불러오는 중...</div>
                ) : filteredReservations?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg bg-white p-4">
                        {searchKeyword ? "검색 결과가 없습니다." : "해당 기간에 예약이 없습니다."}
                    </div>
                ) : (
                    filteredReservations?.map((res: any) => (
                        <Card key={res.id} className={cn("overflow-hidden", res.status === 'cancelled' && "relative isolate border-slate-400 after:absolute after:inset-0 after:z-[1] after:bg-slate-500/40 after:pointer-events-none after:content-['']")}>
                            <div className={`h-2 w-full ${res.status === 'cancelled' ? 'bg-slate-400' : res.reservation_type === 'accommodation' ? 'bg-indigo-500' : 'bg-orange-500'}`} />
                            <CardHeader className="pb-2 pt-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            {res.customer_name}
                                            <span className="text-sm font-normal text-muted-foreground">
                                                ({res.headcount || 1}명{Number(res.dog_count) > 0 ? ` · 🐶${Number(res.dog_count)}마리` : ""})
                                            </span>
                                        </CardTitle>
                                        <CardDescription className="mt-1 text-foreground font-medium">
                                            {format(new Date(res.date), "yyyy-MM-dd(E)", { locale: ko })} • {formatPhone(res.phone || "") || "연락처 없음"}
                                            {res.phone2 && (
                                                <span className="block text-muted-foreground mt-0.5">
                                                    예비 {formatPhone(res.phone2)}
                                                </span>
                                            )}
                                        </CardDescription>
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()} className="relative z-[2]">
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
                                        <div className="flex items-center gap-1.5">
                                            {!res.is_deposit_paid && Number(res.deposit) > 0 && (
                                                <span className="text-[10px] text-amber-900 bg-amber-200 px-1 rounded-sm font-bold">미입금</span>
                                            )}
                                            <span className={cn(
                                                "font-medium",
                                                !res.is_deposit_paid && Number(res.deposit) > 0 && "text-amber-900 font-bold"
                                            )}>{fmtMoney(res.deposit)}</span>
                                        </div>
                                    </div>
                                    {Number(res.refund) > 0 &&
                                        <div className="flex justify-between text-xs">
                                            <span className="text-foreground font-medium">환불금</span>
                                            <span className="font-medium">-{fmtMoney(res.refund)}</span>
                                        </div>
                                    }
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
                            <div className="flex items-center justify-between gap-2 p-3 border-t bg-muted/20">
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    등록 {res.created_at ? format(new Date(res.created_at), "yyyy-MM-dd HH:mm") : "-"}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(res)}>
                                        <Pencil className="h-4 w-4 mr-1" /> {isAdmin ? "수정" : "조회"}
                                    </Button>
                                    {res.status === 'cancelled' && (
                                        <Button size="sm" variant="ghost" title="영구 삭제" onClick={() => deleteReservation(res.id)} disabled={!isAdmin} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
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
