"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
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
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react"
import { TicketForm } from "@/components/TicketForm"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { useState } from "react"
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import {
    SortableContext,
    arrayMove,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type TicketRow = {
    id: string
    name: string
    price: number
    display_order: number | null
}

interface SortableTicketRowProps {
    ticket: TicketRow
    index: number
    onEdit: (ticket: TicketRow) => void
    onDelete: (id: string) => void
}

function SortableTicketRow({ ticket, index, onEdit, onDelete }: SortableTicketRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: ticket.id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <TableRow ref={setNodeRef} style={style} className={isDragging ? "bg-slate-50" : ""}>
            <TableCell className="w-10">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
                    aria-label="순서 변경"
                >
                    <GripVertical className="h-4 w-4" />
                </button>
            </TableCell>
            <TableCell className="text-center font-medium text-muted-foreground">{index + 1}</TableCell>
            <TableCell className="font-medium">{ticket.name}</TableCell>
            <TableCell className="text-right">{Number(ticket.price).toLocaleString()}원</TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(ticket)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(ticket.id)}
                        className="text-red-500 hover:text-red-700"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
}

export default function TicketsPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingTicket, setEditingTicket] = useState<TicketRow | null>(null)
    const supabase = createClient()
    const queryClient = useQueryClient()

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    )

    const { data: tickets, isLoading } = useQuery<TicketRow[]>({
        queryKey: ["tickets"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tickets")
                .select("id, name, price, display_order")
                .order("display_order", { ascending: true, nullsFirst: false })
                .order("name", { ascending: true })

            if (error) {
                console.warn(error)
                return []
            }
            return (data as TicketRow[]) ?? []
        },
    })

    const deleteTicket = async (id: string) => {
        if (!confirm("정말 삭제하시겠습니까?")) return
        const { error } = await supabase.from("tickets").delete().eq("id", id)
        if (error) {
            console.error(error)
            alert("삭제에 실패했습니다.")
        } else {
            queryClient.invalidateQueries({ queryKey: ["tickets"] })
        }
    }

    const openCreateDialog = () => {
        setEditingTicket(null)
        setIsDialogOpen(true)
    }

    const openEditDialog = (ticket: TicketRow) => {
        setEditingTicket(ticket)
        setIsDialogOpen(true)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id || !tickets) return

        const oldIndex = tickets.findIndex((t) => t.id === active.id)
        const newIndex = tickets.findIndex((t) => t.id === over.id)
        if (oldIndex < 0 || newIndex < 0) return

        const reordered = arrayMove(tickets, oldIndex, newIndex).map((t, i) => ({
            ...t,
            display_order: i + 1,
        }))

        // 낙관적 업데이트
        queryClient.setQueryData<TicketRow[]>(["tickets"], reordered)

        // DB에 새 순서 반영
        const updates = await Promise.all(
            reordered.map((t) =>
                supabase.from("tickets").update({ display_order: t.display_order }).eq("id", t.id)
            )
        )
        const failed = updates.find((r) => r.error)
        if (failed) {
            console.error(failed.error)
            alert("순서 저장에 실패했습니다.")
        }
        queryClient.invalidateQueries({ queryKey: ["tickets"] })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-primary">
                    이용권 관리
                </h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreateDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            이용권 추가
                        </Button>
                    </DialogTrigger>
                    <DialogContent onInteractOutside={(e) => e.preventDefault()}>
                        <DialogHeader>
                            <DialogTitle>{editingTicket ? "이용권 수정" : "새 이용권 추가"}</DialogTitle>
                        </DialogHeader>
                        <TicketForm
                            onSuccess={() => setIsDialogOpen(false)}
                            initialData={editingTicket}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>이용권 목록</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        좌측 손잡이를 드래그하여 표시 순서를 변경할 수 있습니다.
                    </p>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10"></TableHead>
                                <TableHead className="w-12 text-center">No.</TableHead>
                                <TableHead>이용권 명칭</TableHead>
                                <TableHead className="text-right">가격</TableHead>
                                <TableHead className="text-right">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                                </TableRow>
                            ) : !tickets || tickets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">이용권이 없습니다.</TableCell>
                                </TableRow>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={tickets.map((t) => t.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {tickets.map((ticket, index) => (
                                            <SortableTicketRow
                                                key={ticket.id}
                                                ticket={ticket}
                                                index={index}
                                                onEdit={openEditDialog}
                                                onDelete={deleteTicket}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
