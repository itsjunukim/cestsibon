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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, UserCog, Shield, ShieldAlert } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase"
import { useState } from "react"
import { format } from "date-fns"
import { createUser, deleteUser } from "./actions"
import { useToast } from "@/components/ui/use-toast" // Assuming useToast exists, or I fallback to alert

export default function UserManagementPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isLoadingAction, setIsLoadingAction] = useState(false)
    const supabase = createClient()
    const queryClient = useQueryClient()

    // Form State
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        name: "",
        phone: "",
        role: "employee"
    })

    const { data: profiles, isLoading } = useQuery({
        queryKey: ["profiles"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false })

            if (error) {
                console.error(error)
                return []
            }
            return data
        },
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoadingAction(true)

        const data = new FormData()
        data.append('email', formData.email)
        data.append('password', formData.password)
        data.append('name', formData.name)
        data.append('phone', formData.phone)
        data.append('role', formData.role)

        const result = await createUser(null, data)

        setIsLoadingAction(false)

        if (result.error) {
            alert(result.error)
        } else {
            alert(result.message)
            setIsDialogOpen(false)
            setFormData({ email: "", password: "", name: "", phone: "", role: "employee" })
            queryClient.invalidateQueries({ queryKey: ["profiles"] })
        }
    }

    const handleDelete = async (id: string, email: string) => {
        if (!confirm(`${email} 계정을 정말 삭제하시겠습니까?`)) return

        const result = await deleteUser(id)
        if (result?.error) {
            alert("삭제 실패: " + result.error)
        } else {
            queryClient.invalidateQueries({ queryKey: ["profiles"] })
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-500">
                    직원 계정 관리
                </h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            새 직원 등록
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>새 직원 계정 생성</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">이메일</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="employee@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">비밀번호</Label>
                                <Input
                                    id="password"
                                    type="text"
                                    required
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="최소 6자 이상"
                                    minLength={6}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">이름</Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="홍길동"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">전화번호</Label>
                                    <Input
                                        id="phone"
                                        type="text"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="010-1234-5678"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">권한</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={val => setFormData({ ...formData, role: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="employee">직원 (Employee)</SelectItem>
                                        <SelectItem value="admin">관리자 (Admin)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoadingAction}>
                                {isLoadingAction ? "생성 중..." : "계정 생성"}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>계정 목록</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>이메일</TableHead>
                                <TableHead>이름</TableHead>
                                <TableHead>전화번호</TableHead>
                                <TableHead>권한</TableHead>
                                <TableHead>생성일</TableHead>
                                <TableHead className="text-right">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        불러오는 중...
                                    </TableCell>
                                </TableRow>
                            ) : profiles?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        등록된 계정이 없습니다. (setup_roles.sql을 실행했는지 확인해주세요)
                                    </TableCell>
                                </TableRow>
                            ) : (
                                profiles?.map((profile: any) => (
                                    <TableRow key={profile.id}>
                                        <TableCell className="font-medium">{profile.email}</TableCell>
                                        <TableCell>{profile.name || "-"}</TableCell>
                                        <TableCell>{profile.phone || "-"}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${profile.role === 'admin'
                                                ? 'bg-purple-100 text-purple-800'
                                                : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {profile.role === 'admin' ? <ShieldAlert className="h-3 w-3" /> : <UserCog className="h-3 w-3" />}
                                                {profile.role === 'admin' ? '관리자' : '직원'}
                                            </span>
                                        </TableCell>
                                        <TableCell>{format(new Date(profile.created_at), "yyyy-MM-dd")}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDelete(profile.id, profile.email)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
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
