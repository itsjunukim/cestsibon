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

        const hideNoticePermanently = localStorage.getItem("hideUpdateNotice_202608_v10")
        const hideNoticeThisSession = sessionStorage.getItem("hideUpdateNoticeSession_202608_v10")

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
            localStorage.setItem("hideUpdateNotice_202608_v10", "true")
        } else {
            // 세션 스토리지에 저장하여, 탭을 닫거나 재로그인하기 전까지는 다시 안 뜨게 함
            sessionStorage.setItem("hideUpdateNoticeSession_202608_v10", "true")
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
                        시스템 업데이트 안내 (2026-08-18)
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-4 text-sm text-slate-700">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">완료된 예약 숨기기 👁</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">예약이 많은 날, 검색창 오른쪽 <b>완료 숨기기</b>를 한 번 누르면 처리 끝난 건이 빠지고 <b>남은 예약만</b> 보입니다. 버튼에 숨긴 건수가 표시되니 예약이 사라진 게 아니라는 것도 바로 확인됩니다. 다시 누르면 전부 돌아옵니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">예약금 미입금이 호박색으로 🟨</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">예약금을 아직 못 받은 건은 결제 정보 박스가 <b>호박색</b>으로 바뀝니다. 특히 <b>잔금 결제수단을 입력해 둔 예약</b>은 예전에 초록색으로 보여서 미입금인 걸 놓치기 쉬웠는데, 이제 호박색이 우선 표시됩니다.</p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <h4 className="font-bold text-sm mb-1 text-amber-900">이용권 잘못 선택되던 문제 수정 🔧</h4>
                        <p className="leading-relaxed text-amber-800 text-xs">예약 수정 화면에서 이용권을 고를 때, <b>스크롤한 직후 클릭하면 다른 이용권이 추가되던 문제</b>를 고쳤습니다.<br/><b>확인 부탁드립니다</b>: 이전에 저장된 예약 중 이용권이 실제와 다르게 들어간 건이 있을 수 있습니다. 금액이 안 맞는 예약이 보이면 이용권을 다시 확인해 주세요.</p>
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
