"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Megaphone } from "lucide-react"

export function NoticePopup() {
    const [open, setOpen] = useState(false)
    const [doNotShow, setDoNotShow] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        // Only show if not on login/auth page
        if (pathname === '/login' || pathname?.startsWith('/auth')) {
            return
        }

        const hideNoticePermanently = localStorage.getItem("hideUpdateNotice_202606_v7")
        const hideNoticeThisSession = sessionStorage.getItem("hideUpdateNoticeSession_202606_v7")

        if (!hideNoticePermanently && !hideNoticeThisSession) {
            // Small delay to let page render first
            const timer = setTimeout(() => {
                setOpen(true)
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [pathname])

    const handleClose = () => {
        if (doNotShow) {
            localStorage.setItem("hideUpdateNotice_202606_v7", "true")
        } else {
            // 세션 스토리지에 저장하여, 탭을 닫거나 재로그인하기 전까지는 다시 안 뜨게 함
            sessionStorage.setItem("hideUpdateNoticeSession_202606_v7", "true")
        }
        setOpen(false)
    }

    // Do not render anything if on login page
    if (pathname === '/login' || pathname?.startsWith('/auth')) return null

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose() }}>
            <DialogContent className="sm:max-w-md bg-white border-slate-200 max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-800 border-b border-slate-100 pb-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <Megaphone className="h-5 w-5 text-primary" />
                        </div>
                        시스템 업데이트 안내 (2026-06-30)
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-4 text-sm text-slate-700">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">1. 환불금 입력란 신설 💰</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">예약금을 과다 입금받아 일부를 돌려준 경우, 이제 <b>환불금</b>을 따로 기록할 수 있습니다. 위치는 예약 수정 화면의 <b>차액(잔금) 자동 계산 아래</b>입니다.<br/>예) 예약금 38만원 입금 → 4만원 환불 → 총 결제금액 34만원, 환불금 4만원으로 기록하면 잔금이 0원으로 자동 계산됩니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">2. 영업현황에 &quot;정산 후 순매출&quot; 카드 추가 📊</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">총 매출에서 <b>정산 관리 페이지에서 정산 완료로 체크한 지출</b>(숙소비·고기·제트보트·기타)을 제외한 실제 남는 금액을 한눈에 볼 수 있습니다. 카드를 클릭하면 정산 관리 페이지로 바로 이동합니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">3. 잔금 0원 예약도 결제 완료 표시(초록색) ✅</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">총액 전액을 예약금으로 받아 잔금이 0원이고 예약금이 입금된 경우, 이제 예약 목록의 결제 정보 칸이 <b>초록색</b>으로 표시됩니다. 기존엔 잔금 결제수단을 입력해야만 초록색이라 헷갈렸던 문제를 개선했습니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">4. 버그 수정 🔧</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">영업현황 대시보드에서 <b>지난달 등 기간 조회 시 404 오류</b>가 발생하던 문제를 수정했습니다.</p>
                    </div>
                </div>
                <DialogFooter className="flex flex-row justify-between items-center border-t border-slate-100 pt-3 sm:pt-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="doNotShow" 
                            checked={doNotShow} 
                            onCheckedChange={(c) => setDoNotShow(!!c)} 
                            className="data-[state=checked]:bg-primary"
                        />
                        <label htmlFor="doNotShow" className="text-sm font-medium leading-none cursor-pointer select-none text-slate-600">
                            최아거 췍!
                        </label>
                    </div>
                    <Button onClick={handleClose} className="px-6 font-bold shadow-sm">확인</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
