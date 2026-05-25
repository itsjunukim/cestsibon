"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUserRole } from "@/hooks/useUserRole"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GripVertical, Pencil, Plus, Trash2, Ticket } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type ProductRow = {
    id: string
    name: string
    price: number
    display_order: number | null
}

interface SortableRowProps {
    p: ProductRow
    index: number
    onEdit: (p: ProductRow) => void
    onDelete: (id: string) => void
    isAdmin: boolean
}

function SortableRow({ p, index, onEdit, onDelete, isAdmin }: SortableRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

    return (
        <TableRow ref={setNodeRef} style={style} className={isDragging ? "bg-slate-50" : ""}>
            <TableCell className="w-10">
                <button type="button" {...attributes} {...listeners} disabled={!isAdmin}
                    className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing" aria-label="순서 변경">
                    <GripVertical className="h-4 w-4" />
                </button>
            </TableCell>
            <TableCell className="text-center font-medium text-muted-foreground">{index + 1}</TableCell>
            <TableCell className="font-medium">{p.name}</TableCell>
            <TableCell className="text-right tabular-nums">{Number(p.price).toLocaleString()}원</TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" title={isAdmin ? "수정" : "조회"} onClick={() => onEdit(p)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(p.id)} disabled={!isAdmin} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
}

interface FormState { name: string; price: string }
const initialForm = (): FormState => ({ name: "", price: "0" })

export default function YangpyeongProductsPage() {
    const { canAdminSite } = useUserRole()
    const isAdmin = canAdminSite("yangpyeong")
    const supabase = createClient()
    const queryClient = useQueryClient()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editing, setEditing] = useState<ProductRow | null>(null)
    const [form, setForm] = useState<FormState>(initialForm())
    const [isSaving, setIsSaving] = useState(false)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    const { data: products, isLoading } = useQuery<ProductRow[]>({
        queryKey: ["yp-products"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("yp_products")
                .select("id, name, price, display_order")
                .order("display_order", { ascending: true, nullsFirst: false })
                .order("name", { ascending: true })
            if (error) { console.error(error); return [] }
            return (data as ProductRow[]) || []
        },
    })

    const openCreate = () => { setEditing(null); setForm(initialForm()); setIsDialogOpen(true) }
    const openEdit = (p: ProductRow) => {
        setEditing(p)
        setForm({ name: p.name, price: String(p.price) })
        setIsDialogOpen(true)
    }

    const handleSave = async () => {
        if (!form.name.trim()) { alert("이용권 이름을 입력해주세요."); return }
        const priceNum = Number(String(form.price).replace(/[^0-9]/g, ""))
        if (isNaN(priceNum) || priceNum < 0) { alert("가격을 정확히 입력해주세요."); return }
        setIsSaving(true)
        const payload = { name: form.name.trim(), price: priceNum }
        const { error } = editing
            ? await supabase.from("yp_products").update(payload).eq("id", editing.id)
            : await supabase.from("yp_products").insert(payload)
        setIsSaving(false)
        if (error) { alert("저장 실패: " + error.message); return }
        setIsDialogOpen(false)
        queryClient.invalidateQueries({ queryKey: ["yp-products"] })
    }

    const handleDelete = async (id: string) => {
        if (!confirm("정말 삭제하시겠습니까? 매출에 이미 사용된 이용권은 삭제할 수 없습니다.")) return
        const { error } = await supabase.from("yp_products").delete().eq("id", id)
        if (error) { alert("삭제 실패: " + error.message); return }
        queryClient.invalidateQueries({ queryKey: ["yp-products"] })
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id || !products) return
        const oldIndex = products.findIndex(p => p.id === active.id)
        const newIndex = products.findIndex(p => p.id === over.id)
        if (oldIndex < 0 || newIndex < 0) return
        const reordered = arrayMove(products, oldIndex, newIndex).map((p, i) => ({ ...p, display_order: i + 1 }))
        queryClient.setQueryData<ProductRow[]>(["yp-products"], reordered)
        const updates = await Promise.all(
            reordered.map(p => supabase.from("yp_products").update({ display_order: p.display_order }).eq("id", p.id))
        )
        if (updates.find(r => r.error)) { alert("순서 저장 실패"); }
        queryClient.invalidateQueries({ queryKey: ["yp-products"] })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <Ticket className="h-7 w-7 text-cyan-500" />
                    이용권 관리
                </h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreate} disabled={!isAdmin} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                            <Plus className="mr-2 h-4 w-4" />
                            이용권 추가
                        </Button>
                    </DialogTrigger>
                    <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[420px]">
                        <DialogHeader>
                            <DialogTitle>{editing ? "이용권 수정" : "새 이용권 추가"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div>
                                <Label className="text-xs font-semibold">이름</Label>
                                <Input className="mt-1.5" placeholder="예: 아웃보드 쿠폰 50장 / 5인 3종 / 라면" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold">가격 (원)</Label>
                                <Input
                                    className="mt-1.5 text-right font-bold tabular-nums"
                                    type="text"
                                    placeholder="0"
                                    value={form.price ? Number(String(form.price).replace(/[^0-9]/g, '')).toLocaleString() : ''}
                                    onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^0-9]/g, '') })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
                            <Button onClick={handleSave} disabled={!isAdmin || isSaving} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                                {isSaving ? "저장 중..." : editing ? "수정" : "저장"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>이용권 목록</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        좌측 손잡이를 드래그하여 매출 입력 시 노출 순서를 변경할 수 있습니다.
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
                                <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
                            ) : !products || products.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">등록된 이용권이 없습니다.</TableCell></TableRow>
                            ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={products.map(p => p.id)} strategy={verticalListSortingStrategy}>
                                        {products.map((p, i) => (
                                            <SortableRow key={p.id} p={p} index={i} onEdit={openEdit} onDelete={handleDelete} isAdmin={isAdmin} />
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
