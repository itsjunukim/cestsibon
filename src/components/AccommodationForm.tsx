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
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner" // I need to install sonner, or just use alert for now. Shadcn uses sonner usually.

// Fallback for toast if not installed
const showToast = (message: string) => {
    // In a real app we would use sonner/toast
    console.log(message)
    alert(message)
}

const formSchema = z.object({
    name: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }),
    contact: z.string().optional(),
    details: z.string().optional(),
})

interface AccommodationFormProps {
    onSuccess?: () => void
    initialData?: any
}

export function AccommodationForm({ onSuccess, initialData }: AccommodationFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const queryClient = useQueryClient()
    const supabase = createClient()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: initialData?.name || "",
            contact: initialData?.contact || "",
            details: initialData?.details || "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            const { error } = await supabase
                .from("accommodations")
                .insert([values])
                .select()

            if (error) {
                throw error
            }

            showToast("Accommodation saved successfully")
            queryClient.invalidateQueries({ queryKey: ["accommodations"] })
            onSuccess?.()
            form.reset()
        } catch (error) {
            console.error(error)
            showToast("Failed to save accommodation")
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
                            <FormLabel>숙소명</FormLabel>
                            <FormControl>
                                <Input placeholder="예: 길조호텔" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="contact"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>연락처</FormLabel>
                            <FormControl>
                                <Input placeholder="010-1234-5678" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>상세 정보</FormLabel>
                            <FormControl>
                                {/* Textarea component not installed, using Input or HTML textarea */}
                                <textarea
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="상세 내용을 입력하세요..."
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    숙소 저장
                </Button>
            </form>
        </Form>
    )
}
