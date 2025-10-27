"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
   BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function ReportPage() {
  // ✅ ตัวแปรสถานะทั้งหมด
  const [data, setData] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [viewType, setViewType] = useState("expense");
  const [chartMode, setChartMode] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0); // ✅ สำหรับปัดซ้าย/ขวา
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [activeTab, setActiveTab] = useState("report"); // 🔹 บรรทัดนี้เพิ่มหลัง export
  const [realtimeCategories, setRealtimeCategories] = useState([]); // ✅ เพิ่มใหม่


 // ✅ โหลดข้อมูลจาก Firebase
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    setLoading(true);

    try {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);

      const q = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        where("date", ">=", Timestamp.fromDate(startOfYear)),
        where("date", "<=", Timestamp.fromDate(endOfYear))
      );

      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map((doc) => doc.data());
      setAllTransactions(transactions);

      if (chartMode === "daily") generateDailyData(transactions);
      else if (chartMode === "weekly") generateWeeklyData(transactions);
      else generateMonthlyData(transactions);
    } catch (err) {
      console.error("Firebase error:", err);
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  });

  return () => unsubscribe();
}, [chartMode, weekOffset]);
  // ✅ ตรวจเปลี่ยนเดือนอัตโนมัติ
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getMonth() !== currentMonth) {
        setCurrentMonth(now.getMonth());
        setWeekOffset(0);
      }
    }, 86400000);
    return () => clearInterval(interval);
  }, [currentMonth]);

  // ✅ สร้างข้อมูลรายวัน
  // ✅ สร้างข้อมูลรายวัน (อิงตามสัปดาห์จริง: อาทิตย์–เสาร์)
const generateDailyData = (transactions) => {
  const dayNames = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสฯ", "ศุกร์", "เสาร์"];
  const today = new Date();

  // 🗓 หาวันอาทิตย์แรกของสัปดาห์ (อาทิตย์ = 0)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  startOfWeek.setHours(0, 0, 0, 0);

  // 🗓 วันเสาร์สุดท้ายของสัปดาห์
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // ✅ รวมข้อมูลแต่ละวันในช่วงอาทิตย์–เสาร์
  const daily = dayNames.map((day, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);

    const dayTransactions = transactions.filter((t) => {
      const d = t.date?.toDate?.() || new Date(t.date);
      return (
        d >= startOfWeek &&
        d <= endOfWeek &&
        d.getDay() === date.getDay()
      );
    });

    const income = dayTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = dayTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    return { label: day, income, expense };
  });

  setData(daily);

  // ✅ log สำหรับเช็กช่วงสัปดาห์ใน console
  console.log(
    `📅 ช่วงสัปดาห์ (รายวัน): ${startOfWeek.toLocaleDateString("th-TH")} – ${endOfWeek.toLocaleDateString("th-TH")}`
  );
};


  // ✅ สร้างข้อมูลรายสัปดาห์ (อิงสัปดาห์จริง อาทิตย์–เสาร์)
