"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

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

    const { data: role, isLoading } = useQuery({
        queryKey: ["user-role", userId],
        queryFn: async () => {
            if (!userId) return null
            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", userId)
                .single()
            return profile?.role || "employee"
        },
        enabled: userId !== undefined,
        staleTime: 60 * 1000,
    })

    return {
        role: role ?? null,
        isAdmin: role === "admin",
        isLoading: userId === undefined || isLoading,
    }
}
