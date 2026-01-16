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
import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

const formSchema = z.object({
    reservation_type: z.enum(["accommodation", "day"]),
    customer_name: z.string().min(2, "이름을 입력해주세요"),
    phone: z.string().optional(),
    date: z.date(),
    headcount: z.string().min(1, "인원을 입력해주세요"), // Changed to string to avoid z.coerce issues
    ticket_id: z.string().optional(),
    accommodation_id: z.string().optional(),
    pickup_location: z.string().optional(),
    pickup_time: z.string().optional(),
    total_amount: z.string(), // Changed to string
    deposit: z.string(), // Changed to string
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
            reservation_type: initialData?.reservation_type || "accommodation",
            status: initialData?.status || "booked",
            customer_name: initialData?.customer_name || "",
            phone: initialData?.phone || "",
            date: initialData?.date ? new Date(initialData.date) : new Date(),
            headcount: initialData?.headcount ? String(initialData.headcount) : "1",
            total_amount: initialData?.total_amount ? String(initialData.total_amount) : "0",
            deposit: initialData?.deposit ? String(initialData.deposit) : "0",
            notes: initialData?.notes || "",
            accommodation_id: initialData?.accommodation_id || "",
            ticket_id: initialData?.ticket_id || "",
            pickup_location: initialData?.pickup_location || "",
            pickup_time: initialData?.pickup_time || "",
        },
    })

    // Calculate balance automatically
    const totalAmount = Number(form.watch("total_amount") || 0)
    const deposit = Number(form.watch("deposit") || 0)
    const balance = totalAmount - deposit

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            const formattedValues = {
                ...values,
                date: format(values.date, "yyyy-MM-dd"),
                // Convert strings back to numbers for DB
                headcount: Number(values.headcount),
                total_amount: Number(values.total_amount),
                deposit: Number(values.deposit),
                balance: balance,
                // Handle optional empty strings as null if needed, but Supabase handles empty string usually fine or as text. 
                // For UUIDs (accommodation_id, ticket_id) empty string might fail if not nullable or foreign key constraint.
                accommodation_id: values.accommodation_id === "" ? null : values.accommodation_id,
                ticket_id: values.ticket_id === "" ? null : values.ticket_id,
            }

            let error;
            if (initialData?.id) {
                const { error: updateError } = await supabase
                    .from("reservations")
                    .update(formattedValues)
                    .eq("id", initialData.id)
                error = updateError
            } else {
                const { error: insertError } = await supabase
                    .from("reservations")
                    .insert([formattedValues])
                error = insertError
            }

            if (error) throw error

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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                format(field.value, "PPP")
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
                                <Input placeholder="010-0000-0000" {...field} />
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

                <FormField
                    control={form.control}
                    name="ticket_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>이용권 (선택)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="이용권 선택" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {tickets?.map((t: any) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name} ({Number(t.price).toLocaleString()}원)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>픽업 시간</FormLabel>
                            <FormControl>
                                <Input placeholder="예: 14:00" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="total_amount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>결재 금액</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="0" {...field} />
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
                            <FormLabel>예약금</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="0" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="space-y-2">
                    <FormLabel>차액 (자동 계산)</FormLabel>
                    <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50">
                        {balance.toLocaleString()} 원
                    </div>
                </div>

                <div className="col-span-full">
                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>메모</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="메모 사항 입력..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button type="submit" disabled={isLoading} className="col-span-full w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {initialData ? "수정 완료" : "예약 생성"}
                </Button>
            </form>
        </Form>
    )
}
