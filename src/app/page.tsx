"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useUserRole } from "@/hooks/useUserRole"

export default function PortalPage() {
  const router = useRouter()
  const supabase = createClient()
  const { canAccessSite, isLoading } = useUserRole()
  const showGapyeong = canAccessSite("gapyeong")
  const showYangpyeong = canAccessSite("yangpyeong")
  const accessibleCount = (showGapyeong ? 1 : 0) + (showYangpyeong ? 1 : 0)

  // 접근 가능한 사이트가 한 곳뿐이면 워크스페이스 선택 없이 바로 라우팅
  useEffect(() => {
    if (isLoading || accessibleCount !== 1) return
    router.replace(showGapyeong ? "/gapyeong" : "/yangpyeong")
  }, [isLoading, accessibleCount, showGapyeong, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  // 로딩 중이거나, 단일 사이트라 곧 리다이렉트될 때는 스피너 노출 (선택창 깜빡임 방지)
  if (isLoading || accessibleCount === 1) {
    return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-slate-900 hover:bg-slate-200/50">
          <LogOut className="h-4 w-4 mr-2" /> 로그아웃
        </Button>
      </div>
      
      <div className="max-w-3xl w-full space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center space-y-3">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              C'est Si Bon Workspace
            </h1>
            <p className="text-slate-500 text-sm">
              관리하실 영업장을 선택해주세요.
            </p>
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-6 ${showGapyeong && showYangpyeong ? "md:grid-cols-2" : "max-w-md mx-auto"}`}>
          {/* 양평 쎄시봉 수상레저 */}
          {showYangpyeong && (
          <Card
            className="group cursor-pointer hover:border-slate-400 transition-all duration-300 bg-white shadow-sm hover:shadow-md"
            onClick={() => router.push('/yangpyeong')}
          >
            <CardContent className="p-8 flex flex-col h-full justify-between gap-8">
              <div className="flex items-start justify-between">
                <div className="h-20 w-20 flex items-center justify-center">
                  <img src="/yp-logo.png" alt="양평 로고" className="object-contain w-full h-full" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-slate-900 transition-colors duration-300 transform group-hover:translate-x-1" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-slate-900">양평 쎄시봉 수상레저</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">수상스키·웨이크보드·놀이기구<br/>정산 현황을 통합 관리합니다.</p>
              </div>
            </CardContent>
          </Card>
          )}

          {/* 가평 더 파크 쎄시봉 */}
          {showGapyeong && (
          <Card
            className="group cursor-pointer hover:border-slate-400 transition-all duration-300 bg-white shadow-sm hover:shadow-md"
            onClick={() => router.push('/gapyeong')}
          >
            <CardContent className="p-8 flex flex-col h-full justify-between gap-8">
              <div className="flex items-start justify-between">
                <div className="h-20 w-20 flex items-center justify-center">
                  <img src="/logo.png" alt="가평 로고" className="object-contain w-full h-full" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-slate-900 transition-colors duration-300 transform group-hover:translate-x-1" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-slate-900">가평 더 파크 쎄시봉</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">숙박, 바베큐 및 수상레저 영업 현황과<br/>예약 관리를 진행합니다.</p>
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </div>
  )
}
