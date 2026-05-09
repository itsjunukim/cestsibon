'use server'

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll() {
                    // server action: 쿠키 set 불필요
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { ok: false as const, error: '인증이 필요합니다.' }
    }
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
    if (profile?.role !== 'admin') {
        return { ok: false as const, error: '관리자 권한이 필요합니다.' }
    }
    return { ok: true as const, user }
}

export async function createUser(prevState: any, formData: FormData) {
    const auth = await requireAdmin()
    if (!auth.ok) return { error: auth.error }

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const role = formData.get('role') as string || 'employee'
    const name = formData.get('name') as string
    const phone = formData.get('phone') as string

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return { error: '서버 설정 오류: SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. .env.local 파일을 확인해주세요.' }
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, phone }
    })

    if (error) {
        return { error: '생성 실패: ' + error.message }
    }

    if (data.user) {
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                role: role,
                name: name,
                phone: phone
            })
            .eq('id', data.user.id)

        if (profileError) {
            console.error("Error setting profile", profileError)
            const { error: upsertError } = await supabase.from('profiles').upsert({
                id: data.user.id,
                email: email,
                role: role,
                name: name,
                phone: phone
            })

            if (upsertError) {
                return { success: true, message: `계정 생성됨, 프로필 업데이트 실패: ${upsertError.message}` }
            }
        }
    }

    revalidatePath('/admin/users')
    return { success: true, message: `계정 생성 완료: ${name}(${email})` }
}

export async function deleteUser(userId: string) {
    const auth = await requireAdmin()
    if (!auth.ok) return { error: auth.error }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return { error: '서버 키 없음' }
    }

    if (auth.user.id === userId) {
        return { error: '본인 계정은 삭제할 수 없습니다.' }
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) return { error: error.message }

    revalidatePath('/admin/users')
    return { success: true }
}
