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
import { Plus, Pencil, Trash2 } from "lucide-react"
import { AccommodationForm } from "@/components/AccommodationForm"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { useState } from "react"

export default function AccommodationsPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingAccommodation, setEditingAccommodation] = useState<any>(null)
    const supabase = createClient()

    const { data: accommodations, isLoading } = useQuery({
        queryKey: ["accommodations"],
        queryFn: async () => {
            // Fetch accommodations with their rooms using a join query seems tricky with just simple select if setup incorrectly,
            // but assuming foreign key is set up:
            const { data, error } = await supabase
                .from("accommodations")
                .select("*, rooms(*)") // Fetch rooms as well
                .order("created_at", { ascending: false })

            if (error) {
                console.warn("Supabase fetch failed, returning mock data", error)
                return []
            }
            return data
        },
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-500">
                    숙소 관리
                </h1>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open)
                    if (!open) setEditingAccommodation(null)
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            새 숙소 추가
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingAccommodation ? "숙소 수정" : "새 숙소 추가"}</DialogTitle>
                        </DialogHeader>
                        <AccommodationForm
                            initialData={editingAccommodation}
                            onSuccess={() => setIsDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>숙소 목록</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>이름</TableHead>
                                <TableHead>방 종류</TableHead>
                                <TableHead>연락처</TableHead>
                                <TableHead>세부사항</TableHead>
                                <TableHead className="text-right">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10">
                                        불러오는 중...
                                    </TableCell>
                                </TableRow>
                            ) : accommodations?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10">
                                        등록된 숙소가 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                accommodations?.map((acc: any) => (
                                    <TableRow key={acc.id}>
                                        <TableCell className="font-medium">{acc.name}</TableCell>
                                        <TableCell>
                                            {acc.rooms && acc.rooms.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {acc.rooms.map((room: any) => (
                                                        <span key={room.id} className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold text-foreground">
                                                            {room.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">등록된 방 없음</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{acc.contact}</TableCell>
                                        <TableCell>{acc.details}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="수정"
                                                    onClick={() => {
                                                        setEditingAccommodation(acc)
                                                        setIsDialogOpen(true)
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4 text-gray-500" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="삭제"
                                                    onClick={() => {
                                                        if (confirm('정말 삭제하시겠습니까?')) {
                                                            // Handle delete logic here or pass a handler
                                                            const deleteAccommodation = async () => {
                                                                const { error } = await supabase
                                                                    .from('accommodations')
                                                                    .delete()
                                                                    .eq('id', acc.id)

                                                                if (!error) {
                                                                    // Invalidate queries if we had access to queryClient here or just reload
                                                                    window.location.reload()
                                                                }
                                                            }
                                                            deleteAccommodation()
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
