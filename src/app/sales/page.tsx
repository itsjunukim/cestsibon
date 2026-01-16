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
import { Plus, Banknote } from "lucide-react"
import { SalesEntryForm } from "@/components/SalesEntryForm"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { useState } from "react"
import { format } from "date-fns"

export default function SalesPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const supabase = createClient()

    const { data: sales, isLoading } = useQuery({
        queryKey: ["sales"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("sales")
                .select("*, reservations(customer_name)")
                .order("created_at", { ascending: false })

            if (error) {
                console.warn(error)
                return [
                    { id: "1", item_name: "Morning Ski", amount: 50000, category: "ski", created_at: new Date().toISOString(), reservations: { customer_name: "Jane Doe" } }
                ]
            }
            return data
        },
    })

    // Calculate total for displayed items
    const totalSales = sales?.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0) || 0

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-500">
                    매출 관리
                </h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            새 매출 등록
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>매출 등록</DialogTitle>
                        </DialogHeader>
                        <SalesEntryForm onSuccess={() => setIsDialogOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-gradient-to-br from-primary/20 to-purple-500/20 border-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">총 매출 (조회 기준)</CardTitle>
                        <Banknote className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₩{totalSales.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">목록 합계</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>매출 내역</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>일시</TableHead>
                                <TableHead>항목</TableHead>
                                <TableHead>분류</TableHead>
                                <TableHead>고객명</TableHead>
                                <TableHead className="text-right">금액</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center">불러오는 중...</TableCell>
                                </TableRow>
                            ) : sales?.map((sale: any) => (
                                <TableRow key={sale.id}>
                                    <TableCell>{format(new Date(sale.created_at), "yyyy-MM-dd HH:mm")}</TableCell>
                                    <TableCell className="font-medium">{sale.item_name}</TableCell>
                                    <TableCell className="capitalize text-muted-foreground">
                                        {sale.category === 'ski' ? '스키/레저' :
                                            sale.category === 'room' ? '숙박' :
                                                sale.category === 'food' ? '식음료' : '기타'}
                                    </TableCell>
                                    <TableCell>{sale.reservations?.customer_name || "워크인 (현장)"}</TableCell>
                                    <TableCell className="text-right font-bold">
                                        ₩{sale.amount.toLocaleString()}
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
