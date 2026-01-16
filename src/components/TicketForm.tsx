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
import { createClient } from "@/lib/supabase"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"

const formSchema = z.object({
    name: z.string().min(2, "이용권 이름을 입력해주세요"),
    price: z.string().min(0, "가격을 입력해주세요"),
})

interface TicketFormProps {
    onSuccess?: () => void
    initialData?: any
}

export function TicketForm({ onSuccess, initialData }: TicketFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const queryClient = useQueryClient()
    const supabase = createClient()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: initialData?.name || "",
            price: initialData?.price ? String(initialData.price) : "0",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            const formattedValues = {
                ...values,
                price: Number(values.price)
            }

            let error;
            if (initialData?.id) {
                // Update
                const { error: updateError } = await supabase
                    .from("tickets")
                    .update(formattedValues)
                    .eq("id", initialData.id)
                error = updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from("tickets")
                    .insert([formattedValues])
                error = insertError;
            }

            if (error) throw error

            alert(initialData ? "이용권이 수정되었습니다." : "이용권이 저장되었습니다.")
            queryClient.invalidateQueries({ queryKey: ["tickets"] })
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>이용권 명칭</FormLabel>
                            <FormControl>
                                <Input placeholder="예: 종일권, 오전권 등" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>가격 (KRW)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="50000" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {initialData ? "수정 완료" : "이용권 저장"}
                </Button>
            </form>
        </Form>
    )
}
