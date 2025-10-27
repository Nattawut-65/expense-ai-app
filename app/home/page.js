"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import AddItemModal from "@/components/AddItemModal";
import ScanReceiptModal from "@/components/ScanReceiptModal";
import BottomNav from "@/components/BottomNav";
import { query, where } from "firebase/firestore";
export default function HomePage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [showAIResult, setShowAIResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [error, setError] = useState(null);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [userId, setUserId] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [limits, setLimits] = useState({});
  const pickerRef = useRef(null);
  const currentRef = useRef(null);

  // 🕒 เวลาไทย
  const nowTH = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  );
  const currentMonth = nowTH.toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // 🗓️ แปลงเดือน + ปีไทย
  const formatThaiMonthShort = (monthStr) => {
    const [year, month] = monthStr.split("-");
    const monthsTH = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
    ];
    const yearTH = parseInt(year) + 543;
    return `${monthsTH[parseInt(month) - 1]} ${yearTH}`;
  };

 // ✅ โหลดข้อมูลรายรับ/รายจ่ายแบบเรียลไทม์
useEffect(() => {
  let isMounted = true;

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (!isMounted) return;

    if (!user) {
      sessionStorage.removeItem("aiResult");
      sessionStorage.removeItem("showAIResult");
      router.push("/login");
      return;
    }

    sessionStorage.setItem("skipFold", "true");

    if (isMounted) setUserId(user.uid);

    const transRef = collection(db, "transactions");
    const unsubscribeTrans = onSnapshot(transRef, (snapshot) => {
      if (!isMounted) return;

      let totalIncome = 0;
      let totalExpense = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId !== user.uid) return;
        if (data.type === "income") totalIncome += Number(data.amount) || 0;
        if (data.type === "expense") totalExpense += Number(data.amount) || 0;
      });

      setIncome(totalIncome);
      setExpense(totalExpense);
    });

    return () => unsubscribeTrans();
  });

  return () => {
    isMounted = false;
    unsubscribeAuth();
  };
}, [router]);
  // ✅ หมวดหมู่พื้นฐาน
  const baseCategories = [
    { name: "อาหาร/เครื่องดื่ม", amount: 0, icon: "🍜", color: "bg-red-500" },
    { name: "ค่าที่อยู่อาศัย/เครื่องใช้", amount: 0, icon: "🏠", color: "bg-blue-500" },
    { name: "ยานพาหนะ/การเดินทาง", amount: 0, icon: "🚗", color: "bg-yellow-500" },
    { name: "เสื้อผ้า/รองเท้า", amount: 0, icon: "👗", color: "bg-purple-500" },
    { name: "การสื่อสาร", amount: 0, icon: "📞", color: "bg-pink-500" },
    { name: "การศึกษา", amount: 0, icon: "🎓", color: "bg-green-500" },
    { name: "เวชภัณฑ์/ค่ารักษา", amount: 0, icon: "💊", color: "bg-teal-500" },
    { name: "บันเทิง", amount: 0, icon: "🎉", color: "bg-orange-500" },
    { name: "อื่นๆ", amount: 0, icon: "📦", color: "bg-gray-500" },
  ];

  const totalIncome = income > 0 ? income : 1;
  const expensePercent = Math.min(Math.round((expense / totalIncome) * 100), 100);
  const incomePercent = 100 - expensePercent;

  // ✅ ประมวลผล AI
  const handleAIProcess = async () => {
    const user = auth.currentUser;
    if (!user) {
      setError("กรุณาเข้าสู่ระบบก่อนใช้งาน AI ❌");
      return;
    }

    setLoading(true);
    setShowAIResult(false);
    setError(null);

    try {
      const q = query(
  collection(db, "transactions"),
  where("userId", "==", user.uid)
);

const snapshot = await getDocs(q);

const transactions = snapshot.docs
  .map((doc) => doc.data())
  .filter((t) => {
    // ✅ กรองเฉพาะรายการในเดือนที่เลือก
    const d = new Date(t.date.seconds ? t.date.seconds * 1000 : t.date);
    return d.toISOString().slice(0, 7) === selectedMonth;
  });

      const expenseTransactions = transactions.filter((t) => t.type === "expense");
      if (expenseTransactions.length === 0) {
        setError("ไม่มีข้อมูลรายจ่ายให้วิเคราะห์ในเดือนนี้ ❌");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          transactions: expenseTransactions,
          baseCategories: baseCategories.map((c) => c.name),
        }),
      });

      if (!res.ok) throw new Error("API error: " + res.status);
      const result = await res.json();

      const updated = baseCategories.map((cat) => {
        const aiCat = result.data?.categories?.find((c) => c.name === cat.name);
        return { ...cat, amount: aiCat?.total || 0 };
      });

      const newData = { categories: updated, advice: result.data?.advice || null };
      setAiData(newData);
      setShowAIResult(true);

      // ✅ จำผลใน sessionStorage และสถานะเปิดอยู่
      sessionStorage.setItem("aiResult", JSON.stringify({ ...newData, month: selectedMonth }));
      sessionStorage.setItem("showAIResult", "true");
    } catch (err) {
      console.error("❌ AI Error:", err);
      setError("เกิดข้อผิดพลาดในการประมวลผล AI ❌");
    } finally {
      setLoading(false);
    }
  };

 // ✅ โหลดผล AI จาก sessionStorage (แสดงต่อเมื่อกลับจากหน้าอื่น)
