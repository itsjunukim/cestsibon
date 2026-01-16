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
import { Plus, Ticket } from "lucide-react"
import { TicketForm } from "@/components/TicketForm"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"

export default function TicketsPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingTicket, setEditingTicket] = useState<any>(null)
    const supabase = createClient()
    const queryClient = useQueryClient()

    const { data: tickets, isLoading } = useQuery({
        queryKey: ["tickets"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tickets")
                .select("*")
                .order("created_at", { ascending: false })

            if (error) {
                console.warn(error)
                return []
            }
            return data
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

    const openEditDialog = (ticket: any) => {
        setEditingTicket(ticket)
        setIsDialogOpen(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-500">
                    이용권 관리
                </h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreateDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            이용권 추가
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
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
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>이용권 명칭</TableHead>
                                <TableHead className="text-right">가격</TableHead>
                                <TableHead className="text-right">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center">Loading...</TableCell>
                                </TableRow>
                            ) : tickets?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">이용권이 없습니다.</TableCell>
                                </TableRow>
                            ) : tickets?.map((ticket: any) => (
                                <TableRow key={ticket.id}>
                                    <TableCell className="font-medium">{ticket.name}</TableCell>
                                    <TableCell className="text-right">₩{Number(ticket.price).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(ticket)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => deleteTicket(ticket.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
