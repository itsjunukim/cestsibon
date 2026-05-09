"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase"
import { useQueryClient, useQuery } from "@tanstack/react-query"
import { Loader2, Sun, Moon } from "lucide-react"
import { useUserRole } from "@/hooks/useUserRole"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect, useRef } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { CalendarIcon, X } from "lucide-react"
import { cn, formatPhone } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { ReservationAlertDialog } from "@/components/ReservationAlertDialog"

const formSchema = z.object({
    reservation_type: z.enum(["accommodation", "day"]),
    customer_name: z.string().min(2, "이름을 입력해주세요"),
    phone: z.string().optional(),
    date: z.date(),
    headcount: z.string().min(1, "인원을 입력해주세요"), // Changed to string to avoid z.coerce issues
    selected_tickets: z.array(z.object({
        ticket_id: z.string(),
        quantity: z.number().min(1)
    })).optional(),
    accommodation_id: z.string().optional(),
    selected_rooms: z.array(z.string()).optional(),
    pickup_location: z.string().optional(),
    pickup_time: z.string().optional(),
    total_amount: z.string(), // Changed to string
    deposit: z.string(), // Changed to string
    balance_payment_method: z.string().optional(),
    is_deposit_paid: z.boolean().optional(),
    deposit_paid_date: z.date().optional(),
    is_visited: z.boolean().optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
    // 숙소 정산 금액
    settlement_accommodation: z.string().optional(),
    settlement_meat: z.string().optional(),
    settlement_other: z.string().optional(),
    settlement_other_memo: z.string().optional(),
})

type ReservationFormValues = z.infer<typeof formSchema>

export interface ReservationData {
    id: string
    reservation_type?: 'accommodation' | 'day' | null
    status?: string | null
    customer_name?: string | null
    phone?: string | null
    date?: string | Date | null
    headcount?: number | string | null
    total_amount?: number | string | null
    deposit?: number | string | null
    balance_payment_method?: string | null
    is_deposit_paid?: boolean | null
    deposit_paid_date?: string | Date | null
    is_visited?: boolean | null
    notes?: string | null
    accommodation_id?: string | null
    reservation_rooms?: { room_id: string }[] | null
    reservation_tickets?: { ticket_id: string; quantity: number }[] | null
    pickup_location?: string | null
    pickup_time?: string | null
}

interface ReservationFormProps {
    onSuccess?: () => void
    initialData?: ReservationData
}

