"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BellPlus, Trash2, Loader2, CalendarClock, CalendarIcon } from "lucide-react"
import { useUserRole } from "@/hooks/useUserRole"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface Alert {
    id: string
    scheduled_at: string
    message: string
    is_dismissed: boolean
    created_at: string
}

interface ReservationAlertDialogProps {
    reservationId: string
}

export function ReservationAlertDialog({ reservationId }: ReservationAlertDialogProps) {
    const { isAdmin } = useUserRole()
    const supabase = createClient()
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
    const [selectedHour, setSelectedHour] = useState("9")
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [message, setMessage] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    const { data: alerts, refetch } = useQuery<Alert[]>({
        queryKey: ["reservation-alerts", reservationId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("reservation_alerts")
                .select("id, scheduled_at, message, is_dismissed, created_at")
                .eq("reservation_id", reservationId)
                .order("scheduled_at", { ascending: true })
            if (error) {
                console.error(error)
                return []
            }
            return data || []
        },
        enabled: open && !!reservationId,
    })

    const buildScheduledAt = (): Date | null => {
        if (!selectedDate) return null
        const hh = Number(selectedHour)
        if (Number.isNaN(hh)) return null
        const dt = new Date(selectedDate)
        dt.setHours(hh, 0, 0, 0)
        return dt
    }

    const handleSave = async () => {
        const scheduledAt = buildScheduledAt()
        if (!scheduledAt || !message.trim()) return
        setIsSaving(true)
        const { error } = await supabase.from("reservation_alerts").insert({
            reservation_id: reservationId,
            scheduled_at: scheduledAt.toISOString(),
            message: message.trim(),
        })
        setIsSaving(false)
        if (error) {
            console.error(error)
            alert("알림 저장 실패: " + error.message)
            return
        }
        setSelectedDate(undefined)
        setSelectedHour("9")
        setMessage("")
        refetch()
        queryClient.invalidateQueries({ queryKey: ["custom-alerts"] })
    }

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from("reservation_alerts").delete().eq("id", id)
        if (error) {
            console.error(error)
            return
        }
        refetch()
        queryClient.invalidateQueries({ queryKey: ["custom-alerts"] })
    }

    const activeCount = alerts?.filter((a) => !a.is_dismissed).length || 0
    const canSave = !!selectedDate && !!message.trim() && !isSaving

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold"
                >
                    <BellPlus className="mr-2 h-4 w-4" />
                    맞춤 알림 관리
                    {activeCount > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-600 text-white text-[11px] font-bold h-5 min-w-5 px-1.5">
                            {activeCount}
                        </span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarClock className="h-5 w-5 text-amber-600" />
                        맞춤 알림 관리
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                알림 시점
                            </label>
                            <div className="grid grid-cols-[1fr_120px] gap-2">
                                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn(
                                                "w-full pl-3 text-left font-normal bg-white",
                                                !selectedDate && "text-muted-foreground"
                                            )}
                                        >
                                            {selectedDate ? (
                                                format(selectedDate, "PPP", { locale: ko })
                                            ) : (
                                                <span>날짜 선택</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            locale={ko}
                                            selected={selectedDate}
                                            onSelect={(date) => {
                                                setSelectedDate(date)
                                                setIsCalendarOpen(false)
                                            }}
                                            disabled={(date) => date < new Date("1900-01-01")}
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
                                <Select value={selectedHour} onValueChange={setSelectedHour}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <SelectItem key={i} value={String(i)}>
                                                {i}시
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                알림 내용
                            </label>
                            <Textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="예: 픽업 30분 전 확인 전화"
                                rows={3}
                                className="bg-white resize-none"
                            />
                        </div>
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={!isAdmin || !canSave}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellPlus className="mr-2 h-4 w-4" />}
                            알림 추가
                        </Button>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-slate-600 mb-2">
                            등록된 알림 ({alerts?.length || 0})
                        </p>
                        {!alerts || alerts.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6">
                                등록된 알림이 없습니다
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-[240px] overflow-y-auto">
                                {alerts.map((a) => (
                                    <div
                                        key={a.id}
                                        className={`rounded-md border p-3 flex items-start gap-2 text-sm ${
                                            a.is_dismissed
                                                ? "bg-slate-50 border-slate-200 opacity-60"
                                                : "bg-white border-slate-200"
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                                <CalendarClock className="h-3.5 w-3.5" />
                                                {format(new Date(a.scheduled_at), "yyyy.MM.dd H시", { locale: ko })}
                                                {a.is_dismissed && (
                                                    <span className="text-[10px] text-slate-400 font-normal">(해제됨)</span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap break-words">
                                                {a.message}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(a.id)}
                                            disabled={!isAdmin}
                                            className="shrink-0 text-slate-400 hover:text-red-500 transition-colors p-1"
                                            title="삭제"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
