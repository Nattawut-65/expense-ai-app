"use client";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

export default function AddItemModal({ isOpen, onClose }) {
  const [type, setType] = useState("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ ตั้งวันที่เริ่มต้นเป็นวันนี้ (แสดงเป็น พ.ศ.)
  useEffect(() => {
    if (isOpen) {
      const todayTH = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
      );
      const yyyy = todayTH.getFullYear();
      const mm = String(todayTH.getMonth() + 1).padStart(2, "0");
      const dd = String(todayTH.getDate()).padStart(2, "0");
      setDate(`${dd}/${mm}/${yyyy + 543}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 🧮 แปลงจาก พ.ศ. -> ค.ศ. ก่อนบันทึก
  const parseThaiDate = (input) => {
    const [day, month, year] = input.split("/");
    const christianYear = parseInt(year) - 543;
    return `${christianYear}-${month}-${day}`;
  };

  // ✅ ฟังก์ชันบันทึกข้อมูล (เพิ่มเวลาไทยอัตโนมัติ)
  const handleSave = async () => {
    if (!title || !amount || !date) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        alert("กรุณาเข้าสู่ระบบก่อน");
        return;
      }

      // 🕒 วันที่ + เวลาแบบไทย
      const thNow = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
      );

      const convertedDate = parseThaiDate(date);
      const [year, month, day] = convertedDate.split("-");
      const thDateTime = new Date(
        `${year}-${month}-${day}T${thNow
          .getHours()
          .toString()
          .padStart(2, "0")}:${thNow
          .getMinutes()
          .toString()
          .padStart(2, "0")}:00+07:00`
      );

      // ✅ บันทึกลง Firestore
      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        type,
        name: title,
        amount: parseFloat(amount),
        note: note || "",
        date: Timestamp.fromDate(thDateTime),
        createdAt: Timestamp.fromDate(thNow),
      });

      alert("✅ บันทึกสำเร็จ!");
      setTitle("");
      setAmount("");
      setNote("");
      setType("expense");
      onClose();
    } catch (err) {
      console.error("Error saving transaction:", err);
      alert("❌ บันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  // ✅ UI
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
      <div className="bg-white w-[92%] sm:w-96 max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 relative animate-fadeIn">
        {/* ปุ่มปิด */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 transition"
        >
          ✕
        </button>

        {/* หัวข้อ */}
        <h2 className="text-xl font-bold text-gray-900 mb-5 text-center">
          💰 บันทึกรายการใหม่
        </h2>

        {/* ปุ่มเลือกประเภท */}
        <div className="flex mb-5 bg-gray-100 rounded-lg overflow-hidden">
          <button
            onClick={() => setType("expense")}
            className={`flex-1 py-2.5 font-bold transition-all ${
              type === "expense"
                ? "bg-red-500 text-white shadow-inner"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            รายจ่าย
          </button>
          <button
            onClick={() => setType("income")}
            className={`flex-1 py-2.5 font-bold transition-all ${
              type === "income"
                ? "bg-green-500 text-white shadow-inner"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            รายรับ
          </button>
        </div>

        {/* ฟอร์ม */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              ชื่อรายการ
            </label>
            <input
              type="text"
              placeholder="เช่น ซื้อกาแฟ, ค่าน้ำมัน"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-2 border-gray-200 focus:border-blue-400 rounded-lg p-3 text-gray-800 placeholder-gray-400 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              จำนวนเงิน (บาท)
            </label>
            <input
              type="number"
              placeholder="เช่น 100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border-2 border-gray-200 focus:border-blue-400 rounded-lg p-3 text-gray-800 placeholder-gray-400 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              วันที่ (พ.ศ.)
            </label>
            <input
              type="text"
              placeholder="เช่น 18/10/2568"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border-2 border-gray-200 focus:border-blue-400 rounded-lg p-3 text-gray-800 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              หมายเหตุ (ถ้ามี)
            </label>
            <textarea
              placeholder="รายละเอียดเพิ่มเติม..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full border-2 border-gray-200 focus:border-blue-400 rounded-lg p-3 text-gray-800 placeholder-gray-400 outline-none transition"
            />
          </div>
        </div>

        {/* ปุ่มบันทึก */}
        <div className="mt-6 space-y-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : type === "expense"
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {loading ? "⏳ กำลังบันทึก..." : "💾 บันทึก"}
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg font-bold border text-gray-700 hover:bg-gray-100 transition"
          >
            ยกเลิก
          </button>
        </div>
      </div>

      {/* Animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.25s ease-in-out;
        }
      `}</style>
    </div>
  );
}
