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
  const [message, setMessage] = useState(null); // สำหรับแสดงข้อความ
  const [error, setError] = useState(null); // สำหรับแสดง error
  const router = useRouter();

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      // ✅ ตรวจว่าอีเมลนี้อยู่ในระบบไหม
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      console.log("🧩 signInMethods:", signInMethods);

      // ❌ ไม่พบในระบบเลย
      if (signInMethods.length === 0) {
        setError("❌ ไม่พบอีเมลนี้ในระบบ กรุณาตรวจสอบอีเมลของคุณอีกครั้ง");
        setLoading(false);
        return;
      }

      // ⚠️ ถ้าเป็นบัญชี Google เท่านั้น (ไม่มี password)
      if (
        signInMethods.includes("google.com") &&
        !signInMethods.includes("password")
      ) {
        setError(
          "⚠️ บัญชีนี้เข้าสู่ระบบด้วย Google เท่านั้น\nโปรดรีเซ็ตรหัสผ่านจากบัญชี Google ของคุณโดยตรง"
        );
        setLoading(false);
        return;
      }

      // ✅ ถ้าเป็น Email/Password → ส่งลิงก์รีเซ็ต
      if (signInMethods.includes("password")) {
        await sendPasswordResetEmail(auth, email);
        setMessage(
          `✅ ส่งอีเมลรีเซ็ตรหัสผ่านสำเร็จ!\n\nกรุณาตรวจสอบอีเมล ${email} และคลิกลิงก์ที่ได้รับเพื่อตั้งรหัสผ่านใหม่\n\n📧 หากไม่เห็นอีเมล กรุณาตรวจสอบในโฟลเดอร์ Spam/Junk`
        );
        
        // เปลี่ยนหน้าหลังจาก 5 วินาที
        setTimeout(() => {
          router.push("/login");
        }, 5000);
      } else {
        setError("❌ บัญชีนี้ไม่รองรับการรีเซ็ตรหัสผ่านผ่านอีเมล");
      }
    } catch (error) {
      console.error("Firebase Error:", error);
      if (error.code === "auth/invalid-email") {
        setError("❌ รูปแบบอีเมลไม่ถูกต้อง กรุณากรอกอีเมลที่ถูกต้อง");
      } else if (error.code === "auth/network-request-failed") {
        setError("⚠️ ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อ");
      } else {
        setError("⚠️ เกิดข้อผิดพลาด: " + error.message);
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
            {/* แสดงข้อความสำเร็จ */}
            {message && (
              <div className="mb-4 p-4 bg-green-50 border border-green-300 rounded-lg">
                <p className="text-sm text-green-800 whitespace-pre-line font-medium">
                  {message}
                </p>
              </div>
            )}

            {/* แสดง Error */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-lg">
                <p className="text-sm text-red-800 whitespace-pre-line font-medium">
                  {error}
                </p>
              </div>
            )}

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
              disabled={loading || message}
            />

            <button
              type="submit"
              disabled={loading || message}
              className={`w-full text-white py-3 rounded-lg font-medium transition duration-200 ${
                loading || message
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "⏳ กำลังส่งอีเมล..." : message ? "✅ ส่งอีเมลแล้ว" : "📧 ส่งลิงก์รีเซ็ตรหัสผ่าน"}
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