export function ReservationForm({ onSuccess, initialData }: ReservationFormProps) {
    const { isAdmin } = useUserRole()
    const [isLoading, setIsLoading] = useState(false)
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [typeSelected, setTypeSelected] = useState(!!initialData)
    const queryClient = useQueryClient()
    const supabase = createClient()

    // 숙소 정산 데이터 로드
    const { data: settlements } = useQuery({
        queryKey: ["settlements", initialData?.id],
        queryFn: async () => {
            if (!initialData?.id) return []
            const { data } = await supabase
                .from("accommodation_settlements")
                .select("*")
                .eq("reservation_id", initialData.id)
            return data || []
        },
        enabled: !!initialData?.id,
    })

    const { data: accommodations } = useQuery({
        queryKey: ["accommodations"],
        queryFn: async () => {
            const { data } = await supabase.from("accommodations").select("id, name")
            return data || []
        }
    })

    const { data: tickets } = useQuery({
        queryKey: ["tickets"],
        queryFn: async () => {
            const { data } = await supabase
                .from("tickets")
                .select("id, name, price, display_order")
                .order("display_order", { ascending: true, nullsFirst: false })
                .order("name", { ascending: true })
            return data || []
        }
    })

    const form = useForm<ReservationFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            reservation_type: initialData?.reservation_type || "day",
            status: initialData?.status || "booked",
            customer_name: initialData?.customer_name || "",
            phone: initialData?.phone || "",
            date: initialData?.date ? new Date(initialData.date) : new Date(),
            headcount: initialData?.headcount ? String(initialData.headcount) : "1",
            total_amount: initialData?.total_amount ? String(initialData.total_amount) : "0",
            deposit: initialData?.deposit ? String(initialData.deposit) : "0",
            balance_payment_method: initialData?.balance_payment_method || "",
            is_deposit_paid: initialData?.is_deposit_paid || false,
            deposit_paid_date: initialData?.deposit_paid_date ? new Date(initialData.deposit_paid_date) : undefined,
            is_visited: initialData?.is_visited || false,
            notes: initialData?.notes || "",
            accommodation_id: initialData?.accommodation_id || "",
            selected_rooms: initialData?.reservation_rooms
                ? initialData.reservation_rooms.map((rr: any) => rr.room_id)
                : [],
            selected_tickets: initialData?.reservation_tickets
                ? initialData.reservation_tickets.map((rt: any) => ({
                      ticket_id: rt.ticket_id,
                      quantity: rt.quantity
                  }))
                : [],
            pickup_location: initialData?.pickup_location || "",
            pickup_time: initialData?.pickup_time || "",
            settlement_accommodation: "",
            settlement_meat: "",
            settlement_other: "",
            settlement_other_memo: "",
        },
    })

    const selectedAccommodationId = form.watch("accommodation_id")

    const { data: allRooms } = useQuery({
        queryKey: ["all-rooms"],
        queryFn: async () => {
            const { data } = await supabase
                .from("rooms")
                .select("id, name, accommodation_id, accommodations(name)")
                .order("name")
            return data || []
        }
    })

    const filteredRooms = allRooms?.filter((r: any) => r.accommodation_id === selectedAccommodationId) || []

    // 숙소가 바뀌면 개별 room_id(단일선택용 레거시)만 초기화하고, 다중 선택 목록인 selected_rooms는 유지합니다.
    const prevAccIdRef = useRef(initialData?.accommodation_id || "");
    useEffect(() => {
        if (selectedAccommodationId === prevAccIdRef.current) {
            return;
        }
        prevAccIdRef.current = selectedAccommodationId || "";
        form.setValue("selected_rooms", []);
    }, [selectedAccommodationId, form])

    // 정산 데이터가 로드되면 폼에 반영
    useEffect(() => {
        if (settlements && settlements.length > 0) {
            settlements.forEach((s: any) => {
                const amount = s.amount ? String(s.amount) : "";
                if (s.category === 'accommodation') {
                    form.setValue('settlement_accommodation', amount);
                } else if (s.category === 'meat') {
                    form.setValue('settlement_meat', amount);
                } else if (s.category === 'other') {
                    form.setValue('settlement_other', amount);
                    form.setValue('settlement_other_memo', s.memo || "");
                }
            });
        }
    }, [settlements])

    // Calculate balance automatically
    const totalAmount = Number(String(form.watch("total_amount") || "0").replace(/[^0-9]/g, ''))
    const deposit = Number(String(form.watch("deposit") || "0").replace(/[^0-9]/g, ''))
    const balance = totalAmount - deposit

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            const { selected_tickets, selected_rooms, settlement_accommodation, settlement_meat, settlement_other, settlement_other_memo, ...reservationData } = values;

            const formattedValues = {
                ...reservationData,
                date: format(reservationData.date, "yyyy-MM-dd"),
                headcount: Number(reservationData.headcount),
                total_amount: Number(String(reservationData.total_amount).replace(/[^0-9]/g, '')),
                deposit: Number(String(reservationData.deposit).replace(/[^0-9]/g, '')),
                balance: balance,
                balance_payment_method: reservationData.balance_payment_method || null,
                is_deposit_paid: reservationData.is_deposit_paid || false,
                deposit_paid_date: reservationData.deposit_paid_date ? format(reservationData.deposit_paid_date, "yyyy-MM-dd") : null,
                is_visited: reservationData.is_visited || false,
                accommodation_id: reservationData.accommodation_id === "" ? null : reservationData.accommodation_id,
                room_id: null,
            }

            let error;
            let currentReservationId = initialData?.id;

            if (initialData?.id) {
                const { error: updateError } = await supabase
                    .from("reservations")
                    .update(formattedValues)
                    .eq("id", initialData.id)
                error = updateError;
            } else {
                const { data: insertedData, error: insertError } = await supabase
                    .from("reservations")
                    .insert([formattedValues])
                    .select("id")
                    .single()
                
                error = insertError;
                currentReservationId = insertedData?.id;
            }

            if (error) throw error;

            if (currentReservationId) {
                await supabase.from("reservation_rooms").delete().eq("reservation_id", currentReservationId);
                const validRooms = (selected_rooms || []).filter(Boolean);
                if (validRooms.length > 0) {
                    await supabase.from("reservation_rooms").insert(
                        validRooms.map(roomId => ({ reservation_id: currentReservationId, room_id: roomId }))
                    );
                }

                await supabase.from("reservation_tickets").delete().eq("reservation_id", currentReservationId);
                const validTickets = (selected_tickets || []).filter(t => t.quantity > 0);
                if (validTickets.length > 0) {
                    const ticketInserts = validTickets.map(t => ({
                        reservation_id: currentReservationId,
                        ticket_id: t.ticket_id,
                        quantity: t.quantity
                    }));
                    await supabase.from("reservation_tickets").insert(ticketInserts);
                }

                // 숙소 정산 금액 저장
                const accommodationId = formattedValues.accommodation_id;
                await supabase.from("accommodation_settlements").delete().eq("reservation_id", currentReservationId);
                const settlementInserts = [];
                const settAccAmount = Number(String(settlement_accommodation || "0").replace(/[^0-9]/g, ''));
                const settMeatAmount = Number(String(settlement_meat || "0").replace(/[^0-9]/g, ''));
                const settOtherAmount = Number(String(settlement_other || "0").replace(/[^0-9]/g, ''));

                if (settAccAmount > 0) {
                    settlementInserts.push({
                        reservation_id: currentReservationId,
                        accommodation_id: accommodationId || null,
                        category: 'accommodation',
                        amount: settAccAmount,
                    });
                }
                if (settMeatAmount > 0) {
                    settlementInserts.push({
                        reservation_id: currentReservationId,
                        accommodation_id: accommodationId || null,
                        category: 'meat',
                        amount: settMeatAmount,
                    });
                }
                if (settOtherAmount > 0) {
                    settlementInserts.push({
                        reservation_id: currentReservationId,
                        accommodation_id: accommodationId || null,
                        category: 'other',
                        amount: settOtherAmount,
                        memo: settlement_other_memo || null,
                    });
                }
                if (settlementInserts.length > 0) {
                    await supabase.from("accommodation_settlements").insert(settlementInserts);
                }
            }

            alert(initialData ? "예약이 수정되었습니다." : "예약이 생성되었습니다.")
            queryClient.invalidateQueries({ queryKey: ["reservations"] })
            queryClient.invalidateQueries({ queryKey: ["deposit-alerts"] })
            onSuccess?.()
            if (!initialData) form.reset()
        } catch (error) {
            console.error(error)
            alert("저장 실패")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
                {/* Reservation Type Selector */}
                <div className="w-full">
                    {!typeSelected ? (
                        <div className="max-w-lg mx-auto py-12">
                            <p className="text-center text-sm tracking-[0.15em] text-slate-500 mb-8">예약 유형 선택</p>
                            <div className="grid grid-cols-2 rounded-2xl overflow-hidden shadow-md">
                                <button
                                    type="button"
                                    onClick={() => { form.setValue("reservation_type", "day"); setTypeSelected(true); }}
                                    className="group flex flex-col items-center justify-center gap-5 px-8 py-20 bg-stone-50 hover:bg-amber-50 border border-r-0 border-stone-200 rounded-l-2xl transition-colors duration-300"
                                >
                                    <Sun className="h-8 w-8 text-amber-400 transition-transform duration-300 group-hover:scale-110" strokeWidth={1.5} />
                                    <div className="space-y-0.5 text-center">
                                        <p className="text-[9px] tracking-[0.2em] text-slate-400 uppercase">Day</p>
                                        <p className="text-base font-semibold tracking-wide text-slate-700">당일</p>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { form.setValue("reservation_type", "accommodation"); setTypeSelected(true); }}
                                    className="group flex flex-col items-center justify-center gap-5 px-8 py-20 bg-slate-900 hover:bg-slate-800 rounded-r-2xl transition-colors duration-300"
                                >
                                    <Moon className="h-8 w-8 text-slate-300 transition-transform duration-300 group-hover:scale-110" strokeWidth={1.5} />
                                    <div className="space-y-0.5 text-center">
                                        <p className="text-[9px] tracking-[0.2em] text-slate-500 uppercase">Night</p>
                                        <p className="text-base font-semibold tracking-wide text-white">숙박</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-start gap-6 mb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-500 shrink-0">예약 유형</span>
                                <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg gap-1">
                                    <button
                                        type="button"
                                        onClick={() => form.setValue("reservation_type", "day")}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition-all",
                                            form.watch("reservation_type") === "day"
                                                ? "bg-white shadow-sm text-orange-700 ring-1 ring-orange-100"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        <span>☀️</span>
                                        <span>당일</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => form.setValue("reservation_type", "accommodation")}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-semibold transition-all",
                                            form.watch("reservation_type") === "accommodation"
                                                ? "bg-white shadow-sm text-indigo-700 ring-1 ring-indigo-100"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        <span>🌙</span>
                                        <span>숙박</span>
                                    </button>
                                </div>
                            </div>
                            
                            {initialData?.id && (
                                <div className="flex items-center gap-4">
                                    <div className="w-px h-6 bg-slate-200"></div>
                                    <ReservationAlertDialog reservationId={initialData.id} />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 2-Column Layout */}
                {typeSelected && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch w-full">
                    {/* Left Column - Reservation Data */}
                    <div className="flex flex-col min-w-0 bg-white p-6 rounded-2xl border border-slate-300 shadow-sm shadow-slate-200/50 h-full relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-800"></div>
                        <div className="border-b border-slate-200 pb-3 mb-5 mt-1">
                            <h3 className="font-bold text-slate-900 text-[17px] flex items-center gap-2">📝 기본 예약 정보</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 content-start">
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>날짜</FormLabel>
                            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value ? (
                                                format(field.value, "PPP", { locale: ko })
                                            ) : (
                                                <span>날짜 선택</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        locale={ko}
                                        selected={field.value}
                                        onSelect={(date) => {
                                            field.onChange(date)
                                            setIsCalendarOpen(false)
                                        }}
                                        disabled={(date) =>
                                            date < new Date("1900-01-01")
                                        }
                                        modifiers={{
                                            weekend: (date) => date.getDay() === 5 || date.getDay() === 6,
                                        }}
                                        modifiersClassNames={{
                                            weekend: "text-red-500",
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="customer_name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>예약자명</FormLabel>
                            <FormControl>
                                <Input placeholder="홍길동" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>전화번호</FormLabel>
                            <FormControl>
                                <Input placeholder="010-1234-5678" {...field} onChange={(e) => field.onChange(formatPhone(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="headcount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>인원</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="pickup_location"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>픽업 위치</FormLabel>
                            <FormControl>
                                <Input placeholder="픽업 장소 입력" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="pickup_time"
                    render={({ field }) => {
                        const val = field.value || ""
                        const [hour, minute] = val.includes(":") ? val.split(":") : ["", ""]
                        return (
                            <FormItem>
                                <FormLabel>픽업 시간</FormLabel>
                                <div className="flex space-x-2">
                                    <Select 
                                        value={hour} 
                                        onValueChange={(h) => field.onChange(`${h}:${minute || "00"}`)}
                                    >
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="시" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="max-h-56">
                                            {Array.from({length: 24}).map((_, i) => {
                                                const h = i.toString().padStart(2, '0')
                                                return <SelectItem key={h} value={h}>{h}시</SelectItem>
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <Select 
                                        value={minute} 
                                        onValueChange={(m) => field.onChange(`${hour || "15"}:${m}`)}
                                    >
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="분" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="max-h-56">
                                            {["00", "10", "20", "30", "40", "50"].map((m) => (
                                                <SelectItem key={m} value={m}>{m}분</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )
                    }}
                />

                {form.watch("reservation_type") === "accommodation" && (
                <div className="col-span-full space-y-3">
                    {/* 숙소 + 방 종류 드롭다운 동일 행 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="accommodation_id"
                            render={({ field }) => (
                                <FormItem className="min-w-0">
                                    <FormLabel>숙소</FormLabel>
                                    <Select
                                        onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)}
                                        value={field.value || ""}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="h-10 bg-white">
                                                <SelectValue placeholder="숙소 선택" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__none__">선택 안함</SelectItem>
                                            {accommodations?.map((acc: any) => (
                                                <SelectItem key={acc.id} value={acc.id}>
                                                    {acc.name}
                                                </SelectItem>
                                            ))}
                                            {(!accommodations || accommodations.length === 0) && (
                                                <SelectItem value="mock-id">길조호텔 (예시)</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="min-w-0">
                            <FormLabel className="mb-2 block">방 종류</FormLabel>
                            <Select
                                disabled={!selectedAccommodationId}
                                onValueChange={(val) => {
                                    const sr = form.getValues("selected_rooms") || [];
                                    if (val && !sr.includes(val)) {
                                        form.setValue("selected_rooms", [...sr, val]);
                                    }
                                }}
                            >
                                <SelectTrigger className="h-10 w-full bg-white">
                                    <SelectValue placeholder={selectedAccommodationId ? "추가할 방을 선택하세요..." : "숙소를 먼저 선택하세요"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredRooms?.map((room: any) => {
                                        const isAdded = (form.watch("selected_rooms") || []).includes(room.id);
                                        if (isAdded) return null;
                                        return (
                                            <SelectItem key={room.id} value={room.id}>
                                                {room.name}
                                            </SelectItem>
                                        );
                                    })}
                                    {!filteredRooms?.length && <div className="text-sm text-slate-500 py-2 px-2">등록된 방이 없습니다.</div>}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* 선택된 방 카드 */}
                    {(form.watch("selected_rooms") || []).length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(form.watch("selected_rooms") || []).map((roomId: string) => {
                                const room = allRooms?.find((r: any) => r.id === roomId);
                                if (!room) return null;
                                return (
                                    <div key={roomId} className="relative flex items-center justify-between bg-white px-4 py-3 border border-slate-200 rounded-md shadow-sm border-l-4 border-l-indigo-500">
                                        <div className="font-semibold text-slate-800 text-sm">🛏 {room.name}</div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            title="삭제"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                            onClick={() => {
                                                const sr = form.getValues("selected_rooms") || [];
                                                form.setValue("selected_rooms", sr.filter(id => id !== roomId));
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                )}

                <div className="col-span-full space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <FormLabel className="mb-2 block">이용권</FormLabel>
                            <Select onValueChange={(val) => {
                                const st = form.getValues("selected_tickets") || [];
                                if (val && !st.find(s => s.ticket_id === val)) {
                                    form.setValue("selected_tickets", [...st, { ticket_id: val, quantity: 1 }]);
                                    const t = tickets?.find((x: any) => x.id === val);
                                    if (t) {
                                        const currentTotal = Number(String(form.getValues("total_amount")).replace(/[^0-9]/g, '')) || 0;
                                        form.setValue("total_amount", String(currentTotal + Number(t.price)));
                                    }
                                }
                            }}>
                                <SelectTrigger className="w-full bg-white">
                                    <SelectValue placeholder="추가할 이용권을 선택하세요..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {tickets?.map((t: any) => {
                                        const isAdded = (form.watch("selected_tickets") || []).find(s => s.ticket_id === t.id);
                                        if (isAdded) return null; // Hide already added tickets from dropdown
                                        return (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.name} ({Number(t.price).toLocaleString()}원)
                                            </SelectItem>
                                        )
                                    })}
                                    {!tickets?.length && <div className="text-sm text-slate-500 py-2 px-2">등록된 이용권이 없습니다.</div>}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Selected Tickets Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        {(form.watch("selected_tickets") || []).map((s: any) => {
                            const t = tickets?.find((x: any) => x.id === s.ticket_id);
                            if (!t) return null;
                            const currentCount = s.quantity;

                            return (
                                <div key={t.id} className="relative flex items-center justify-between bg-white px-4 py-3 border border-slate-200 rounded-md shadow-sm border-l-4 border-l-orange-500">
                                    <div className="font-semibold text-slate-800 text-sm">{t.name} <div className="text-orange-600 font-bold mt-0.5 text-xs">({Number(t.price).toLocaleString()}원)</div></div>
                                    <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-md px-1 py-1 mr-6">
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-700 hover:bg-slate-200 rounded" onClick={() => {
                                            if (currentCount > 1) { 
                                                const st = form.getValues("selected_tickets") || [];
                                                const newArr = st.map(x => x.ticket_id === t.id ? { ...x, quantity: x.quantity - 1 } : x);
                                                form.setValue("selected_tickets", newArr);
                                                const currentTotal = Number(String(form.getValues("total_amount")).replace(/[^0-9]/g, '')) || 0;
                                                form.setValue("total_amount", String(Math.max(0, currentTotal - Number(t.price))));
                                            }
                                        }}>-</Button>
                                        <span className="w-6 text-center font-extrabold text-slate-900 text-sm">{currentCount}</span>
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-700 hover:bg-slate-200 rounded" onClick={() => {
                                            const st = form.getValues("selected_tickets") || [];
                                            const newArr = st.map(x => x.ticket_id === t.id ? { ...x, quantity: x.quantity + 1 } : x);
                                            form.setValue("selected_tickets", newArr);
                                            const currentTotal = Number(String(form.getValues("total_amount")).replace(/[^0-9]/g, '')) || 0;
                                            form.setValue("total_amount", String(currentTotal + Number(t.price)));
                                        }}>+</Button>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" title="삭제" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" onClick={() => {
                                        const st = form.getValues("selected_tickets") || [];
                                        form.setValue("selected_tickets", st.filter(x => x.ticket_id !== t.id));
                                        const priceToDeduct = Number(t.price) * currentCount;
                                        const currentTotal = Number(String(form.getValues("total_amount")).replace(/[^0-9]/g, '')) || 0;
                                        form.setValue("total_amount", String(Math.max(0, currentTotal - priceToDeduct)));
                                    }}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </div>


                        </div>
                    </div>

                    {/* Right Column - Payment & Settlement */}
                    <div className="flex flex-col gap-5 min-w-0 h-full">
                        <div className="w-full bg-white border border-blue-200 shadow-sm shadow-blue-100/50 rounded-2xl p-6 flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                            <div className="border-b border-blue-100 pb-3 mb-5 mt-1">
                                <h3 className="font-bold text-blue-800 text-[17px] flex items-center gap-2">💳 결제 및 요금 정보</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 예약금 파트 */}
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="total_amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold text-slate-900 text-[14px]">총 결제 금액</FormLabel>
                                        <FormControl>
                                            <div className="relative flex items-center">
                                                <Input type="text" placeholder="0" className="bg-slate-50 font-extrabold text-slate-900 text-[18px] md:text-[18px] h-12 pr-[34px] text-right border-slate-300 shadow-sm focus-visible:ring-slate-400" {...field} onChange={(e) => {
                                                    const raw = e.target.value.replace(/[^0-9]/g, "");
                                                    field.onChange(raw ? Number(raw).toLocaleString() : "");
                                                }} value={field.value ? Number(String(field.value).replace(/[^0-9]/g, "")).toLocaleString() : ""} />
                                                <span className="absolute right-3 text-slate-800 font-extrabold pointer-events-none text-[18px] md:text-[18px]">원</span>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="deposit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold text-slate-700">예약금</FormLabel>
                                        <FormControl>
                                            <div className="relative flex items-center">
                                                <Input type="text" placeholder="0" className="bg-white pr-8 text-right" {...field} onChange={(e) => {
                                                    const raw = e.target.value.replace(/[^0-9]/g, "");
                                                    field.onChange(raw ? Number(raw).toLocaleString() : "");
                                                }} value={field.value ? Number(String(field.value).replace(/[^0-9]/g, "")).toLocaleString() : ""} />
                                                <span className="absolute right-3 text-sm text-slate-500 font-bold pointer-events-none">원</span>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <FormField
                                control={form.control}
                                name="is_deposit_paid"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border bg-white p-3 shadow-sm mt-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={(checked) => {
                                                    field.onChange(checked)
                                                    if (checked) {
                                                        form.setValue("deposit_paid_date", new Date())
                                                    } else {
                                                        form.setValue("deposit_paid_date", undefined)
                                                    }
                                                }}
                                                className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                            />
                                        </FormControl>
                                        <FormLabel className="text-sm font-bold text-slate-700 cursor-pointer w-full">예약금 입금 완료</FormLabel>
                                    </FormItem>
                                )}
                            />

                            {form.watch("is_deposit_paid") && (
                                <FormField
                                    control={form.control}
                                    name="deposit_paid_date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="text-xs font-bold text-slate-600">입금 확인일 지정</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn("w-full h-9 bg-white pl-3 text-left font-normal border-green-200 ring-offset-background", !field.value && "text-muted-foreground")}
                                                        >
                                                            {field.value ? format(field.value, "yyyy-MM-dd") : <span>날짜 선택</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50 text-green-700" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        locale={ko}
                                                        selected={field.value}
                                                        onSelect={(date) => field.onChange(date)}
                                                        modifiers={{
                                                            weekend: (date) => date.getDay() === 5 || date.getDay() === 6,
                                                        }}
                                                        modifiersClassNames={{
                                                            weekend: "text-red-500",
                                                        }}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

                        {/* 잔금 파트 */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <FormLabel className="font-bold text-red-600 text-[14px]">차액 (잔금) 자동 계산</FormLabel>
                                <div className="relative flex h-12 w-full rounded-md border border-red-200 bg-red-50 font-extrabold text-red-600 text-[18px] md:text-[18px] pl-3 items-center justify-end shadow-sm">
                                    <span className="pr-[34px] truncate">{balance.toLocaleString()}</span>
                                    <span className="absolute right-3 pointer-events-none">원</span>
                                </div>
                            </div>

                            {balance > 0 && (
                                <FormField
                                    control={form.control}
                                    name="balance_payment_method"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-slate-700">차액 결제 수단 확정</FormLabel>
                                            <Select 
                                                onValueChange={(val) => field.onChange(val === "none" ? undefined : val)} 
                                                defaultValue={field.value || "none"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-10 bg-white shadow-sm">
                                                        <SelectValue placeholder="결제 수단 선택" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">미정 (현장결제 혹은 추후)</SelectItem>
                                                    <SelectItem value="transfer">계좌이체</SelectItem>
                                                    <SelectItem value="card">카드 결제</SelectItem>
                                                    <SelectItem value="cash">현금 결제</SelectItem>
                                                    <SelectItem value="place">플레이스 결제</SelectItem>
                                                    <SelectItem value="store">스토어 결제</SelectItem>
                                                    <SelectItem value="social">소셜 결제</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex justify-center pt-4 border-t border-slate-200/80 mt-6">
                        <div className="grid grid-cols-3 gap-2">
                            {([1, -1] as const).flatMap((sign) =>
                                ([
                                    [1000, 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300'],
                                    [5000, 'text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-300'],
                                    [10000, 'text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300'],
                                ] as const).map(([amount, color]) => {
                                    const delta = amount * sign
                                    return (
                                        <Button
                                            key={delta}
                                            type="button"
                                            variant="outline"
                                            className={cn(
                                                "h-10 px-0 text-sm font-bold bg-white w-24 shadow-sm",
                                                color
                                            )}
                                            onClick={() => {
                                                const current = Number(form.getValues('total_amount')) || 0
                                                form.setValue('total_amount', String(Math.max(0, current + delta)))
                                            }}
                                        >
                                            {sign > 0 ? '+' : '-'}{amount.toLocaleString()}원
                                        </Button>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* 숙소 정산 금액 섹션 - 숙박 예약인 경우만 노출 */}
                {form.watch("reservation_type") === "accommodation" && (
                <div className="w-full bg-white border border-indigo-200 shadow-sm shadow-indigo-100/50 rounded-2xl p-6 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                    <div className="flex justify-between items-end border-b border-indigo-100 pb-3 mb-5 mt-1">
                        <h3 className="font-bold text-indigo-800 text-[17px] flex items-center gap-2">🏠 숙소 정산 금액</h3>
                        <span className="text-xs text-indigo-500 font-medium">숙소에 정산할 금액을 입력하세요</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 숙소 정산 */}
                        <FormField
                            control={form.control}
                            name="settlement_accommodation"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold text-slate-700 text-sm">숙소</FormLabel>
                                    <FormControl>
                                        <div className="relative flex items-center">
                                            <Input type="text" placeholder="0" className="bg-white pr-8 text-right font-bold" {...field} onChange={(e) => {
                                                const raw = e.target.value.replace(/[^0-9]/g, "");
                                                field.onChange(raw ? Number(raw).toLocaleString() : "");
                                            }} value={field.value ? Number(String(field.value).replace(/[^0-9]/g, "")).toLocaleString() : ""} />
                                            <span className="absolute right-3 text-sm text-slate-500 font-bold pointer-events-none">원</span>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 고기 정산 */}
                        <FormField
                            control={form.control}
                            name="settlement_meat"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold text-slate-700 text-sm">고기</FormLabel>
                                    <FormControl>
                                        <div className="relative flex items-center">
                                            <Input type="text" placeholder="0" className="bg-white pr-8 text-right font-bold" {...field} onChange={(e) => {
                                                const raw = e.target.value.replace(/[^0-9]/g, "");
                                                field.onChange(raw ? Number(raw).toLocaleString() : "");
                                            }} value={field.value ? Number(String(field.value).replace(/[^0-9]/g, "")).toLocaleString() : ""} />
                                            <span className="absolute right-3 text-sm text-slate-500 font-bold pointer-events-none">원</span>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 기타 정산 */}
                        <FormField
                            control={form.control}
                            name="settlement_other"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold text-slate-700 text-sm">기타</FormLabel>
                                    <FormControl>
                                        <div className="relative flex items-center">
                                            <Input type="text" placeholder="0" className="bg-white pr-8 text-right font-bold" {...field} onChange={(e) => {
                                                const raw = e.target.value.replace(/[^0-9]/g, "");
                                                field.onChange(raw ? Number(raw).toLocaleString() : "");
                                            }} value={field.value ? Number(String(field.value).replace(/[^0-9]/g, "")).toLocaleString() : ""} />
                                            <span className="absolute right-3 text-sm text-slate-500 font-bold pointer-events-none">원</span>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* 기타 사유 메모 - 기타 금액이 입력된 경우에만 노출 */}
                    {Number(String(form.watch("settlement_other") || "0").replace(/[^0-9]/g, '')) > 0 && (
                        <div className="mt-4">
                            <FormField
                                control={form.control}
                                name="settlement_other_memo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold text-slate-600 text-xs">기타 정산 사유</FormLabel>
                                        <FormControl>
                                            <Input placeholder="정산 사유를 간단히 입력하세요" className="bg-white text-sm" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}

                    {/* 정산 합계 */}
                    <div className="flex justify-end items-center pt-4 mt-6 border-t border-indigo-200">
                        <span className="text-sm font-bold text-slate-600 mr-3">정산 합계</span>
                        <span className="text-lg font-extrabold text-indigo-700">
                            {(() => {
                                const a = Number(String(form.watch("settlement_accommodation") || "0").replace(/[^0-9]/g, ''));
                                const m = Number(String(form.watch("settlement_meat") || "0").replace(/[^0-9]/g, ''));
                                const o = Number(String(form.watch("settlement_other") || "0").replace(/[^0-9]/g, ''));
                                return (a + m + o).toLocaleString();
                            })()}
                            <span className="text-sm ml-1">원</span>
                        </span>
                    </div>
                </div>
                )}

                {/* Bottom Section - Memo & Submit */}
                <div className="w-full flex flex-col flex-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="border-b border-slate-100 pb-3 mb-5">
                        <h3 className="font-bold text-slate-800 text-[17px] flex items-center gap-2">🗒️ 메모</h3>
                    </div>
                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem className="w-full flex-1 flex flex-col">
                                <FormControl className="flex-1">
                                    <Textarea 
                                        className="resize-none h-full min-h-[120px] bg-slate-50 text-base shadow-inner border-slate-200 focus-visible:ring-indigo-500 p-4 rounded-xl" 
                                        placeholder="메모 사항 입력..." 
                                        {...field} 
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                    </div>
                </div>
                )}

                {/* Submit Button Centered */}
                {typeSelected && (
                    <div className="flex justify-center w-full mt-4">
                        <Button type="submit" disabled={!isAdmin || isLoading} className="w-full md:w-1/3 h-14 text-[18px] font-bold shadow-md hover:shadow-lg transition-all bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                            {initialData ? "예약 정보 수정" : "새 예약 저장"}
                        </Button>
                    </div>
                )}
            </form>
        </Form>
    )
}
