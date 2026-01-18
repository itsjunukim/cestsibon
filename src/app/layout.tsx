import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

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
          <div className="flex h-screen overflow-hidden flex-col md:flex-row">
            <div className="hidden md:block h-full">
              <Sidebar />
            </div>
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <MobileNav />
              <main className="flex-1 overflow-auto p-4 md:p-8">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
