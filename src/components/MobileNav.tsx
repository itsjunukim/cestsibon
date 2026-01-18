"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase"
import { useEffect, useState } from "react"
import {
    LayoutDashboard,
    BedDouble,
    CalendarDays,
    CreditCard,
    Ticket,
    Users,
    LogOut,
    Menu
} from "lucide-react"

export function MobileNav() {
    const pathname = usePathname()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [email, setEmail] = useState<string>("")
    const supabase = createClient()

    useEffect(() => {
        const updateState = async (session: any) => {
            if (session?.user) {
                setEmail(session.user.email || "")
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single()
                setUserRole(profile?.role || 'employee')
            } else {
                setEmail("")
                setUserRole(null)
            }
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            updateState(session)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            updateState(session)
        })

        return () => subscription.unsubscribe()
    }, [])

    const sidebarItems = [
        { icon: LayoutDashboard, label: "영업 현황", href: "/" },
        { icon: CalendarDays, label: "예약 관리", href: "/reservations" },
        { icon: Ticket, label: "이용권 관리", href: "/tickets" },
        { icon: BedDouble, label: "숙소 관리", href: "/accommodations" },
    ]

    if (userRole === 'admin') {
        sidebarItems.push({ icon: Users, label: "계정 관리", href: "/admin/users" })
    }

    if (pathname === '/login' || pathname.startsWith('/auth')) return null

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push("/login")
        router.refresh()
    }

    return (
        <div className="md:hidden flex items-center justify-between p-4 border-b bg-background sticky top-0 z-50">
            <div className="flex items-center gap-2">
                <div className="relative h-8 w-8">
                    <img src="/logo.png" alt="Logo" className="object-contain w-full h-full" />
                </div>
                <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-500">
                    쎄시봉
                </span>
            </div>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Toggle menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b text-left">
                        <SheetTitle className="flex items-center gap-2">
                            <div className="relative h-8 w-8">
                                <img src="/logo.png" alt="Logo" className="object-contain w-full h-full" />
                            </div>
                            <span className="font-bold">메뉴</span>
                        </SheetTitle>
                    </SheetHeader>

                    <div className="flex-1 overflow-auto py-4">
                        <nav className="grid gap-1 px-2">
                            {sidebarItems.map((item, index) => {
                                const isActive = pathname === item.href
                                return (
                                    <Link
                                        key={index}
                                        href={item.href}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                                            isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                                        )}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>

                    <div className="border-t p-4">
                        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">접속 계정</p>
                                <p className="text-sm font-semibold truncate max-w-[140px]">{email || "로그인 필요"}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleLogout}
                                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    )
}