useEffect(() => {
  const saved = sessionStorage.getItem("aiResult");
  const showFlag = sessionStorage.getItem("showAIResult") === "true";
  const skipFold = sessionStorage.getItem("skipFold") === "true"; // 🧠 flag สำหรับ “ไม่พับ”

  if (!saved) return;
  const data = JSON.parse(saved);

  // ✅ ถ้ามี flag skipFold → แสดงผล AI เดิมทันที
  if (skipFold && showFlag) {
    setAiData({ categories: data.categories, advice: data.advice });
    setShowAIResult(true);
    return;
  }

  // ✅ ถ้าไม่มี skipFold → พับผลไว้ ต้องกดใหม่
  const isFirstOpen = sessionStorage.getItem("firstOpen") !== "false";
  if (isFirstOpen) {
    sessionStorage.setItem("firstOpen", "false");
    sessionStorage.removeItem("showAIResult");
    return;
  }

  // ✅ ถ้าอยู่ใน session เดิม (ยังไม่ปิดเว็บ)
  if (showFlag) {
    setAiData({ categories: data.categories, advice: data.advice });
    setShowAIResult(true);
  }
}, []);



  // ✅ ปิด Month Picker เมื่อคลิกนอก
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowMonthPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Scroll ไปเดือนปัจจุบัน
  useEffect(() => {
    if (showMonthPicker && currentRef.current) {
      currentRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [showMonthPicker]);

  // ✅ รวมหมวดหมู่
  const mergedCategories = () =>
    !aiData?.categories
      ? baseCategories
      : baseCategories.map((base) => {
          const aiCat = aiData.categories.find((c) => c.name === base.name);
          return aiCat ? { ...base, amount: aiCat.amount } : base;
        });

  const years = [2024, 2025, 2026, 2027, 2028].map((y) => y + 543);

  // ✅ ส่วน JSX ด้านล่างคงเดิมทั้งหมด
  return (
    <>
      <motion.main
        key="home"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -40, opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className="flex flex-col min-h-screen bg-blue-50 pb-24"
      >
        <header className="bg-blue-600 text-white px-4 py-3 font-bold text-lg flex items-center shadow-md">
          <span>ExpenseTrackingAI</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ✅ สรุปยอด */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex justify-between font-bold text-gray-800 items-center">
              <div>
                <p>รายรับทั้งหมด</p>
                <p className="text-green-600 text-xl">{income.toLocaleString()} บาท</p>
              </div>
              <div className="text-right">
                <p>รายจ่ายทั้งหมด</p>
                <p className="text-red-600 text-xl">{expense.toLocaleString()} บาท</p>
              </div>
            </div>

            <div className="w-full h-5 bg-gray-200 rounded-full mt-3 flex overflow-hidden">
              <div className="bg-green-500" style={{ width: `${incomePercent}%` }}></div>
              <div className="bg-red-500" style={{ width: `${expensePercent}%` }}></div>
            </div>

            <div className="flex justify-between mt-1 text-sm font-bold text-gray-700">
              <span>เหลือ {incomePercent}%</span>
              <span>ใช้ไป {expensePercent}%</span>
            </div>
          </div>

          {/* ✅ ปุ่ม */}
          <div className="flex space-x-3">
            <button
              onClick={() => setIsScanModalOpen(true)}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
            >
              📷 สแกนใบเสร็จ
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 border-2 border-blue-600 text-blue-600 py-3 rounded-lg font-bold bg-white hover:bg-blue-100"
            >
              ＋ เพิ่มรายการ
            </button>
          </div>

     {/* 🤖 ปุ่ม AI + เดือน (เรียบ ไม่มีกรอบเดือน อยู่ข้างขวา) */}
<div className="flex justify-center items-center mt-4" ref={pickerRef}>
  {/* ปุ่มประมวลผล AI */}
  <div className="relative flex items-center">
    <button
      onClick={handleAIProcess}
      className="bg-blue-700 text-white py-3 px-6 rounded-lg font-bold hover:bg-blue-800 shadow text-base w-[180px] text-center transition-transform active:scale-95"
    >
      🤖 ประมวลผล AI
    </button>

    {/* ปุ่ม 📅 เลือกเดือน (ไม่มีกรอบ) */}
    <div className="relative ml-2">
      <button
        onClick={() => setShowMonthPicker((prev) => !prev)}
        className="text-2xl text-blue-700 hover:text-blue-800 transition-transform active:scale-95"
        title="เลือกเดือน"
      >
        📅
      </button>

      {/* Dropdown เลือกเดือน/ปี */}
      <AnimatePresence>
        {showMonthPicker && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="absolute right-0 mt-2 w-[230px] bg-white border border-gray-200 rounded-xl shadow-lg p-3 max-h-[300px] overflow-y-auto z-50"
          >
            {years.map((yearTH) => {
              const yearAD = yearTH - 543;
              return (
                <div key={yearTH} className="mb-2">
                  <p className="font-bold text-gray-700 mb-2 text-center">{yearTH}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      "ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
                      "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.",
                    ].map((m, i) => {
                      const value = `${yearAD}-${String(i + 1).padStart(2, "0")}`;
                      const isSelected = selectedMonth === value;
                      const isCurrent = currentMonth === value;
                      return (
                        <button
                          key={m}
                          ref={isCurrent ? currentRef : null}
                          onClick={() => {
                            setSelectedMonth(value);
                            setShowMonthPicker(false);
                          }}
                          className={`py-2 rounded-lg font-bold transition-all border text-sm ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600"
                              : isCurrent
                              ? "bg-blue-100 text-blue-700 border-blue-300"
                              : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-blue-50"
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
</div>
          {/* 🌀 Loading */}
          {loading && (
            <div className="flex justify-center items-center p-6">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
              <span className="ml-3 font-bold text-gray-700">กำลังประมวลผล...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-100 text-red-600 p-3 rounded-lg text-center font-bold">
              {error}
            </div>
          )}

          {/* ✅ ผลวิเคราะห์ AI */}
{showAIResult && aiData && (
  <div className="bg-white rounded-xl shadow-md p-4">
    <p className="font-bold text-gray-800 mb-3">
      ผลวิเคราะห์ค่าใช้จ่ายเดือน {formatThaiMonthShort(selectedMonth)}
    </p>

    {(() => {
      // 🧮 หาหมวดที่เกินลิมิต
      const overLimitCats = mergedCategories()
        .filter(cat => cat.amount > (limits[cat.name] || 10000))
        .map(cat => cat.name);

      const hasOverLimit = overLimitCats.length > 0;

      // 🧠 สร้างข้อความคำแนะนำ / คำเตือน
      const adviceText = hasOverLimit
        ? `คุณใช้จ่ายฟุ่มเฟือยในหมวด ${overLimitCats.join(" / ")} กรุณาพิจารณาเพิ่มลิมิตของหมวดนี้ 💸`
        : aiData.advice;

      return (
        <ul className="space-y-4">
          {/* ✅ กล่องคำแนะนำหรือคำเตือน */}
          {aiData.advice && (
            <li
              className={`rounded-lg p-3 border ${
                hasOverLimit
                  ? "bg-red-50 border-red-300 text-red-700"
                  : "bg-green-50 border-green-200 text-green-700"
              }`}
            >
              <span className="text-2xl">
                {hasOverLimit ? "⚠️" : "💡"}
              </span>
              <p className="font-bold">
                {hasOverLimit ? "คำเตือนจาก AI" : "คำแนะนำจาก AI"}
              </p>
              <p className="text-sm">{adviceText}</p>
            </li>
          )}

          {/* ✅ รายละเอียดหมวดหมู่ */}
          {mergedCategories().map((cat, idx) => {
            const limit = limits[cat.name] || 10000;
            const percent = Math.min(Math.round((cat.amount / limit) * 100), 100);
            const overLimit = cat.amount > limit;

            return (
              <li key={idx} className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{cat.icon}</span>
                    <p className="font-bold text-gray-800">{cat.name}</p>
                  </div>

                  <div
                    className={`font-bold ${
                      overLimit ? "text-red-600" : "text-blue-600"
                    }`}
                  >
                    ฿{cat.amount.toLocaleString()} /{" "}
                    <span className="text-gray-500 text-sm">
                      {limit.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-gray-200 h-4 rounded-full overflow-hidden">
                  <div
                    className={`${
                      overLimit ? "bg-red-500" : cat.color
                    } h-4 transition-all duration-300`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>

                <p
                  className={`text-sm font-bold ${
                    overLimit ? "text-red-600" : "text-gray-600"
                  }`}
                >
                  ใช้ไป {percent}% ของงบหมวดนี้
                </p>
              </li>
            );
          })}
        </ul>
      );
    })()}
  </div>
)}

        </main>

        <AddItemModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        <ScanReceiptModal isOpen={isScanModalOpen} onClose={() => setIsScanModalOpen(false)} />
      </motion.main>

      <BottomNav />
    </>
  );
}
