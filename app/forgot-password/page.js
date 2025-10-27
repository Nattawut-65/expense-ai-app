"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { LockClosedIcon } from "@heroicons/react/24/solid";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ✅ ตรวจว่าอีเมลนี้อยู่ในระบบไหม
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      console.log("🧩 signInMethods:", signInMethods);

      // ❌ ไม่พบในระบบเลย
      if (signInMethods.length === 0) {
        alert("❌ ไม่พบอีเมลนี้ในระบบ");
        setLoading(false);
        return;
      }

      // ⚠️ ถ้าเป็นบัญชี Google เท่านั้น (ไม่มี password)
      if (
        signInMethods.includes("google.com") &&
        !signInMethods.includes("password")
      ) {
        alert(
          "⚠️ บัญชีนี้เข้าสู่ระบบด้วย Google โปรดรีเซ็ตรหัสผ่านจากบัญชี Google ของคุณโดยตรง"
        );
        setLoading(false);
        return;
      }

      // ✅ ถ้าเป็น Email/Password → ส่งลิงก์รีเซ็ต
      if (signInMethods.includes("password")) {
        await sendPasswordResetEmail(auth, email);
        alert("✅ ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว");
        router.push("/login");
      } else {
        alert("❌ บัญชีนี้ไม่รองรับการรีเซ็ตรหัสผ่านผ่านอีเมล");
      }
    } catch (error) {
      console.error("Firebase Error:", error);
      if (error.code === "auth/invalid-email") {
        alert("❌ รูปแบบอีเมลไม่ถูกต้อง");
      } else {
        alert("⚠️ เกิดข้อผิดพลาด: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-500 to-blue-700 px-4">
      <div className="w-full max-w-md p-6">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* Logo + Title */}
          <div className="flex flex-col items-center mb-5">
            <div className="bg-blue-600 rounded-full p-4 shadow-md">
              <LockClosedIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-3">
              ลืมรหัสผ่าน?
            </h1>
            <p className="text-sm text-gray-600 text-center mt-1">
              กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleReset}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              อีเมล
            </label>
            <input
              type="email"
              placeholder="example@gmail.com"
              className="w-full border rounded-lg p-3 mb-4 
                         text-black placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white py-3 rounded-lg font-medium transition duration-200 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "กำลังตรวจสอบ..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="mx-2 text-sm text-gray-400">หรือ</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Back to login */}
          <button
            onClick={() => router.push("/login")}
            className="w-full text-blue-600 border border-blue-600 py-2 rounded-lg hover:bg-blue-50 transition text-sm font-medium"
          >
            ← กลับไปหน้าล็อกอิน
          </button>
        </div>
      </div>
    </div>
  );
}
