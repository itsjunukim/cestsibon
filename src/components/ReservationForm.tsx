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
import { Loader2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { CalendarIcon, X } from "lucide-react"
import { cn, formatPhone } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

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
})

type ReservationFormValues = z.infer<typeof formSchema>

interface ReservationFormProps {
    onSuccess?: () => void
    initialData?: any
}

export function ReservationForm({ onSuccess, initialData }: ReservationFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isCalendarOpen, setIsCalendarOpen] = useState(false) // State for Calendar Popover
    const queryClient = useQueryClient()
    const supabase = createClient()

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
            const { data } = await supabase.from("tickets").select("id, name, price")
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
            selected_tickets: initialData?.reservation_tickets 
                ? initialData.reservation_tickets.map((rt: any) => ({
                      ticket_id: rt.ticket_id,
                      quantity: rt.quantity
                  }))
                : [],
            pickup_location: initialData?.pickup_location || "",
            pickup_time: initialData?.pickup_time || "",
        },
    })

    // Calculate balance automatically
    const totalAmount = Number(String(form.watch("total_amount") || "0").replace(/[^0-9]/g, ''))
    const deposit = Number(String(form.watch("deposit") || "0").replace(/[^0-9]/g, ''))
    const balance = totalAmount - deposit

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            const { selected_tickets, ...reservationData } = values;

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
            }

            alert(initialData ? "예약이 수정되었습니다." : "예약이 생성되었습니다.")
            queryClient.invalidateQueries({ queryKey: ["reservations"] })
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1.5fr_1fr] gap-8 w-full">
                {/* Left Column - Reservation Data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
                    <div className="col-span-full">
                    <FormField
                        control={form.control}
                        name="reservation_type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>예약 유형</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="유형 선택" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="accommodation">숙박</SelectItem>
                                        <SelectItem value="day">당일</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

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
                    name="accommodation_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>숙소 (선택)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="숙소 선택" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
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

                <div className="col-span-full space-y-4">
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
                            <SelectTrigger className="w-full md:w-1/2 bg-white">
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

                <div className="col-span-full border border-slate-200 bg-slate-50/50 rounded-md p-5 space-y-6 shadow-sm mt-4">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                        <span className="text-slate-700 font-extrabold text-base">결제 및 요금 정보</span>
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
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex justify-center pt-4 border-t border-slate-200/80 mt-2">
                        <div className="grid grid-cols-3 gap-2">
                            {/* Plus Row */}
                            <Button type="button" variant="outline" className="h-10 px-0 text-sm font-bold bg-white text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300 w-24 shadow-sm" onClick={() => {
                                const current = Number(form.getValues('total_amount')) || 0;
                                form.setValue('total_amount', String(current + 1000));
                            }}>+1,000원</Button>
                            <Button type="button" variant="outline" className="h-10 px-0 text-sm font-bold bg-white text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-300 w-24 shadow-sm" onClick={() => {
                                const current = Number(form.getValues('total_amount')) || 0;
                                form.setValue('total_amount', String(current + 5000));
                            }}>+5,000원</Button>
                            <Button type="button" variant="outline" className="h-10 px-0 text-sm font-bold bg-white text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300 w-24 shadow-sm" onClick={() => {
                                const current = Number(form.getValues('total_amount')) || 0;
                                form.setValue('total_amount', String(current + 10000));
                            }}>+10,000원</Button>
                            
                            {/* Minus Row */}
                            <Button type="button" variant="outline" className="h-10 px-0 text-sm font-bold bg-white text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300 w-24 shadow-sm" onClick={() => {
                                const current = Number(form.getValues('total_amount')) || 0;
                                form.setValue('total_amount', String(Math.max(0, current - 1000)));
                            }}>-1,000원</Button>
                            <Button type="button" variant="outline" className="h-10 px-0 text-sm font-bold bg-white text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-300 w-24 shadow-sm" onClick={() => {
                                const current = Number(form.getValues('total_amount')) || 0;
                                form.setValue('total_amount', String(Math.max(0, current - 5000)));
                            }}>-5,000원</Button>
                            <Button type="button" variant="outline" className="h-10 px-0 text-sm font-bold bg-white text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300 w-24 shadow-sm" onClick={() => {
                                const current = Number(form.getValues('total_amount')) || 0;
                                form.setValue('total_amount', String(Math.max(0, current - 10000)));
                            }}>-10,000원</Button>
                        </div>
                    </div>
                </div>
                </div> {/* End Left Column */}

                {/* Right Column - Notes & Submit */}
                <div className="flex flex-col h-full bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-sm lg:sticky top-0">
                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem className="flex-1 flex flex-col mb-8">
                                <FormLabel className="font-bold text-slate-800 text-base mb-2">메모</FormLabel>
                                <FormControl className="flex-1 min-h-[300px]">
                                    <Textarea 
                                        className="resize-none h-full bg-white text-base shadow-inner border-slate-300 focus-visible:ring-indigo-500 p-4" 
                                        placeholder="메모 사항 입력..." 
                                        {...field} 
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button type="submit" disabled={isLoading} className="w-full h-14 text-[18px] font-bold shadow-md hover:shadow-lg transition-all bg-indigo-600 hover:bg-indigo-700 text-white mt-auto">
                        {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                        {initialData ? "예약 정보 수정" : "새 예약 저장"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
