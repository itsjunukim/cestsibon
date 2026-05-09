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

        const hideNoticePermanently = localStorage.getItem("hideUpdateNotice_202605_v3")
        const hideNoticeThisSession = sessionStorage.getItem("hideUpdateNoticeSession_202605_v3")

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
            localStorage.setItem("hideUpdateNotice_202605_v3", "true")
        } else {
            // 세션 스토리지에 저장하여, 탭을 닫거나 재로그인하기 전까지는 다시 안 뜨게 함
            sessionStorage.setItem("hideUpdateNoticeSession_202605_v3", "true")
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
                        <h4 className="font-bold text-sm mb-1 text-slate-800">1. 정산 관리 내 예약 상세조회 연동</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">정산 관리 메뉴에서 <b>예약건 이름</b>을 클릭하면 예약 상세 화면이 팝업으로 열려, 즉시 조회 및 수정이 가능합니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">2. 예약 폼(수정) 화면 전면 개편</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">정보 가독성을 높이기 위해 전체 레이아웃을 <b>2단으로 개편</b>하고, 섹션별 디자인(폰트/색상/테두리)을 통일하여 최적화했습니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">3. 맞춤 알림 기능</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">예약 수정 화면에서 <b>특정 시점에 표시할 알림</b>을 직접 등록할 수 있습니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">4. 예약 유형 선택 UI 개선</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">새 예약 시 <b>당일 / 숙박</b>을 먼저 선택하면 유형에 맞는 입력 폼이 표시됩니다.</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-1 text-slate-800">5. 직원 계정 권한 변경</h4>
                        <p className="leading-relaxed text-slate-600 text-xs">직원 계정은 <b>모든 정보를 조회만 가능</b>하며, 추가/수정/삭제는 관리자만 가능합니다.</p>
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
