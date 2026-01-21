"use client"

import { useForm, useFieldArray } from "react-hook-form"
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
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

// Fallback for toast if not installed
const showToast = (message: string) => {
    // In a real app we would use sonner/toast
    console.log(message)
    // alert(message) // suppressing alert for smoother UX
}

const formSchema = z.object({
    name: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }),
    contact: z.string().optional(),
    details: z.string().optional(),
    rooms: z.array(z.object({
        name: z.string().min(1, "방 이름을 입력해주세요.")
    })).optional()
})

type FormValues = z.infer<typeof formSchema>

interface AccommodationFormProps {
    onSuccess?: () => void
    initialData?: any
}

export function AccommodationForm({ onSuccess, initialData }: AccommodationFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const queryClient = useQueryClient()
    const supabase = createClient()

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: initialData?.name || "",
            contact: initialData?.contact || "",
            details: initialData?.details || "",
            rooms: initialData?.rooms || [],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "rooms" as never, // casting to avoid deep path type issues with optional array
    })

    async function onSubmit(values: FormValues) {
        setIsLoading(true)
        try {
            // Separate rooms from accommodation data
            const { rooms, ...accommodationData } = values

            let accId = initialData?.id
            let error

            if (accId) {
                const { error: updateError } = await supabase
                    .from("accommodations")
                    .update(accommodationData)
                    .eq('id', accId)
                error = updateError
            } else {
                const { data, error: insertError } = await supabase
                    .from("accommodations")
                    .insert([accommodationData])
                    .select()
                    .single()

                if (data) accId = data.id
                error = insertError
            }

            if (error) {
                throw error
            }

            // Room management:
            // 1. If create mode, simply insert new rooms.
            // 2. If edit mode, we use a simple "delete all and re-insert" strategy for now to sync the state.
            //    This assumes room IDs are not critical references yet. If references exist, we'd need a smarter diff.

            if (rooms && rooms.length > 0 && accId) {
                // If editing, delete existing rooms first
                if (initialData?.id) {
                    const { error: deleteError } = await supabase
                        .from("rooms")
                        .delete()
                        .eq("accommodation_id", accId)

                    if (deleteError) {
                        console.error("Error deleting old rooms:", deleteError)
                        throw deleteError
                    }
                }

                // Insert new rooms
                const roomsToInsert = rooms.map((room: { name: string }) => ({
                    accommodation_id: accId,
                    name: room.name
                }))

                const { error: roomError } = await supabase
                    .from("rooms")
                    .insert(roomsToInsert)

                if (roomError) {
                    console.error("Error saving rooms:", roomError)
                    showToast("Warning: Accommodation saved but rooms failed to save.")
                }
            } else if (initialData?.id && (!rooms || rooms.length === 0) && accId) {
                // If editing and no rooms provided (all removed), we should clear existing rooms
                const { error: deleteError } = await supabase
                    .from("rooms")
                    .delete()
                    .eq("accommodation_id", accId)

                if (deleteError) {
                    console.error("Error deleting old rooms:", deleteError)
                }
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

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <FormLabel>방 종류 (객실 타입)</FormLabel>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({ name: "" })}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            추가
                        </Button>
                    </div>
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex gap-2">
                            <FormField
                                control={form.control}
                                name={`rooms.${index}.name`}
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input placeholder="예: 2인실, 4인실..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                className="mt-0"
                            >
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                    {fields.length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-2 border rounded-md border-dashed">
                            등록된 방 종류가 없습니다.
                        </div>
                    )}
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    숙소 저장
                </Button>
            </form>
        </Form>
    )
}