const generateWeeklyData = (transactions) => {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  // 🔹 หาวันแรกและวันสุดท้ายของเดือนนี้
  const startOfMonth = new Date(thisYear, thisMonth, 1);
  const endOfMonth = new Date(thisYear, thisMonth + 1, 0);
  const weeks = [];

  // 🔹 หาวันอาทิตย์แรกที่อยู่ก่อนหรือเท่ากับวันแรกของเดือน
  let currentStart = new Date(startOfMonth);
  currentStart.setDate(
    startOfMonth.getDate() - startOfMonth.getDay()
  );
  currentStart.setHours(0, 0, 0, 0);

  // 🔹 วนจนถึงวันสุดท้ายของเดือน (สัปดาห์ละ 7 วัน)
  let weekCount = 1;
  while (currentStart <= endOfMonth) {
    const weekEnd = new Date(currentStart);
    weekEnd.setDate(currentStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // ✅ คัดธุรกรรมในช่วงอาทิตย์–เสาร์นี้
    const weekTransactions = transactions.filter((t) => {
      const d = t.date?.toDate?.() || new Date(t.date);
      return d >= currentStart && d <= weekEnd;
    });

    const income = weekTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = weekTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    weeks.push({
      label: `สัปดาห์ที่ ${weekCount}`,
      income,
      expense,
    });

    // ขยับไปสัปดาห์ถัดไป
    currentStart.setDate(currentStart.getDate() + 7);
    weekCount++;
  }

  // ✅ debug ดูช่วงวันแต่ละสัปดาห์ใน console
  console.log("📅 Weekly breakdown (อาทิตย์–เสาร์):");
  weeks.forEach((w, i) => {
    console.log(
      `${w.label}: ${new Date(
        thisYear,
        thisMonth,
        1 + i * 7
      ).toLocaleDateString("th-TH")} - ${new Date(
        thisYear,
        thisMonth,
        1 + i * 7 + 6
      ).toLocaleDateString("th-TH")}`
    );
  });

  setData(weeks);
};



  // ✅ สร้างข้อมูลรายเดือน
  const generateMonthlyData = (transactions) => {
    const months = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
    ];

    const monthly = months.map((m, i) => ({
      label: m,
      income: 0,
      expense: 0,
      monthIndex: i,
    }));

    transactions.forEach((t) => {
      const dateObj = t.date?.toDate?.() || new Date(t.date);
      const monthIndex = dateObj.getMonth();
      if (t.type === "income") monthly[monthIndex].income += t.amount;
      else if (t.type === "expense") monthly[monthIndex].expense += t.amount;
    });

    setData(monthly);
  };

  // ✅ ปัดซ้าย/ขวาเพื่อเปลี่ยนสัปดาห์
  const handleWeekSwipe = (direction) => {
    setWeekOffset((prev) => {
      if (direction === "left" && prev > -4) return prev - 1;
      if (direction === "right" && prev < 0) return prev + 1;
      return prev;
    });
  };

  return (
    <>
      <motion.main
        key="report"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -40, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex flex-col min-h-screen bg-white text-gray-800 pb-24"
      >
        {/* ✅ Header */}
        <header className="bg-blue-600 text-white px-4 py-3 font-bold text-lg flex items-center shadow-md">
          <span>📊 รายงาน</span>
        </header>

    {/* ✅ ปุ่มสลับหน้า */}
<div className="flex justify-start p-3 border-b border-gray-200 bg-white">
  <div className="flex gap-2">
    <button
      onClick={() => setActiveTab("report")}
      className={`px-3 py-1 rounded font-bold ${
        activeTab === "report"
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-blue-700"
      }`}
    >
      รายงาน
    </button>

    <button
      onClick={() => setActiveTab("trend")}
      className={`px-3 py-1 rounded font-bold ${
        activeTab === "trend"
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-blue-700"
      }`}
    >
      แนวโน้ม
    </button>
  </div>
</div>


       {/* ✅ ส่วนกราฟ */}
<section className="p-4">
  {activeTab === "report" ? (
    <>
      {/* 🔹 ทั้งบล็อกที่คุณแปะมาทั้งหมด (BarChart) วางไว้ตรงนี้ */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-blue-700">
          {chartMode === "daily"
            ? "รายรับ–รายจ่ายรายวัน"
            : chartMode === "weekly"
            ? "รายรับ–รายจ่ายรายสัปดาห์"
            : "รายรับ–รายจ่ายรายเดือน"}
        </h3>

        {/* ✅ ปุ่มสลับโหมดกราฟ */}
        <div className="flex gap-2">
          {["daily", "weekly", "monthly"].map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setChartMode(mode);
                setSelectedDay(null);
                setSelectedWeek(null);
                setSelectedMonth(null);
                setShowDetails(false);
              }}
              className={`px-3 py-1 text-sm font-semibold rounded-full ${
                chartMode === mode
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {mode === "daily"
                ? "รายวัน"
                : mode === "weekly"
                ? "รายสัปดาห์"
                : "รายเดือน"}
            </button>
          ))}
        </div>
      </div>

      {/* ✅ กราฟหลัก */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
        {loading ? (
          <p className="text-gray-500 text-center">กำลังโหลดข้อมูล...</p>
        ) : error ? (
          <p className="text-red-500 text-center">{error}</p>
        ) : (
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(e, info) => {
              if (chartMode === "daily") {
                if (info.offset.x > 80) handleWeekSwipe("left");
                else if (info.offset.x < -80) handleWeekSwipe("right");
              }
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.25 }}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data}
                onClick={(e) => {
                  if (chartMode === "daily" && e?.activeLabel) {
                    setSelectedDay(e.activeLabel);
                    setShowDetails(true);
                  } else if (chartMode === "weekly" && e?.activeLabel) {
                    const weekNum = parseInt(e.activeLabel.replace(/\D/g, ""));
                    setSelectedWeek(weekNum);
                    setShowDetails(true);
                  } else if (chartMode === "monthly" && e?.activeLabel) {
                    const monthIndex = data.findIndex(
                      (d) => d.label === e.activeLabel
                    );
                    setSelectedMonth(monthIndex);
                    setShowDetails(true);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="expense" fill="#ef4444" name="รายจ่าย" />
                <Bar dataKey="income" fill="#22c55e" name="รายรับ" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>
    </>
  ) : (
    <>
      {/* ✅ หน้าของแนวโน้ม */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-4">
        <h3 className="font-bold mb-2">แนวโน้มรายรับ–รายจ่ายรายเดือน</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
  data={(() => {
    const months = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
    ];

    // ✅ รวมรายรับ-รายจ่ายจริงต่อเดือนจาก allTransactions
    return months.map((m, i) => {
      const monthTransactions = allTransactions.filter((t) => {
        const d = t.date?.toDate?.() || new Date(t.date);
        return d.getMonth() === i;
      });

      const income = monthTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

      const expense = monthTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      return { name: m, income, expense };
    });
  })()}
>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#22c55e" name="รายรับ" />
            <Line type="monotone" dataKey="expense" stroke="#ef4444" name="รายจ่าย" />
          </LineChart>
        </ResponsiveContainer>
      </div>

{/* ✅ พายชาร์ต + หมวดหมู่ที่ใช้เยอะสุดในเดือน */}
<div className="relative bg-white rounded-2xl shadow-lg 
  p-4 sm:p-6 md:p-10 mt-4 w-full max-w-full mx-auto 
  min-h-[auto] md:min-h-[720px]">

  {/* 🔹 Layout Responsive: มือถือเรียงลง / คอมแบ่งครึ่ง */}
  <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-16">

    {/* 🔹 ซ้าย: พายชาร์ต */}
    <div className="flex flex-col items-center justify-center w-full md:w-1/2">
      <h3 className="text-lg md:text-xl font-bold text-blue-800 text-center mb-4">
        รายจ่ายหมวดหมู่
      </h3>

      {/* ✅ กล่องกรอบกราฟ */}
      <div className="w-full flex justify-center">
        <div className="bg-gray-50 border border-gray-200 rounded-xl shadow-sm 
                        w-full max-w-[420px] md:max-w-[600px] aspect-[4/3]
                        flex flex-col justify-center items-center p-4 relative">

          <ResponsiveContainer 
  width="100%" 
  height={window.innerWidth < 640 ? 250 : 400}
>
  <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>

              <Pie
                data={(() => {
                  const saved = sessionStorage.getItem("aiResult");
                  const categoryMap = {
                    "อาหาร/เครื่องดื่ม": { icon: "🍜", color: "#ef4444" },
                    "ค่าที่อยู่อาศัย/เครื่องใช้": { icon: "🏠", color: "#3b82f6" },
                    "ยานพาหนะ/การเดินทาง": { icon: "🚗", color: "#eab308" },
                    "เสื้อผ้า/รองเท้า": { icon: "👗", color: "#a855f7" },
                    "การสื่อสาร": { icon: "📞", color: "#ec4899" },
                    "การศึกษา": { icon: "🎓", color: "#22c55e" },
                    "เวชภัณฑ์/ค่ารักษา": { icon: "💊", color: "#14b8a6" },
                    "บันเทิง": { icon: "🎉", color: "#f97316" },
                    "อื่นๆ": { icon: "📦", color: "#6b7280" },
                  };

                  let categories = [];

                  // ✅ ถ้ามีข้อมูลจาก AI
                  if (saved) {
                    const aiData = JSON.parse(saved);
                    if (aiData?.categories?.length > 0) {
                      categories = aiData.categories
                        .map((c) => ({
                          name: c.name,
                          icon: categoryMap[c.name]?.icon || "📦",
                          color: categoryMap[c.name]?.color || "#6b7280",
                          value: c.amount,
                        }))
                        .filter((c) => c.value > 0); // ✅ กรองหมวด 0
                    }
                  }

                  // ✅ ถ้าไม่มีข้อมูลจาก AI ใช้ Firestore
                  if (categories.length === 0) {
                    const now = new Date();
                    const thisMonth = now.getMonth();
                    const thisYear = now.getFullYear();
                    const categoryTotals = {};

                    allTransactions.forEach((t) => {
                      const d = t.date?.toDate?.() || new Date(t.date);
                      if (
                        t.type === "expense" &&
                        d.getMonth() === thisMonth &&
                        d.getFullYear() === thisYear
                      ) {
                        const cat = t.category || "อื่นๆ";
                        categoryTotals[cat] =
                          (categoryTotals[cat] || 0) + t.amount;
                      }
                    });

                    const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

                    categories = Object.entries(categoryTotals)
                      .map(([name, value]) => ({
                        name,
                        icon: categoryMap[name]?.icon || "📦",
                        color: categoryMap[name]?.color || "#6b7280",
                        value,
                        percent: total ? (value / total) * 100 : 0,
                      }))
                      .filter((c) => c.value > 0) // ✅ ไม่แสดงหมวด 0
                      .sort((a, b) => b.value - a.value);
                  }

                  return categories;
                })()}
                dataKey="value"
                nameKey="name"
                outerRadius="80%"
                label={({ payload, percent }) =>
                  `${payload.icon} ${(percent * 100).toFixed(1)}%`
                }
              >
                {[
                  "#ef4444", "#3b82f6", "#eab308", "#a855f7",
                  "#ec4899", "#22c55e", "#14b8a6", "#f97316", "#6b7280",
                ].map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Pie>

              <Tooltip
                formatter={(value, name, props) => [
                  `${value.toLocaleString()} บาท`,
                  `${props.payload.icon || "📦"} ${props.payload.name}`,
                ]}
                contentStyle={{
                  fontSize: "0.85rem",
                  borderRadius: "8px",
                  padding: "6px 10px",
                }}
              />

              {/* ✅ Legend กลางล่างแบบสวย */}
             <Legend
  verticalAlign="bottom"
  align="center"
  wrapperStyle={{
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: "6px",
    fontSize: "14px",
    width: "100%",
    paddingBottom: "8px",
    position: "relative",
  }}
  iconSize={12}
  formatter={(value, entry) => `${entry?.payload?.icon || ""}`}
/>

              
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>

    {/* 🔹 ขวา: หมวดหมู่ที่ใช้เยอะสุดในเดือน */}
<div className="flex flex-col items-center w-full md:w-1/2 text-center">
  <h3 className="text-lg md:text-xl font-bold mb-4 text-blue-800">
    หมวดหมู่ที่ใช้เยอะสุดในเดือนนี้
  </h3>
  {(() => {
    // ✅ ใช้ข้อมูลเดียวกับ PieChart
    const saved = sessionStorage.getItem("aiResult");
    let categories = [];

    if (saved) {
      const aiData = JSON.parse(saved);
      if (aiData?.categories?.length > 0) {
        categories = aiData.categories
          .map((c) => ({
            name: c.name,
            icon: c.icon || "📦",
            value: c.amount || c.value || 0,
          }))
          .sort((a, b) => b.value - a.value);
      }
    }

    // ✅ ถ้าไม่มีข้อมูลจาก AI → ใช้ Firestore
    if (categories.length === 0) {
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      const categoryTotals = {};

      allTransactions.forEach((t) => {
        const d = t.date?.toDate?.() || new Date(t.date);
        if (t.type === "expense" && d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
          const cat = t.category || "อื่นๆ";
          categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
        }
      });

      categories = Object.entries(categoryTotals)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    }

    if (categories.length === 0)
      return <p className="text-gray-500 mt-4">ไม่มีข้อมูลรายจ่ายในเดือนนี้</p>;

    // ✅ แสดงลิสต์หมวดจากมากไปน้อย
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 md:p-5 w-full max-w-[380px] md:max-w-[420px]">
        {categories.map((cat, i) => (
          <div
            key={cat.name}
            className={`flex justify-between items-center py-1 ${
              i === 0 ? "font-bold text-red-600" : "text-gray-700"
            }`}
          >
            <span className="flex items-center">
              <span className="text-gray-400 mr-2">{i + 1}.</span>
              {cat.icon} {cat.name}
            </span>
<span className="text-sm text-gray-600">
  {cat.value.toLocaleString()} บาท{" "}
  <span className="text-gray-400 font-medium">
    ({((cat.value / categories.reduce((a, b) => a + b.value, 0)) * 100).toFixed(1)}%)
  </span>
</span>

          </div>
        ))}
      </div>
    );
  })()}
</div>

  </div>
</div>

    </>
  )}
</section>

 {/* ✅ แสดงสัปดาห์ + เดือน + ปีไทย (เดือนเปลี่ยนตาม weekOffset จริง) */}
{activeTab === "report" && (chartMode === "daily" || chartMode === "weekly") && (
  <div className="text-center text-sm text-gray-600 mt-3">
    {(() => {
      // ✅ วันที่อ้างอิงจากสัปดาห์ปัจจุบัน + การปัด (weekOffset)
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + weekOffset * 7);

      // ✅ จำกัดช่วงปัดได้สูงสุด ±70 สัปดาห์ (~1 ปี 4 เดือน)
      if (weekOffset > 70) setWeekOffset(70);
      if (weekOffset < -70) setWeekOffset(-70);

      // ✅ เดือน + ปีไทย
      const monthNames = [
        "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
        "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
      ];
      const monthName = monthNames[baseDate.getMonth()];
      const thaiYear = baseDate.getFullYear() + 543;

      // ✅ หาสัปดาห์ที่อยู่ในเดือนนั้นจริง (1–5)
      const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      const dayOfMonth = baseDate.getDate();
      const weekOfMonth = Math.floor((dayOfMonth + firstDay.getDay() - 1) / 7) + 1;

      // ✅ แสดงผล
      return (
        <>
          <p>📅 สัปดาห์ที่ {weekOfMonth}</p>
          <p className="text-gray-400 text-xs mt-1">
            {monthName} {thaiYear}
          </p>
        </>
      );
    })()}
  </div>
)}

       {/* ✅ รายละเอียดเมื่อกดแท่งกราฟ (แสดงเฉพาะหน้า "รายงาน") */}
{activeTab === "report" && showDetails && (
  <motion.section
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="overflow-hidden px-4"
          >
            <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-xl shadow-md p-5 mb-6">
              <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
                <h3 className="text-lg font-bold text-blue-700">
                  {chartMode === "daily"
                    ? `รายการของวัน (${selectedDay})`
                    : chartMode === "weekly"
                    ? `รายการของสัปดาห์ที่ ${selectedWeek}`
                    : `รายการของเดือน ${
                        selectedMonth !== null
                          ? [
                              "มกราคม",
                              "กุมภาพันธ์",
                              "มีนาคม",
                              "เมษายน",
                              "พฤษภาคม",
                              "มิถุนายน",
                              "กรกฎาคม",
                              "สิงหาคม",
                              "กันยายน",
                              "ตุลาคม",
                              "พฤศจิกายน",
                              "ธันวาคม",
                            ][selectedMonth]
                          : ""
                      }`}
                </h3>

                {/* ✅ ปุ่มพับเก็บ */}
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full text-sm font-semibold transition"
                >
                   ▲
                </button>
              </div>

              {/* ✅ ปุ่มสลับรายรับ/รายจ่าย */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setViewType("expense")}
                  className={`px-5 py-2 rounded-full text-sm font-semibold ${
                    viewType === "expense"
                      ? "bg-red-500 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  รายจ่าย
                </button>
                <button
                  onClick={() => setViewType("income")}
                  className={`px-5 py-2 rounded-full text-sm font-semibold ${
                    viewType === "income"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  รายรับ
                </button>
              </div>

             {/* ✅ รายการธุรกรรม */}
{allTransactions.length === 0 ? (
  <p className="text-gray-500 text-center py-4">
    ไม่มีข้อมูลในช่วงนี้
  </p>
) : (
  <div className="divide-y divide-blue-100">
    {allTransactions
      .filter((t) => {
        if (chartMode === "daily" && selectedDay) {
          const dayNames = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสฯ","ศุกร์","เสาร์"];
          const dateObj = t.date?.toDate?.() || new Date(t.date);

          const today = new Date();
          const currentDay = today.getDay();
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - currentDay + weekOffset * 7);
          startOfWeek.setHours(0, 0, 0, 0);

          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);

          return (
            dateObj >= startOfWeek &&
            dateObj <= endOfWeek &&
            dayNames[dateObj.getDay()] === selectedDay &&
            t.type === viewType
          );
      } else if (chartMode === "weekly" && selectedWeek && t.type === viewType) {
  const dateObj = t.date?.toDate?.() || new Date(t.date);

  // 🔹 เดือนและปีของธุรกรรม
  const thisMonth = dateObj.getMonth();
  const thisYear = dateObj.getFullYear();

  // 🔹 วันแรกของเดือน
  const startOfMonth = new Date(thisYear, thisMonth, 1);

  // 🔹 หาวันอาทิตย์แรกของเดือน (ก่อนหรือเท่ากับวันที่ 1)
  const firstSunday = new Date(startOfMonth);
  firstSunday.setDate(startOfMonth.getDate() - startOfMonth.getDay());
  firstSunday.setHours(0, 0, 0, 0);

  // 🔹 เริ่มต้นสัปดาห์ที่เลือก (อาทิตย์–เสาร์)
  const startOfWeek = new Date(firstSunday);
  startOfWeek.setDate(firstSunday.getDate() + (selectedWeek - 1) * 7);
  startOfWeek.setHours(0, 0, 0, 0);

  // 🔹 สิ้นสุดสัปดาห์ (เสาร์)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // ✅ ตรวจว่าธุรกรรมอยู่ในช่วงของสัปดาห์ที่เลือกไหม
  return dateObj >= startOfWeek && dateObj <= endOfWeek;
}

      })
      .map((t, i) => {
        const dateObj = t.date?.toDate?.() || new Date(t.date);
        const dateStr = dateObj.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
        });
        const timeStr = dateObj.toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div
            key={i}
            className="grid grid-cols-[1fr,120px,100px] items-center py-2 border-b border-blue-100"
          >
            {/* 🔹 ชื่อรายการ */}
            <span className="font-medium text-gray-800 truncate">
              {t.name}
            </span>

            {/* 🔹 จำนวนเงิน */}
            <span
              className={`font-semibold tabular-nums text-center ${
                t.type === "income" ? "text-green-600" : "text-red-600"
              }`}
            >
              {t.type === "income" ? "+" : "-"}
              {t.amount.toLocaleString()}
            </span>

            {/* 🔹 วันที่ */}
            <span className="text-gray-400 text-xs text-right">
              {dateStr} {timeStr}
            </span>
          </div>
        );
      })}
  </div>
)}


  {/* ✅ รวมยอดตามช่วงจริง (รายวัน / รายสัปดาห์ / รายเดือน) */}
<div className="flex justify-between mt-4 border-t border-blue-200 pt-3 text-sm font-semibold">
  {/* ✅ รายรับ */}
  <span className="text-green-600">
    {chartMode === "daily"
      ? `รายรับรวมของวัน: +`
      : chartMode === "weekly"
      ? `รายรับรวมของสัปดาห์ที่ ${selectedWeek || ""}: +`
      : "รายรับรวมของเดือน: +"}

    {(() => {
      const now = new Date();
      let start, end;

      if (chartMode === "daily" && selectedDay) {
        // ✅ รายวัน
        const dayNames = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสฯ","ศุกร์","เสาร์"];
        const dayIndex = dayNames.indexOf(selectedDay);
        const today = new Date();
        const diff = dayIndex - today.getDay() + weekOffset * 7;
        start = new Date(today);
        start.setDate(today.getDate() + diff);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
      } 
      else if (chartMode === "weekly" && selectedWeek) {
        // ✅ รายสัปดาห์ (อิงอาทิตย์–เสาร์)
        const year = now.getFullYear();
        const month = now.getMonth();

        const startOfMonth = new Date(year, month, 1);
        const firstSunday = new Date(startOfMonth);
        firstSunday.setDate(startOfMonth.getDate() - startOfMonth.getDay());
        firstSunday.setHours(0, 0, 0, 0);

        start = new Date(firstSunday);
        start.setDate(firstSunday.getDate() + (selectedWeek - 1) * 7);
        start.setHours(0, 0, 0, 0);

        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } 
      else if (chartMode === "monthly" && selectedMonth !== null) {
        // ✅ รายเดือน
        start = new Date(now.getFullYear(), selectedMonth, 1);
        end = new Date(now.getFullYear(), selectedMonth + 1, 0, 23, 59, 59, 999);
      }

      // ✅ รวมรายรับในช่วงนั้น
      const totalIncome = allTransactions
        .filter((t) => {
          const d = t.date?.toDate?.() || new Date(t.date);
          return t.type === "income" && d >= start && d <= end;
        })
        .reduce((sum, t) => sum + t.amount, 0);

      return totalIncome.toLocaleString();
    })()}
  </span>

  {/* ✅ รายจ่าย */}
  <span className="text-red-600">
    {chartMode === "daily"
      ? `รายจ่ายรวมของวัน: -`
      : chartMode === "weekly"
      ? `รายจ่ายรวมของสัปดาห์ที่ ${selectedWeek || ""}: -`
      : "รายจ่ายรวมของเดือน: -"}

    {(() => {
      const now = new Date();
      let start, end;

      if (chartMode === "daily" && selectedDay) {
        // ✅ รายวัน
        const dayNames = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสฯ","ศุกร์","เสาร์"];
        const dayIndex = dayNames.indexOf(selectedDay);
        const today = new Date();
        const diff = dayIndex - today.getDay() + weekOffset * 7;
        start = new Date(today);
        start.setDate(today.getDate() + diff);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
      } 
      else if (chartMode === "weekly" && selectedWeek) {
        // ✅ รายสัปดาห์ (อิงอาทิตย์–เสาร์)
        const year = now.getFullYear();
        const month = now.getMonth();

        const startOfMonth = new Date(year, month, 1);
        const firstSunday = new Date(startOfMonth);
        firstSunday.setDate(startOfMonth.getDate() - startOfMonth.getDay());
        firstSunday.setHours(0, 0, 0, 0);

        start = new Date(firstSunday);
        start.setDate(firstSunday.getDate() + (selectedWeek - 1) * 7);
        start.setHours(0, 0, 0, 0);

        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } 
      else if (chartMode === "monthly" && selectedMonth !== null) {
        // ✅ รายเดือน
        start = new Date(now.getFullYear(), selectedMonth, 1);
        end = new Date(now.getFullYear(), selectedMonth + 1, 0, 23, 59, 59, 999);
      }

      // ✅ รวมรายจ่ายในช่วงนั้น
      const totalExpense = allTransactions
        .filter((t) => {
          const d = t.date?.toDate?.() || new Date(t.date);
          return t.type === "expense" && d >= start && d <= end;
        })
        .reduce((sum, t) => sum + t.amount, 0);

      return totalExpense.toLocaleString();
    })()}
  </span>
</div>


            </div>
          </motion.section>
        )}
      </motion.main>

      {/* ✅ แถบล่าง */}
      <BottomNav />
    </>
  );
}