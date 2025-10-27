"use client";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, BarChart2, FileText, Settings } from "lucide-react";
import { useState } from "react";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [transitioning, setTransitioning] = useState(false);

  const tabs = [
    { name: "หน้าหลัก", icon: Home, path: "/home" },
    { name: "รายงาน", icon: BarChart2, path: "/report" },
    { name: "ประวัติ", icon: FileText, path: "/history" },
    { name: "ตั้งค่า", icon: Settings, path: "/settings" },
  ];

  const handleNav = (path) => {
    if (pathname === path) return;
    if ("vibrate" in navigator) navigator.vibrate(20); // ✅ สั่นเบา ๆ เหมือนมือถือ

    // ✅ เริ่มเล่น animation fade ก่อนเปลี่ยนหน้า
    setTransitioning(true);
    setTimeout(() => {
      router.push(path);
      setTimeout(() => setTransitioning(false), 400);
    }, 120);
  };

  return (
    <>
      {/* ✅ Overlay fade เหมือน LINE transition, ไม่เด้ง layout */}
      <AnimatePresence>
        {transitioning && (
          <motion.div
            key="transition"
            className="fixed inset-0 bg-white z-[40] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* ✅ Bottom Navigation (Smooth + Fixed) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-1px_8px_rgba(0,0,0,0.06)] flex justify-around py-2 z-50">
        {tabs.map(({ name, icon: Icon, path }) => {
          const isActive = pathname === path;

          return (
            <motion.button
              key={path}
              whileTap={{ scale: 0.92 }}
              onClick={() => handleNav(path)}
              className="flex flex-col items-center justify-center w-full"
            >
              <motion.div
                animate={{
                  scale: isActive ? 1.12 : 1,
                  y: isActive ? -2 : 0, // ✅ ยกขึ้นเล็กน้อย (ไม่ชนขอบ)
                }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                }}
                className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-transparent text-gray-700 hover:text-blue-600"
                }`}
              >
                <Icon
                  size={22}
                  color={isActive ? "#ffffff" : "#1f2937"}
                  strokeWidth={2.2}
                />
                <span
                  className={`text-[11px] font-semibold mt-0.5 ${
                    isActive ? "text-white" : "text-gray-700"
                  }`}
                >
                  {name}
                </span>
              </motion.div>
            </motion.button>
          );
        })}
      </nav>
    </>
  );
}
