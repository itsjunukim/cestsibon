"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns"
import { ko } from "date-fns/locale"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
    className?: string
    date?: DateRange
    onDateChange?: (date: DateRange | undefined) => void
}

export function DateRangePicker({
    className,
    date,
    onDateChange,
}: DateRangePickerProps) {
    const handlePresetSelect = (days: number) => {
        if (days === 0) {
            onDateChange?.({
                from: new Date(),
                to: new Date()
            })
            return
        }

        const to = new Date()
        const from = subDays(to, days - 1) // -1 to include today
        onDateChange?.({ from, to })
    }

    const handleMonthSelect = (monthsToSubtract: number) => {
        const today = new Date()
        const targetMonth = subMonths(today, monthsToSubtract)

        // precise start and end of month
        const from = startOfMonth(targetMonth)
        const to = endOfMonth(targetMonth)

        onDateChange?.({ from, to })
    }

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[260px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "MM.dd", { locale: ko })} -{" "}
                                    {format(date.to, "MM.dd", { locale: ko })}
                                </>
                            ) : (
                                format(date.from, "MM.dd", { locale: ko })
                            )
                        ) : (
                            <span>기간 선택</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <div className="flex flex-col sm:flex-row">
                        <div className="p-3 border-b sm:border-b-0 sm:border-r space-y-2 flex flex-col min-w-[120px]">
                            <span className="text-xs font-medium text-muted-foreground mb-1 px-2">기간 설정</span>
                            <Button variant="ghost" className="justify-start text-sm font-normal" onClick={() => handlePresetSelect(0)}>
                                오늘
                            </Button>
                            <Button variant="ghost" className="justify-start text-sm font-normal" onClick={() => handlePresetSelect(7)}>
                                최근 7일
                            </Button>
                            <Button variant="ghost" className="justify-start text-sm font-normal" onClick={() => handlePresetSelect(30)}>
                                최근 30일
                            </Button>
                            <div className="h-px bg-border my-2" />
                            <span className="text-xs font-medium text-muted-foreground mb-1 px-2">월별 설정</span>
                            <Button variant="ghost" className="justify-start text-sm font-normal" onClick={() => handleMonthSelect(0)}>
                                이번 달
                            </Button>
                            <Button variant="ghost" className="justify-start text-sm font-normal" onClick={() => handleMonthSelect(1)}>
                                지난 달
                            </Button>
                        </div>
                        <div className="p-0">
                            <Calendar
                                locale={ko}
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={onDateChange}
                                numberOfMonths={2}
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
