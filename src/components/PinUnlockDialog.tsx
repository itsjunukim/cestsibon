"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"

interface PinUnlockDialogProps {
  isOpen: boolean
  onClose: () => void
  onUnlock: () => void
}

export function PinUnlockDialog({ isOpen, onClose, onUnlock }: PinUnlockDialogProps) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState(false)

  // Hardcoded PIN
  const CORRECT_PIN = "9105"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pin === CORRECT_PIN) {
      setError(false)
      setPin("")
      onUnlock()
    } else {
      setError(true)
      setPin("")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-500" />
            화면 잠금 해제
          </DialogTitle>
          <DialogDescription>
            내용을 확인하려면 PIN을 입력하세요.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder="PIN 입력"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value)
              setError(false)
            }}
            className={error ? "border-red-500 focus-visible:ring-red-500 text-center text-lg tracking-widest" : "text-center text-lg tracking-widest"}
            autoFocus
          />
          {error && <p className="text-sm text-red-500 text-center">비밀번호가 일치하지 않습니다.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit">확인</Button>
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
