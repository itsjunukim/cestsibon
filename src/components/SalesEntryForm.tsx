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

const formSchema = z.object({
    reservation_id: z.string().optional(),
    item_name: z.string().min(2, "Item name required"),
    amount: z.string().min(0, "Amount required"),
    category: z.enum(["ski", "room", "food", "other"]),
})

type SalesFormValues = z.infer<typeof formSchema>

interface SalesEntryFormProps {
    onSuccess?: () => void
}

export function SalesEntryForm({ onSuccess }: SalesEntryFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const queryClient = useQueryClient()
    const supabase = createClient()

    // Fetch active reservations to link sales
    const { data: reservations } = useQuery({
        queryKey: ["reservations", "active"],
        queryFn: async () => {
            const { data } = await supabase
                .from("reservations")
                .select("id, customer_name, date")
                // .eq("status", "booked") // Link to booked or any? Maybe any active.
                .in("status", ["booked", "completed"])
                .order("date", { ascending: false })
                .limit(20)
            return data || []
        }
    })

    const form = useForm<SalesFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            category: "other",
            amount: "0",
            item_name: "",
            reservation_id: "none"
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            const payload = {
                ...values,
                amount: Number(values.amount),
                reservation_id: values.reservation_id === "none" ? null : values.reservation_id
            }

            const { error } = await supabase
                .from("sales")
                .insert([payload])
                .select()

            if (error) throw error

            alert("Sale recorded!")
            queryClient.invalidateQueries({ queryKey: ["sales"] })
            onSuccess?.()
            form.reset()
        } catch (error) {
            console.error(error)
            alert("Failed to record sale")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="reservation_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>예약 연동 (선택)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="워크인 고객" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">워크인 / 없음</SelectItem>
                                    {reservations?.map((res: any) => (
                                        <SelectItem key={res.id} value={res.id}>
                                            {res.customer_name} ({res.date})
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
                    name="item_name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>항목명</FormLabel>
                            <FormControl>
                                <Input placeholder="예: 스키 강습" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>카테고리</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="카테고리 선택" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="ski">스키/수상레저</SelectItem>
                                    <SelectItem value="room">숙박</SelectItem>
                                    <SelectItem value="food">식음료</SelectItem>
                                    <SelectItem value="other">기타</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>금액 (KRW)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="50000" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    매출 등록
                </Button>
            </form>
        </Form>
    )
}
