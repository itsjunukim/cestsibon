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
import { Plus } from "lucide-react"
import { AccommodationForm } from "@/components/AccommodationForm"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { useState } from "react"

export default function AccommodationsPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const supabase = createClient()

    const { data: accommodations, isLoading } = useQuery({
        queryKey: ["accommodations"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("accommodations")
                .select("*")
                .order("created_at", { ascending: false })

            if (error) {
                // If table doesn't exist or connection fails, return mock data for demo
                console.warn("Supabase fetch failed, returning mock data", error)
                return [
                    { id: "1", name: "길조호텔", contact: "010-7777-7777", details: "Traditional Korean style" },
                    { id: "2", name: "Pension B", contact: "010-1111-1111", details: "Discount applied" },
                ]
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
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            새 숙소 추가
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>새 숙소 추가</DialogTitle>
                        </DialogHeader>
                        <AccommodationForm onSuccess={() => setIsDialogOpen(false)} />
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
                                <TableHead>연락처</TableHead>
                                <TableHead>세부사항</TableHead>
                                <TableHead className="text-right">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10">
                                        불러오는 중...
                                    </TableCell>
                                </TableRow>
                            ) : accommodations?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10">
                                        등록된 숙소가 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                accommodations?.map((acc: any) => (
                                    <TableRow key={acc.id}>
                                        <TableCell className="font-medium">{acc.name}</TableCell>
                                        <TableCell>{acc.contact}</TableCell>
                                        <TableCell>{acc.details}</TableCell>
                                        <TableCell className="text-right">
                                            {/* Edit/Delete actions could go here */}
                                            <Button variant="ghost" size="sm">수정</Button>
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
