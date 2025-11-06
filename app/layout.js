
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";

// ✅ โหลดฟอนต์ Google
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ✅ ข้อมูล SEO ของเว็บหลัก (ใช้กับทุกหน้า)
export const metadata = {
  title: {
    default: "Expense AI | ระบบติดตามรายจ่ายอัจฉริยะ",
    template: "%s | Expense AI",
  },
  description: "แอปจัดการรายรับรายจ่ายด้วย AI และกราฟวิเคราะห์เชิงลึก",
};

// ✅ ย้าย themeColor มาอยู่ใน viewport ตามข้อกำหนดใหม่
export const viewport = {
  themeColor: "#2563eb", // สีหลักของธีม
};

// ✅ Layout หลักของทุกหน้าในแอป
export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
