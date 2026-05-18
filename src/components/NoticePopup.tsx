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

        const hideNoticePermanently = localStorage.getItem("hideUpdateNotice_202605_v6")
        const hideNoticeThisSession = sessionStorage.getItem("hideUpdateNoticeSession_202605_v6")

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
            localStorage.setItem("hideUpdateNotice_202605_v6", "true")
        } else {
            // 세션 스토리지에 저장하여, 탭을 닫거나 재로그인하기 전까지는 다시 안 뜨게 함
            sessionStorage.setItem("hideUpdateNoticeSession_202605_v6", "true")
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
                        시스템 업데이트 안내
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-4 text-sm text-slate-700">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">1. 차액 분할 결제 기능</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">잔금을 여러 결제수단으로 나눠 받을 수 있습니다. (최대 5개, 예: 카드 30만 + 계좌이체 20만) 차액 결제 수단 옆 <b>[+] 버튼</b>으로 분할 결제 창이 열립니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">2. 결제수단별 매출 통계 연동</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">영업 현황 대시보드의 결제수단별 매출이 분할 결제 금액까지 <b>정확하게 나눠서 합산</b>됩니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">3. 총 예상 매출 카드 신설</h4>
                        <p className="leading-relaxed text-slate-600 text-xs"><b>총 예상 매출</b>은 미정산·미입금 금액까지 포함한 전체 예상 매출, <b>총 매출</b>은 정산 완료된 실현 매출(미정산 잔금·미입금 예약금 제외)로 구분됩니다.</p>
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
