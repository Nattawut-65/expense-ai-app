"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { validateAdminCredentials, createAdminSession, clearAdminSession } from "@/lib/adminAuth";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [logoClickCount, setLogoClickCount] = useState(0);
  const clickTimerRef = useRef(null);
  const router = useRouter();

  // ✅ Logo click detection - 7 clicks to go back to login
  const handleLogoClick = () => {
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);

    // Clear previous timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    // If 7 clicks, go back to login
    if (newCount === 7) {
      router.push("/login");
      setLogoClickCount(0);
      return;
    }

    // Reset counter after 2 seconds of no clicks
    clickTimerRef.current = setTimeout(() => {
      setLogoClickCount(0);
    }, 2000);
  };

  // ✅ ถ้ามี admin session อยู่แล้ว ไปหน้า admin dashboard
  useEffect(() => {
    clearAdminSession(); // ล้าง session เก่า
  }, []);

  // ✅ Admin Login (ตรวจสอบจาก Firestore)
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    
    try {
      // ตรวจสอบว่าเป็นแอดมินที่ได้รับการอนุมัติหรือไม่
      const result = await validateAdminCredentials(email, password);
      
      if (!result.success) {
        setError(result.message || "ไม่สามารถเข้าสู่ระบบได้");
        return;
      }

      // ถ้าเป็น Super Admin ให้เข้าได้เลย
      if (result.adminData.isSuperAdmin) {
        createAdminSession(result.adminData);
        router.push("/admin/dashboard");
        return;
      }

      // สำหรับแอดมินทั่วไป ต้องตรวจสอบรหัสผ่าน Firebase
      try {
        await signInWithEmailAndPassword(auth, email, password);
        // ถ้าล็อกอิน Firebase สำเร็จ ให้สร้าง admin session
        createAdminSession(result.adminData);
        router.push("/admin/dashboard");
      } catch (authError) {
        console.error("Firebase auth error:", authError);
        setError("รหัสผ่านไม่ถูกต้อง");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-500 to-purple-700">
      <div className="w-full max-w-md p-6">
        <div className="flex justify-center mb-4">
          <div 
            className={`bg-white rounded-full p-4 shadow-md cursor-pointer transition-all duration-300 ${
              logoClickCount > 0 ? 'scale-110 shadow-xl ring-4 ring-purple-300' : 'hover:scale-105'
            }`}
            onClick={handleLogoClick}
            style={{
              transform: logoClickCount > 0 ? `rotate(${logoClickCount * 51.4}deg)` : 'rotate(0deg)',
            }}
          >
            <Image src="/logo.png" alt="Logo" width={64} height={64} />
          </div>
        </div>

        {logoClickCount > 0 && (
          <p className="text-center text-white text-xs mb-2 animate-pulse">
            {logoClickCount}/7 🔓
          </p>
        )}

        <h1 className="text-center text-white font-bold text-2xl">
          ExpensetrackingAI Admin
        </h1>
        <p className="text-center text-white text-sm mt-2 opacity-90">
          ระบบจัดการรายรับรายจ่ายด้วย AI ช่วยให้คุณควบคุมการเงินได้อย่างมีประสิทธิภาพ
        </p>

        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl shadow-lg p-6 mt-6"
        >
          <h2 className="text-center text-lg font-bold mb-4 text-gray-900">
            เข้าสู่ระบบแอดมิน
          </h2>

          {error && (
            <div className="bg-red-100 text-red-600 p-2 mb-3 rounded text-sm text-center">
              {error}
            </div>
          )}

          <input
            type="email"
            placeholder="อีเมล"
            className="w-full border rounded-lg p-3 mb-4 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="relative mb-4">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="รหัสผ่าน"
              className="w-full border rounded-lg p-3 pr-10 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition"
          >
            เข้าสู่ระบบ
          </button>

          <p
            onClick={() => router.push("/forgot-password")}
            className="text-center text-purple-600 text-sm mt-3 cursor-pointer hover:underline font-medium"
          >
            ลืมรหัสผ่าน?
          </p>

          <div className="border-t my-4"></div>

          <p className="text-center text-sm mb-2 text-gray-800">ต้องการเป็นแอดมิน?</p>
          <button
            type="button"
            onClick={() => router.push("/admin/register")}
            className="w-full border-2 border-purple-600 text-purple-600 py-3 rounded-lg font-medium hover:bg-purple-50 transition flex items-center justify-center gap-2"
          >
            <span>👑</span>
            <span>สมัครเป็นแอดมิน</span>
          </button>
        </form>

        <p className="text-center text-white text-xs mt-4 opacity-70">
          © 2025 ExpenseTrackingAI. All rights reserved.
        </p>
      </div>
    </div>
  );
}
