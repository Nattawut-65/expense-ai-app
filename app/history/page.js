"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import BottomNav from "@/components/BottomNav";
import { useTheme } from "@/contexts/ThemeContext";

export default function HistoryPage() {
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("2025-10");
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    amount: "",
    note: "",
    type: "expense",
    date: "",
  });
  const [saving, setSaving] = useState(false);

  // ✅ โหลดข้อมูลจาก Firestore แบบเรียลไทม์
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError("กรุณาเข้าสู่ระบบก่อนดูประวัติ ❌");
        setLoading(false);
        return;
      }
      
      try {
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", user.uid),
          orderBy("date", "desc")
        );
        
        // ใช้ onSnapshot เพื่ออัปเดตเรียลไทม์
        const unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
          const data = querySnapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            const dateObj = d.date?.seconds
              ? new Date(d.date.seconds * 1000)
              : new Date(d.date);
            return {
              id: docSnap.id,
              name: d.name || "ไม่ระบุรายการ",
              note: d.note || "",
              amount: d.amount || 0,
              type: d.type || "expense",
              dateObj,
              date: dateObj.toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              monthStr: dateObj.toISOString().slice(0, 7),
            };
          });
          setTransactions(data);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching transactions:", error);
          setError("โหลดข้อมูลล้มเหลว ❌");
          setLoading(false);
        });
        
        return () => unsubscribeSnapshot();
      } catch (error) {
        console.error("Error setting up listener:", error);
        setError("โหลดข้อมูลล้มเหลว ❌");
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, []);

  // 🗓️ เดือนภาษาไทย
  const monthsTH = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const formatThaiMonthShort = (monthStr) => {
    const [year, month] = monthStr.split("-");
    return `${monthsTH[parseInt(month) - 1]} ${parseInt(year) + 543}`;
  };

  const filteredTransactions = transactions.filter(
    (t) => t.monthStr === selectedMonth
  );

  // ✅ ลบรายการ
  const handleDelete = async (id) => {
    if (confirm("ยืนยันการลบรายการนี้?")) {
      await deleteDoc(doc(db, "transactions", id));
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setSelectedItem(null);
      alert("ลบเรียบร้อย ✅");
    }
  };

  // ✅ เริ่มแก้ไข
  const handleEditStart = (item) => {
    const date = new Date(item.dateObj);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear() + 543;
    setEditData({
      name: item.name,
      amount: item.amount,
      note: item.note,
      type: item.type,
      date: `${dd}/${mm}/${yyyy}`,
    });
    setSelectedItem(item);
    setEditMode(true);
  };

  // 🧮 แปลงจาก พ.ศ. -> ค.ศ.
  const parseThaiDate = (input) => {
    const [day, month, year] = input.split("/");
    const christianYear = parseInt(year) - 543;
    return `${christianYear}-${month}-${day}`;
  };

  // ✅ บันทึกการแก้ไข
  const handleSaveEdit = async () => {
    if (!editData.name || !editData.amount || !editData.date) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    try {
      setSaving(true);
      const docRef = doc(db, "transactions", selectedItem.id);

      // 🕒 เวลาไทย
      const thNow = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
      );
      const convertedDate = parseThaiDate(editData.date);
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

      await updateDoc(docRef, {
        name: editData.name,
        amount: Number(editData.amount),
        note: editData.note,
        type: editData.type,
        date: Timestamp.fromDate(thDateTime),
      });

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === selectedItem.id
            ? {
                ...t,
                ...editData,
                date: thDateTime.toLocaleString("th-TH", {
                  timeZone: "Asia/Bangkok",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              }
            : t
        )
      );

      setEditMode(false);
      setSelectedItem(null);
      alert("✅ แก้ไขสำเร็จ!");
    } catch (err) {
      console.error(err);
      alert("❌ แก้ไขไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* 🔷 Header */}
      <div className={`py-3 px-5 flex items-center shadow-md ${
        theme === "dark" ? "bg-gray-800 text-white" : "bg-blue-600 text-white"
      }`}>
        <h1 className="font-bold text-lg flex items-center gap-2">📘 ประวัติ</h1>
      </div>

      {/* 🧾 Main Content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`min-h-screen pb-24 flex justify-center px-3 ${
          theme === "dark" ? "bg-gray-900" : "bg-blue-50"
        }`}
      >
        <div className={`relative w-full max-w-2xl rounded-2xl shadow-lg mt-4 p-5 ${
          theme === "dark" ? "bg-gray-800" : "bg-white"
        }`}>
          {/* ส่วนหัว */}
          <div className="flex justify-between items-center mb-2">
            <h2 className={`text-lg font-bold ${
              theme === "dark" ? "text-gray-200" : "text-gray-800"
            }`}>ประวัติรายการ</h2>
            <div className="relative">
              <button
                onClick={() => setShowMonthPicker(!showMonthPicker)}
                className={`font-bold hover:underline flex items-center gap-1 ${
                  theme === "dark" ? "text-blue-400" : "text-blue-600"
                }`}
              >
                📅 {formatThaiMonthShort(selectedMonth)}
              </button>
              <AnimatePresence>
                {showMonthPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`absolute right-0 mt-2 border rounded-xl shadow-xl p-3 z-50 w-52 max-h-[300px] overflow-y-auto ${
                      theme === "dark" ? "bg-gray-700 border-gray-600" : "bg-white border-gray-200"
                    }`}
                  >
                    {[2024, 2025, 2026].map((year) => (
                      <div key={year} className="mb-2">
                        <p className="font-bold text-gray-700 mb-1">
                          {year + 543}
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {monthsTH.map((m, i) => {
                            const val = `${year}-${String(i + 1).padStart(
                              2,
                              "0"
                            )}`;
                            return (
                              <button
                                key={m}
                                onClick={() => {
                                  setSelectedMonth(val);
                                  setShowMonthPicker(false);
                                }}
                                className={`py-1.5 rounded-lg font-bold text-sm border ${
                                  selectedMonth === val
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-blue-50"
                                }`}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Loading/Error/Empty */}
          {loading && (
            <p className="text-center text-gray-500 animate-pulse">
              กำลังโหลดข้อมูล...
            </p>
          )}
          {error && (
            <p className="text-center text-red-600 font-bold bg-red-50 p-2 rounded-lg">
              {error}
            </p>
          )}
          {!loading && filteredTransactions.length === 0 && (
            <p className="text-center text-gray-500 mt-6">
              ไม่มีรายการในเดือนนี้
            </p>
          )}

          {/* 💰 รายการ */}
          <div className="mt-2">
            {filteredTransactions.map((item) => {
              const isOpen = selectedItem?.id === item.id;
              return (
                <motion.div
                  key={item.id}
                  layout
                  transition={{ layout: { duration: 0.3, type: "spring" } }}
                  className={`overflow-hidden rounded-xl mb-2 shadow-sm border ${
                    isOpen
                      ? "border-blue-300 bg-blue-50"
                      : "border-transparent hover:bg-blue-50"
                  }`}
                >
                  <div
                    className="py-3 flex justify-between items-center px-3 cursor-pointer select-none"
                    onClick={() => setSelectedItem(isOpen ? null : item)}
                  >
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{item.name}</p>
                      {item.note && (
                        <p className="text-gray-600 text-sm mt-1">
                          📝 {item.note}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{item.date}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <p
                        className={`text-lg font-bold ${
                          item.type === "income"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {item.type === "income"
                          ? `+${item.amount.toLocaleString()}`
                          : `-${item.amount.toLocaleString()}`}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        {isOpen ? "▲" : "▼"}
                      </p>
                    </div>
                  </div>

                  {/* ปุ่ม */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="px-3 pb-3"
                      >
                        <div className="flex gap-3 mt-1">
                          <button
                            onClick={() => handleEditStart(item)}
                            className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition"
                          >
                            ✏️ แก้ไข
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition"
                          >
                            🗑️ ลบ
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.main>

      {/* ✏️ Modal แก้ไข */}
      <AnimatePresence>
        {editMode && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25 }}
              className="bg-white w-[92%] sm:w-96 max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 relative animate-fadeIn"
            >
              {/* ปุ่มปิด */}
              <button
                onClick={() => setEditMode(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 transition"
              >
                ✕
              </button>

              <h2 className="text-xl font-bold text-gray-900 mb-5 text-center">
                ✏️ แก้ไขรายการ
              </h2>

              {/* ปุ่มประเภท */}
              <div className="flex mb-5 bg-gray-100 rounded-lg overflow-hidden">
                <button
                  onClick={() =>
                    setEditData((prev) => ({ ...prev, type: "expense" }))
                  }
                  className={`flex-1 py-2.5 font-bold transition-all ${
                    editData.type === "expense"
                      ? "bg-red-500 text-white shadow-inner"
                      : "text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  รายจ่าย
                </button>
                <button
                  onClick={() =>
                    setEditData((prev) => ({ ...prev, type: "income" }))
                  }
                  className={`flex-1 py-2.5 font-bold transition-all ${
                    editData.type === "income"
                      ? "bg-green-500 text-white shadow-inner"
                      : "text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  รายรับ
                </button>
              </div>

              {/* ฟอร์มแก้ไข */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    ชื่อรายการ
                  </label>
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) =>
                      setEditData({ ...editData, name: e.target.value })
                    }
                    className="w-full border-2 border-gray-200 focus:border-blue-400 rounded-lg p-3 text-gray-800 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    จำนวนเงิน (บาท)
                  </label>
                  <input
                    type="number"
                    value={editData.amount}
                    onChange={(e) =>
                      setEditData({ ...editData, amount: e.target.value })
                    }
                    className="w-full border-2 border-gray-200 focus:border-blue-400 rounded-lg p-3 text-gray-800 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    วันที่ (พ.ศ.)
                  </label>
                  <input
                    type="text"
                    value={editData.date}
                    onChange={(e) =>
                      setEditData({ ...editData, date: e.target.value })
                    }
                    placeholder="เช่น 19/10/2568"
                    className="w-full border-2 border-gray-200 focus:border-blue-400 rounded-lg p-3 text-gray-800 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    หมายเหตุ
                  </label>
                  <textarea
                    value={editData.note}
                    onChange={(e) =>
                      setEditData({ ...editData, note: e.target.value })
                    }
                    rows={2}
                    className="w-full border-2 border-gray-200 focus:border-blue-400 rounded-lg p-3 text-gray-800 outline-none transition"
                  />
                </div>
              </div>

              {/* ปุ่มบันทึก */}
              <div className="mt-6 space-y-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition ${
                    saving
                      ? "bg-gray-400 cursor-not-allowed"
                      : editData.type === "expense"
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-green-500 hover:bg-green-600"
                  }`}
                >
                  {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึก"}
                </button>

                <button
                  onClick={() => setEditMode(false)}
                  className="w-full py-3 rounded-lg font-bold border text-gray-700 hover:bg-gray-100 transition"
                >
                  ยกเลิก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BottomNav />
    </>
  );
}
