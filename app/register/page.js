"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection } from "firebase/firestore";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

      // ✅ เตรียม collection เดือนปัจจุบัน (สร้างอัตโนมัติ)
      const currentMonth = new Date().toISOString().slice(0, 7); // เช่น "2025-10"
      const monthRef = doc(collection(userRef, "months"), currentMonth);
      await setDoc(monthRef, {
        createdAt: new Date(),
        transactionsCount: 0,
      });

      alert("สมัครสมาชิกสำเร็จ! 🎉 กรุณาเข้าสู่ระบบ");
      router.push("/login");
    } catch (error) {
      console.error("❌ Register error:", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-500 to-blue-700">
      <div className="w-full max-w-md p-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col items-center mb-4">
            <div className="bg-blue-600 rounded-full p-4 shadow-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-12 h-12"
              >
                <circle cx="12" cy="12" r="10" fill="#2563eb" />
                <path
                  d="M12,6c1.93,0 3.5,1.57 3.5,3.5S13.93,13 12,13s-3.5,-1.57 -3.5,-3.5S10.07,6 12,6zM12,20c-2.03,0 -4.43,-0.82 -6.14,-2.88C7.55,15.8 9.68,15 12,15s4.45,0.8 6.14,2.12C16.43,19.18 14.03,20 12,20z"
                  fill="white"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-3">
              สมัครสมาชิก
            </h1>
            <p className="text-sm text-gray-600">
              กรอกข้อมูลเพื่อสร้างบัญชีใหม่
            </p>
          </div>

          {/* ✅ Form */}
          <form onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="ชื่อ-นามสกุล"
              className="w-full border rounded-lg p-3 mb-3 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <input
              type="tel"
              placeholder="เบอร์โทรศัพท์"
              className="w-full border rounded-lg p-3 mb-3 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <input
              type="email"
              placeholder="อีเมล"
              className="w-full border rounded-lg p-3 mb-3 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {/* Password */}
            <div className="relative mb-3">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
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

            {/* Confirm Password */}
            <div className="relative mb-3">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="ยืนยันรหัสผ่าน"
                className="w-full border rounded-lg p-3 pr-10 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showConfirm ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>

            <label className="flex items-center text-sm text-gray-600 mb-4">
              <input
                type="checkbox"
                className="mr-2 accent-blue-600"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              ฉันยอมรับ ข้อตกลงการใช้งาน และ นโยบายความเป็นส่วนตัว
            </label>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium transition ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
            </button>
          </form>

          <p
            onClick={() => router.push("/login")}
            className="text-center text-sm text-blue-600 mt-4 cursor-pointer hover:underline"
          >
            มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
          </p>
        </div>
      </div>
    </div>
  );
}
