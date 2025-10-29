"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, addDoc } from "firebase/firestore";

export default function AdminRegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reason, setReason] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      alert("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      alert("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (!reason.trim()) {
      alert("กรุณากรอกเหตุผลที่ต้องการเป็นแอดมิน");
      return;
    }
    if (!agree) {
      alert("กรุณายอมรับข้อตกลงก่อนสมัครสมาชิก");
      return;
    }

    try {
      setLoading(true);

      // ✅ สมัครสมาชิกด้วย Firebase Authentication
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // ✅ บันทึกข้อมูลผู้ใช้ใหม่ใน Firestore
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        name: name,
        phone: phone,
        email: email,
        income: 0,
        budget: 0,
        createdAt: new Date(),
      });

      // ✅ เตรียม collection เดือนปัจจุบัน
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthRef = doc(collection(userRef, "months"), currentMonth);
      await setDoc(monthRef, {
        createdAt: new Date(),
        transactionsCount: 0,
      });

      // ✅ ส่งคำขอเป็นแอดมิน
      const adminRequestsRef = collection(db, "adminRequests");
      await addDoc(adminRequestsRef, {
        userId: user.uid,
        userEmail: email,
        userName: name,
        reason: reason.trim(),
        createdAt: new Date(),
        status: "pending"
      });

      alert("สมัครสมาชิกสำเร็จ! 🎉\nส่งคำขอเป็นแอดมินเรียบร้อย 👑\nรอการอนุมัติจากแอดมิน");
      router.push("/admin");
    } catch (error) {
      console.error("❌ Register error:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("❌ อีเมลนี้ถูกใช้งานแล้ว\nกรุณาใช้อีเมลอื่น หรือเข้าสู่ระบบด้วยอีเมลนี้");
      } else if (error.code === 'auth/invalid-email') {
        alert("❌ รูปแบบอีเมลไม่ถูกต้อง");
      } else if (error.code === 'auth/weak-password') {
        alert("❌ รหัสผ่านอ่อนแอเกินไป\nกรุณาใช้รหัสผ่านที่แข็งแกร่งกว่านี้");
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + (error.message || "กรุณาลองใหม่อีกครั้ง"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-500 to-purple-700">
      <div className="w-full max-w-md p-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col items-center mb-4">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-full p-4 shadow-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-12 h-12"
              >
                <circle cx="12" cy="12" r="10" fill="white" opacity="0.3" />
                <path
                  d="M12,6c1.93,0 3.5,1.57 3.5,3.5S13.93,13 12,13s-3.5,-1.57 -3.5,-3.5S10.07,6 12,6zM12,20c-2.03,0 -4.43,-0.82 -6.14,-2.88C7.55,15.8 9.68,15 12,15s4.45,0.8 6.14,2.12C16.43,19.18 14.03,20 12,20z"
                  fill="white"
                />
                <text x="12" y="8" fontSize="6" fill="gold" textAnchor="middle">👑</text>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-purple-600 mt-3">
              👑 สมัครเป็นแอดมิน
            </h1>
            <p className="text-sm text-gray-600">
              กรอกข้อมูลเพื่อสร้างบัญชีและส่งคำขอเป็นแอดมิน
            </p>
          </div>

          {/* ✅ Form */}
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อ-นามสกุล
              </label>
              <input
                type="text"
                className="w-full border rounded-lg p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="กรอกชื่อ-นามสกุล"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เบอร์โทรศัพท์
              </label>
              <input
                type="tel"
                className="w-full border rounded-lg p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="กรอกเบอร์โทรศัพท์"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                อีเมล
              </label>
              <input
                type="email"
                className="w-full border rounded-lg p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                รหัสผ่าน
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full border rounded-lg p-3 pr-10 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ยืนยันรหัสผ่าน
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  className="w-full border rounded-lg p-3 pr-10 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500"
                >
                  {showConfirm ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-700 mb-1">
                👑 เหตุผลที่ต้องการเป็นแอดมิน
              </label>
              <textarea
                className="w-full border-2 border-purple-300 rounded-lg p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="กรุณาระบุเหตุผลที่ต้องการเป็นแอดมิน..."
                rows="4"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="agree"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="w-4 h-4 accent-purple-600"
              />
              <label htmlFor="agree" className="text-sm text-gray-700">
                ฉันยอมรับ{" "}
                <span className="text-purple-600 font-medium cursor-pointer hover:underline">
                  ข้อตกลงและเงื่อนไข
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิกและส่งคำขอ 👑"}
            </button>

            <p className="text-center text-sm text-gray-600">
              มีบัญชีอยู่แล้ว?{" "}
              <span
                onClick={() => router.push("/admin")}
                className="text-purple-600 font-medium cursor-pointer hover:underline"
              >
                เข้าสู่ระบบแอดมิน
              </span>
            </p>
          </form>
        </div>

        <p className="text-center text-white text-xs mt-4 opacity-70">
          © 2025 ExpenseTrackingAI. All rights reserved.
        </p>
      </div>
    </div>
  );
}
