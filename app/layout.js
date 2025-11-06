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

// ✅ ข้อมูล SEO ของเว็บหลัก
export const metadata = {
  title: {
    default: "Expense AI | ระบบติดตามรายจ่ายอัจฉริยะ",
    template: "%s | Expense AI",
  },
  description: "แอปจัดการรายรับรายจ่ายด้วย AI และกราฟวิเคราะห์เชิงลึก",
};

// ✅ viewport + theme color (ตามมาตรฐานใหม่)
export const viewport = {
  themeColor: "#2563eb",
};

// ✅ Layout หลักของทุกหน้าในแอป
export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        {/* ✅ PWA: Manifest & App Icons */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="theme-color" content="#2563eb" />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>

        {/* ✅ Register Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/service-worker.js')
                    .then(reg => console.log('✅ Service Worker registered:', reg))
                    .catch(err => console.log('❌ Service Worker failed:', err));
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
