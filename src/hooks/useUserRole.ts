"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

export type SiteKey = "gapyeong" | "yangpyeong"

export function useUserRole() {
    const supabase = createClient()
    const [userId, setUserId] = useState<string | null | undefined>(undefined)

    useEffect(() => {
        let mounted = true
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) setUserId(session?.user?.id ?? null)
        })
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) setUserId(session?.user?.id ?? null)
        })
        return () => {
            mounted = false
            sub.subscription.unsubscribe()
        }
    }, [supabase])

    const { data: profile, isLoading } = useQuery({
        queryKey: ["user-role", userId],
        queryFn: async () => {
            if (!userId) return null
            const { data } = await supabase
                .from("profiles")
                .select("role, site")
                .eq("id", userId)
                .single()
            return {
                role: data?.role || "employee",
                site: data?.site || "gapyeong",
            }
        },
        enabled: userId !== undefined,
        staleTime: 60 * 1000,
    })

    const role = profile?.role ?? null
    const site = profile?.site ?? null
    const isSuperAdmin = role === "super_admin"

    const canAccessSite = (target: SiteKey) => isSuperAdmin || site === "all" || site === target
    const canAdminSite = (target: SiteKey) =>
        isSuperAdmin || (role === "admin" && site === target)

    return {
        role,
        site,
        isSuperAdmin,
        // 하위 호환: 기존 컴포넌트가 쓰는 isAdmin (super_admin 또는 admin)
        isAdmin: role === "super_admin" || role === "admin",
        canAccessSite,
        canAdminSite,
        isLoading: userId === undefined || isLoading,
    }
}
