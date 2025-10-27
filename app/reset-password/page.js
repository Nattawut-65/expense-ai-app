"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase"; // ✅ Firebase config
import { sendPasswordResetEmail } from "firebase/auth";
import { LockClosedIcon } from "@heroicons/react/24/solid";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  // ✅ ฟังก์ชันส่งลิงก์รีเซ็ตรหัสผ่าน
  const handleReset = async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, email);
      alert("✅ ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว");
      router.push("/login");
    } catch (error) {
      console.error("Reset error:", error);

      if (error.code === "auth/user-not-found") {
        alert("❌ ไม่พบอีเมลนี้ในระบบ");
      } else if (error.code === "auth/invalid-email") {
        alert("❌ อีเมลไม่ถูกต้อง");
      } else if (error.code === "auth/missing-android-pkg-name" || error.code === "auth/missing-continue-uri") {
        alert("⚠️ โปรดตั้งค่า Firebase Authentication → Templates → Password Reset ให้ถูกต้อง");
      } else {
        alert("⚠️ เกิดข้อผิดพลาด: " + error.message);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-500 to-blue-700">
      <div className="w-full max-w-md p-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Logo + Title */}
          <div className="flex flex-col items-center mb-4">
            <div className="bg-blue-600 rounded-full p-4 shadow-md">
              <LockClosedIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-3">
              ลืมรหัสผ่าน?
            </h1>
            <p className="text-sm text-gray-700 mt-1 text-center">
              กรอกอีเมลของคุณเพื่อรีเซ็ตรหัสผ่าน
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleReset}>
            <input
              type="email"
              placeholder="กรอกอีเมลของคุณ"
              className="w-full border rounded-lg p-3 mb-3 
                         text-gray-900 placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg 
                         font-semibold hover:bg-blue-700 transition"
            >
              ส่งลิงก์รีเซ็ตรหัสผ่าน
            </button>
          </form>

          {/* Back to login */}
          <p
            onClick={() => router.push("/login")}
            className="flex items-center justify-center text-sm 
                       text-blue-700 mt-4 cursor-pointer hover:underline font-medium"
          >
            ← กลับไปหน้าล็อกอิน
          </p>
        </div>
      </div>
    </div>
  );
}
