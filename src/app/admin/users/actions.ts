'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function createUser(prevState: any, formData: FormData) {
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
        user_metadata: { name, phone } // Store in metadata as backup
    })

    if (error) {
        return { error: '생성 실패: ' + error.message }
    }

    if (data.user) {
        // Trigger might have created the row, or we upsert.
        // We update name, phone, and role.
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                role: role,
                name: name,
                phone: phone
            })
            .eq('id', data.user.id)

        // If trigger didn't run yet or failed, we might need to insert. 
        // But usually update is fine if trigger works. 
        // If update affects 0 rows, we might simply retry or Insert.
        // For simplicity assuming trigger runs fast or we upsert.

        if (profileError) {
            console.error("Error setting profile", profileError)
            // Fallback: try upsert if update failed (though update shouldn't fail if row exists)
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
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return { error: '서버 키 없음' }
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
