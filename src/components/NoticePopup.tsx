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

        const hideNoticePermanently = localStorage.getItem("hideUpdateNotice_202608_v9")
        const hideNoticeThisSession = sessionStorage.getItem("hideUpdateNoticeSession_202608_v9")

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
            localStorage.setItem("hideUpdateNotice_202608_v9", "true")
        } else {
            // 세션 스토리지에 저장하여, 탭을 닫거나 재로그인하기 전까지는 다시 안 뜨게 함
            sessionStorage.setItem("hideUpdateNoticeSession_202608_v9", "true")
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
                        시스템 업데이트 안내 (2026-08-10)
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-4 text-sm text-slate-700">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">픽업 인원 모아보기 🚌</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">목록 툴바의 <b>🚌 버튼</b>을 누르면 조회 기간의 픽업이 <b>장소별·시간순</b>으로 정리됩니다. 전화번호를 누르면 바로 통화되고, <b>복사</b> 버튼으로 기사님께 그대로 보낼 수 있습니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">숙소별 인원 한눈에 📊</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">예약 목록 상단에 <b>숙소별 인원 칩</b>이 추가됐습니다. 날짜를 오늘로 맞추면 어느 숙소에 몇 명 오는지 바로 보입니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">목록에서 숙소 바로 지정 🏠</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">숙박 예약의 <b>숙소 칸을 클릭</b>해 <b>블링블링 / 없음</b>을 바로 선택할 수 있습니다. 방 종류가 있는 숙소는 기존처럼 수정 화면에서 변경해 주세요.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">새 예약에서 상태까지 한 번에 ✅</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">예약을 만들 때도 <b>상태</b>를 고를 수 있습니다. 로드 손님은 <b>완료</b>로 두고 저장하면, 목록에서 다시 바꿀 필요가 없습니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">예비 번호 추가 📞</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">전화번호 옆 <b>+ 예비 번호</b>를 누르면 번호를 하나 더 적을 수 있습니다. 예약자와 오시는 분이 다를 때 쓰세요.</p>
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
