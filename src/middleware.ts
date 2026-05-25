import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // Check if we have env vars, if not, skip middleware to avoid crash in demo
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return response
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, {
                            ...options,
                            maxAge: 60 * 60 * 6, // 6 hours
                        })
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/auth')
    ) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    const path = request.nextUrl.pathname
    const needsAdmin = path.startsWith('/admin')
    const needsGapyeong = path.startsWith('/gapyeong')
    const needsYangpyeong = path.startsWith('/yangpyeong')

    if (user && (needsAdmin || needsGapyeong || needsYangpyeong)) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, site')
            .eq('id', user.id)
            .single()

        const role = profile?.role
        const site = profile?.site
        const isSuper = role === 'super_admin'

        // 계정 관리: 통합 관리자(super_admin) 전용
        if (needsAdmin && !isSuper) {
            return NextResponse.redirect(new URL('/', request.url))
        }
        // 사이트 접근: super_admin(all) 또는 본인 소속 사이트만
        if (needsGapyeong && !(isSuper || site === 'all' || site === 'gapyeong')) {
            return NextResponse.redirect(new URL('/', request.url))
        }
        if (needsYangpyeong && !(isSuper || site === 'all' || site === 'yangpyeong')) {
            return NextResponse.redirect(new URL('/', request.url))
        }
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
