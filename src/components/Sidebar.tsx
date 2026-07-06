"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useEffect, useState } from "react"
import { NotificationBell } from "@/components/NotificationBell"
import { useUserRole } from "@/hooks/useUserRole"
import {
    LayoutDashboard,
    BedDouble,
    CalendarDays,
    CreditCard,
    Ticket,
    Users,
    LogOut,
    Calculator,
    StickyNote
} from "lucide-react"

import { useRouter } from "next/navigation"

type SiteKey = "gapyeong" | "yangpyeong"

const SITE_CONFIG: Record<SiteKey, { home: string; logo: string; title: string; subtitle: string; items: { icon: any; label: string; href: string }[] }> = {
    gapyeong: {
        home: "/gapyeong",
        logo: "/logo.png",
        title: "더 파크 쎄시봉",
        subtitle: "영업관리시스템",
        items: [
            { icon: LayoutDashboard, label: "영업 현황", href: "/gapyeong" },
            { icon: CalendarDays, label: "예약 관리", href: "/gapyeong/reservations" },
            { icon: Ticket, label: "이용권 관리", href: "/gapyeong/tickets" },
            { icon: BedDouble, label: "숙소 관리", href: "/gapyeong/accommodations" },
            { icon: Calculator, label: "정산 관리", href: "/gapyeong/settlements" },
            { icon: StickyNote, label: "메모", href: "/gapyeong/notes" },
        ],
    },
    yangpyeong: {
        home: "/yangpyeong",
        logo: "/yp-logo.png",
        title: "쎄시봉 수상레저",
        subtitle: "영업관리시스템",
        items: [
            { icon: LayoutDashboard, label: "영업 현황", href: "/yangpyeong" },
            { icon: CreditCard, label: "매출 현황", href: "/yangpyeong/sales" },
        ],
    },
}

export function Sidebar({ site = "gapyeong" }: { site?: SiteKey }) {
    const pathname = usePathname()
    const router = useRouter()
    const config = SITE_CONFIG[site]
    const { canAccessSite } = useUserRole()
    const hasBoth = canAccessSite("gapyeong") && canAccessSite("yangpyeong")
    const logoHref = hasBoth ? "/" : config.home
    const [userRole, setUserRole] = useState<string | null>(null)
    const [email, setEmail] = useState<string>("")
    const supabase = createClient()

    useEffect(() => {
        // Function to update state from a session
        const updateState = async (session: any) => {
            if (session?.user) {
                setEmail(session.user.email || "")
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single()

                if (error) {
                    console.log("Profile fetch error:", error)
                }

                setUserRole(profile?.role || 'employee')
            } else {
                setEmail("")
                setUserRole(null)
            }
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            updateState(session)
        })

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            updateState(session)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const sidebarItems = [...config.items]

    if (userRole === 'super_admin') {
        sidebarItems.push({ icon: Users, label: "계정 관리", href: "/admin/users" })
    }

    if (pathname === '/login' || pathname.startsWith('/auth')) return null

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push("/login")
        router.refresh()
    }

    return (
        <div className="flex h-full w-64 flex-col border-r bg-card text-card-foreground shadow-xl">
            <div className="flex h-20 items-center border-b pr-2">
                <Link href={logoHref} title={hasBoth ? "워크스페이스 선택" : undefined} className="flex items-center gap-3 flex-1 h-full px-4 hover:bg-muted/50 transition-colors">
                    <div className="relative h-14 w-14">
                        <img src={config.logo} alt="Logo" className="object-contain w-full h-full" />
                    </div>
                    <span className="text-base font-bold text-primary leading-tight">
                        {config.title}<br />
                        {config.subtitle}
                    </span>
                </Link>
                {site === "gapyeong" && <NotificationBell />}
            </div>
            <div className="flex-1 overflow-auto py-6">
                <nav className="grid gap-2 px-4">
                    {sidebarItems.map((item, index) => {
                        const isActive = pathname === item.href
                        return (
                            <Button
                                key={index}
                                asChild
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                    "justify-start gap-4 transition-all duration-200 hover:translate-x-1",
                                    isActive && "bg-primary/10 text-primary font-semibold shadow-sm"
                                )}
                            >
                                <Link href={item.href}>
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                </Link>
                            </Button>
                        )
                    })}
                </nav>
            </div>
            <div className="border-t p-4">
                <div className="rounded-lg bg-gradient-to-br from-primary/10 to-purple-500/10 p-4 relative group">
                    <div className="pr-8">
                        <p className="text-xs font-medium text-muted-foreground">접속 계정</p>
                        <p className="text-sm font-semibold truncate">{email || "로그인 필요"}</p>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">{userRole === 'super_admin' ? '통합 관리자' : userRole === 'admin' ? '관리자' : '직원'}</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="로그아웃"
                        className="absolute top-1/2 -translate-y-1/2 right-2 h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
