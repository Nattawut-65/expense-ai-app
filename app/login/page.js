"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { auth, googleProvider } from "@/lib/firebase";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { ensureUserData } from "@/lib/ensureUserData";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const clickTimerRef = useRef(null);
  const router = useRouter();

  // ✅ Logo click detection - 7 clicks to go to admin
  const handleLogoClick = () => {
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (newCount === 7) {
      router.push("/admin");
      setLogoClickCount(0);
      return;
    }

    clickTimerRef.current = setTimeout(() => {
      setLogoClickCount(0);
    }, 2000);
  };

  // ✅ ตรวจสอบ session แต่ไม่ redirect ทันที (ให้แค่รู้สถานะ)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        localStorage.setItem("isLoggedIn", "true");
      } else {
        localStorage.removeItem("isLoggedIn");
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // ✅ Email/Password Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserData(result.user);
      localStorage.setItem("isLoggedIn", "true");
      router.push("/home"); // ✅ เด้งเฉพาะตอนกด login สำเร็จ
    } catch (error) {
      console.error("Login error:", error);
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง ❌");
    }
  };

  // ✅ Google Login
  const handleGoogleLogin = async () => {
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserData(result.user);
      localStorage.setItem("isLoggedIn", "true");
      router.push("/home");
    } catch (error) {
      console.error("Google login error:", error);
      setError("ล็อกอินด้วย Google ไม่สำเร็จ ❌");
    }
  };

  // ⏳ ระหว่างตรวจ session ให้แสดง loader
  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-blue-600 text-white text-lg">
        กำลังโหลด...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-500 to-blue-700">
      <div className="w-full max-w-md p-6">
        {/* 🔹 Logo */}
        <div className="flex justify-center mb-4">
          <div
            className={`bg-white rounded-full p-4 shadow-md cursor-pointer transition-all duration-300 ${
              logoClickCount > 0
                ? "scale-110 shadow-xl ring-4 ring-blue-300"
                : "hover:scale-105"
            }`}
            onClick={handleLogoClick}
            style={{
              transform:
                logoClickCount > 0
                  ? `rotate(${logoClickCount * 51.4}deg)`
                  : "rotate(0deg)",
            }}
          >
            <Image src="/logo.png" alt="Logo" width={64} height={64} />
          </div>
        </div>

        {logoClickCount > 0 && (
          <p className="text-center text-white text-xs mb-2 animate-pulse">
            {logoClickCount}/7 🔐
          </p>
        )}

        {/* 🔹 Title */}
        <h1 className="text-center text-white font-bold text-2xl">
          ExpensetrackingAI
        </h1>
        <p className="text-center text-white text-sm mt-2 opacity-90">
          ระบบจัดการรายรับรายจ่ายด้วย AI ช่วยให้คุณควบคุมการเงินได้อย่างมีประสิทธิภาพ
        </p>

        {/* 🔹 Login Form */}
        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl shadow-lg p-6 mt-6"
        >
          <h2 className="text-center text-lg font-bold mb-4 text-gray-900">
            เข้าสู่ระบบ
          </h2>

          {error && (
            <div className="bg-red-100 text-red-600 p-2 mb-3 rounded text-sm text-center">
              {error}
            </div>
          )}

          <input
            type="email"
            placeholder="อีเมล"
            className="w-full border rounded-lg p-3 mb-4 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="relative mb-4">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="รหัสผ่าน"
              className="w-full border rounded-lg p-3 pr-10 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            เข้าสู่ระบบ
          </button>

          <p
            onClick={() => router.push("/forgot-password")}
            className="text-center text-blue-600 text-sm mt-3 cursor-pointer hover:underline font-medium"
          >
            ลืมรหัสผ่าน?
          </p>

          <div className="border-t my-4"></div>

          <p className="text-center text-sm mb-2 text-gray-800">
            ยังไม่มีบัญชี?
          </p>
          <button
            type="button"
            onClick={() => router.push("/register")}
            className="w-full border-2 border-blue-600 text-blue-600 py-3 rounded-lg font-medium hover:bg-blue-50 transition mb-3"
          >
            สมัครสมาชิก
          </button>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            <Image
              src="/google-icon.png"
              alt="Google"
              width={24}
              height={24}
              className="mr-3"
            />
            เข้าสู่ระบบด้วย Google
          </button>
        </form>

        <p className="text-center text-white text-xs mt-4 opacity-70">
          © 2025 ExpenseTrackingAI. All rights reserved.
        </p>
      </div>
    </div>
  );
}
