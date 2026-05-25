import { Sidebar } from "@/components/Sidebar";
import { MobileNav, BottomTabBar } from "@/components/MobileNav";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 계정 관리(/admin/*)는 통합 관리자(super_admin) 전용.
  // 사이드바는 가평 메뉴를 띄워두되, 로고 클릭으로 워크스페이스 선택 화면으로 복귀 가능.
  return (
    <div className="flex h-screen overflow-hidden flex-col md:flex-row bg-background">
      <div className="hidden md:block h-full">
        <Sidebar site="gapyeong" />
      </div>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <MobileNav site="gapyeong" />
        <main className="flex-1 overflow-auto p-4 md:p-8 pb-10 md:pb-6 flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          <footer className="mt-12 pb-1 text-center">
            <p className="text-[9px] md:text-[10px] text-slate-300 font-light tracking-widest uppercase opacity-70">
              © 2026 C'est Si Bon Family. All rights reserved.
              <span className="mx-3 opacity-30">|</span>
              Developed by <span className="hover:text-primary transition-colors cursor-help select-none" title="최아거 췍!">Junu Kim</span>
            </p>
          </footer>
        </main>
        <BottomTabBar site="gapyeong" />
      </div>
    </div>
  );
}
