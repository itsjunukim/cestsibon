import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav, BottomTabBar } from "@/components/MobileNav";
import { NoticePopup } from "@/components/NoticePopup";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "쎄시봉 영업관리시스템",
  description: "Sales and Reservation Management System",
};

// Providers imported above

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased bg-background`}>
        <Providers>
          <NoticePopup />
          <div className="flex h-screen overflow-hidden flex-col md:flex-row">
            <div className="hidden md:block h-full">
              <Sidebar />
            </div>
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <MobileNav />
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
              <BottomTabBar />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
