"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, getDocs, doc, updateDoc } from "firebase/firestore";
import AddItemModal from "@/components/AddItemModal";
import ScanReceiptModal from "@/components/ScanReceiptModal";
import LimitNotificationModal from "@/components/LimitNotificationModal";
import BottomNav from "@/components/BottomNav";
import { query, where } from "firebase/firestore";
import { useTheme } from "@/contexts/ThemeContext";

export default function HomePage() {
  const router = useRouter();
  const { theme } = useTheme();
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
  const [autoProcess, setAutoProcess] = useState(false); // ❌ ปิดประมวลผลอัตโนมัติ - ต้องกดเอง
  
  // 🔔 การแจ้งเตือนลิมิต
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [emailNotificationEnabled, setEmailNotificationEnabled] = useState(false);
  const [showLimitNotification, setShowLimitNotification] = useState(false);
  const [currentLimitAlert, setCurrentLimitAlert] = useState(null);
  
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

  // ✅ หมวดหมู่พื้นฐาน (ย้ายมาไว้ที่นี่เพื่อให้ใช้ใน checkLimitNotification ได้)
  const baseCategories = useMemo(() => [
    { name: "อาหาร/เครื่องดื่ม", amount: 0, icon: "🍜", color: "bg-red-500" },
    { name: "ค่าที่อยู่อาศัย/เครื่องใช้", amount: 0, icon: "🏠", color: "bg-blue-500" },
    { name: "ยานพาหนะ/การเดินทาง", amount: 0, icon: "🚗", color: "bg-yellow-500" },
    { name: "เสื้อผ้า/รองเท้า", amount: 0, icon: "👗", color: "bg-purple-500" },
    { name: "การสื่อสาร", amount: 0, icon: "📞", color: "bg-pink-500" },
    { name: "การศึกษา", amount: 0, icon: "🎓", color: "bg-green-500" },
    { name: "เวชภัณฑ์/ค่ารักษา", amount: 0, icon: "💊", color: "bg-teal-500" },
    { name: "บันเทิง", amount: 0, icon: "🎉", color: "bg-orange-500" },
    { name: "อื่นๆ", amount: 0, icon: "📦", color: "bg-gray-500" },
  ], []);

  // � ฟังก์ชันส่งอีเมลแจ้งเตือน (ประกาศก่อน checkLimitNotification)
  const sendEmailNotification = useCallback(async (alertData) => {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) return;

      // ตรวจสอบว่าส่งอีเมลหมวดนี้ไปแล้วหรือยัง
      const today = new Date().toDateString();
      const emailNotifiedData = localStorage.getItem("emailNotifiedData");
      let emailNotifiedCategories = [];
      
      if (emailNotifiedData) {
        const parsed = JSON.parse(emailNotifiedData);
        if (parsed.date === today) {
          emailNotifiedCategories = parsed.categories || [];
        }
      }

      // ถ้าส่งไปแล้ว ไม่ต้องส่งซ้ำ
      if (emailNotifiedCategories.includes(alertData.category)) {
        return;
      }

      const response = await fetch("/api/send-limit-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          category: alertData.category,
          amount: alertData.amount,
          limit: alertData.limit,
          percent: alertData.percent,
          isOver: alertData.isOver
        }),
      });

      if (response.ok) {
        // บันทึกว่าส่งอีเมลหมวดนี้ไปแล้ว
        emailNotifiedCategories.push(alertData.category);
        localStorage.setItem("emailNotifiedData", JSON.stringify({
          date: today,
          categories: emailNotifiedCategories
        }));
        console.log("✅ ส่งอีเมลแจ้งเตือนสำเร็จ");
      }
    } catch (error) {
      console.error("Error sending email notification:", error);
    }
  }, []);

  // �🔔 ฟังก์ชันตรวจสอบและแจ้งเตือนลิมิต (แต่ละหมวด 1 ครั้ง/วัน)
  const checkLimitNotification = useCallback(async (userId) => {
    if (!notificationEnabled || !userId) return;

    try {
      const today = new Date().toDateString();
      
      // ดึงข้อมูลหมวดที่แจ้งไปแล้ววันนี้ (เก็บเป็น object: { date, categories: [...] })
      const notifiedData = localStorage.getItem("limitNotifiedData");
      let notifiedCategories = [];
      
      if (notifiedData) {
        const parsed = JSON.parse(notifiedData);
        if (parsed.date === today) {
          notifiedCategories = parsed.categories || [];
        }
      }

      // ดึงข้อมูลรายจ่ายเดือนนี้
      const q = query(
        collection(db, "transactions"),
        where("userId", "==", userId),
        where("type", "==", "expense")
      );
      
      const snapshot = await getDocs(q);
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // คำนวณยอดแต่ละหมวด
      const categoryTotals = {};
      baseCategories.forEach(cat => {
        categoryTotals[cat.name] = 0;
      });

      snapshot.forEach((doc) => {
        const data = doc.data();
        const transDate = new Date(data.date.seconds ? data.date.seconds * 1000 : data.date);
        if (transDate.toISOString().slice(0, 7) === currentMonth) {
          const cat = data.category || "อื่นๆ";
          if (categoryTotals[cat] !== undefined) {
            categoryTotals[cat] += Number(data.amount) || 0;
          }
        }
      });

      // หาหมวดที่ใกล้ถึงหรือเกินลิมิต (80% ขึ้นไป) และยังไม่ได้แจ้งวันนี้
      const alerts = [];
      Object.entries(categoryTotals).forEach(([category, amount]) => {
        const limit = limits[category] || 10000;
        const percent = Math.round((amount / limit) * 100);
        
        // เช็คว่าเกิน 80% และยังไม่ได้แจ้งหมวดนี้วันนี้
        if (percent >= 80 && amount > 0 && !notifiedCategories.includes(category)) {
          alerts.push({
            category,
            amount,
            limit,
            percent,
            isOver: percent > 100
          });
        }
      });

      if (alerts.length === 0) return;

      // เรียงตาม % จากมากไปน้อย
      alerts.sort((a, b) => b.percent - a.percent);

      // แจ้งเตือนหมวดแรก (ที่เกินมากสุดและยังไม่ได้แจ้ง)
      setCurrentLimitAlert(alerts[0]);
      setShowLimitNotification(true);
      
      // บันทึกว่าแจ้งหมวดนี้วันนี้แล้ว
      notifiedCategories.push(alerts[0].category);
      localStorage.setItem("limitNotifiedData", JSON.stringify({
        date: today,
        categories: notifiedCategories
      }));

      // 📧 ส่งอีเมลแจ้งเตือน (ถ้าเปิดการแจ้งเตือนทางอีเมล)
      if (emailNotificationEnabled) {
        await sendEmailNotification(alerts[0]);
      }

    } catch (error) {
      console.error("Error checking limit notification:", error);
    }
  }, [notificationEnabled, emailNotificationEnabled, limits, baseCategories, sendEmailNotification]);

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

      // ไม่ต้องแจ้งเตือนตอนข้อมูลเปลี่ยน รอให้ AI ประมวลผลก่อน
    });

    return () => unsubscribeTrans();
  });

  return () => {
    isMounted = false;
    unsubscribeAuth();
  };
}, [router, checkLimitNotification, notificationEnabled, userId]);

  // ✅ โหลดค่า limits จาก localStorage
  useEffect(() => {
    const defaultLimits = {
      "อาหาร/เครื่องดื่ม": 10000,
      "ค่าที่อยู่อาศัย/เครื่องใช้": 15000,
      "ยานพาหนะ/การเดินทาง": 8000,
      "เสื้อผ้า/รองเท้า": 5000,
      "การสื่อสาร": 3000,
      "การศึกษา": 7000,
      "เวชภัณฑ์/ค่ารักษา": 6000,
      "บันเทิง": 4000,
      "อื่นๆ": 3000,
    };
    
    const savedLimits = localStorage.getItem("categoryLimits");
    if (savedLimits) {
      setLimits(JSON.parse(savedLimits));
    } else {
      setLimits(defaultLimits);
    }

    // โหลดสถานะ autoProcess จาก localStorage
    const savedAutoProcess = localStorage.getItem("autoProcess");
    if (savedAutoProcess !== null) {
      setAutoProcess(savedAutoProcess === "true");
    }

    // โหลดสถานะการแจ้งเตือน
    const savedNotification = localStorage.getItem("limitNotificationEnabled");
    if (savedNotification !== null) {
      setNotificationEnabled(savedNotification === "true");
    }

    // โหลดสถานะการแจ้งเตือนทางอีเมล
    const savedEmailNotification = localStorage.getItem("emailNotificationEnabled");
    if (savedEmailNotification !== null) {
      setEmailNotificationEnabled(savedEmailNotification === "true");
    }

    // ฟังการเปลี่ยนแปลงจาก localStorage (จากหน้า Settings)
    const handleLimitsUpdate = () => {
      const updated = localStorage.getItem("categoryLimits");
      if (updated) {
        setLimits(JSON.parse(updated));
      }
    };

    window.addEventListener("limitsUpdated", handleLimitsUpdate);
    
    return () => {
      window.removeEventListener("limitsUpdated", handleLimitsUpdate);
    };
  }, []);

  const totalIncome = income > 0 ? income : 1;
  const expensePercent = Math.min(Math.round((expense / totalIncome) * 100), 100);
  const incomePercent = 100 - expensePercent;

  // ✅ ประมวลผล AI (ใช้ useCallback เพื่อไม่ให้สร้างใหม่ทุกครั้ง)
  const handleAIProcess = useCallback(async () => {
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
  .map((doc) => ({ id: doc.id, ...doc.data() })) // ✅ เพิ่ม id เพื่อให้ API อัปเดตหมวดหมู่ได้
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
          limits,
        }),
      });

      if (!res.ok) throw new Error("API error: " + res.status);
      const result = await res.json();

      const updated = baseCategories.map((cat) => {
        const aiCat = result.data?.categories?.find((c) => c.name === cat.name);
        return { ...cat, amount: aiCat?.total || 0 };
      });

      const newData = { 
        categories: updated, 
        advice: result.data?.advice || null,
        summary: result.data?.summary,
        categoriesWithPercent: result.data?.categoriesWithPercent,
        classifiedItems: result.data?.classifiedItems || [], // ✅ เพิ่มรายการที่จำแนก
        alerts: result.data?.alerts || [],
      };
      setAiData(newData);
      setShowAIResult(true);

      // ✅ จำผลใน sessionStorage และสถานะเปิดอยู่
      sessionStorage.setItem("aiResult", JSON.stringify({ ...newData, month: selectedMonth }));
      sessionStorage.setItem("showAIResult", "true");

      // 🔔 ตรวจสอบและแจ้งเตือนหลังจาก AI ประมวลผลเสร็จ
      if (notificationEnabled && user.uid) {
        setTimeout(() => checkLimitNotification(user.uid), 500);
      }
    } catch (err) {
      console.error("❌ AI Error:", err);
      setError("เกิดข้อผิดพลาดในการประมวลผล AI ❌");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, baseCategories, notificationEnabled, checkLimitNotification, limits]);

  // ✅ ประมวลผล AI อัตโนมัติเมื่อข้อมูลเปลี่ยนแปลง
  useEffect(() => {
    if (!userId || !autoProcess) return;
    
    // Debounce เพื่อไม่ให้ประมวลผลบ่อยเกินไป
    const timer = setTimeout(() => {
      handleAIProcess();
    }, 1500); // รอ 1.5 วินาที หลังจากข้อมูลเปลี่ยน

    return () => clearTimeout(timer);
  }, [expense, selectedMonth, userId, autoProcess, handleAIProcess]);

  // 🔒 ปิดผล AI และบันทึกหมวดหมู่กลับไป Firestore
  const handleCloseAIResult = async () => {
    setShowAIResult(false);
    sessionStorage.setItem("showAIResult", "false");
    
    // บันทึกหมวดหมู่ที่ AI จำแนกไว้กลับไป Firestore
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid)
      );

      const snapshot = await getDocs(q);
      const updatePromises = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        
        // กรองเฉพาะรายการในเดือนที่เลือก
        const d = new Date(data.date.seconds ? data.date.seconds * 1000 : data.date);
        if (d.toISOString().slice(0, 7) !== selectedMonth) return;
        
        // อัปเดตเฉพาะรายการที่ยังไม่มีหมวดหมู่หรือเป็น "อื่นๆ"
        if (data.type === "expense" && (!data.category || data.category === "อื่นๆ" || data.category === "")) {
          // ใช้ AI จำแนกหมวดหมู่
          const title = data.title || data.name || "";
          const category = classifyFromKeywords(title);
          
          const docRef = doc(db, "transactions", docSnap.id);
          updatePromises.push(
            updateDoc(docRef, { category }).catch(err => {
              console.warn(`ไม่สามารถอัปเดต ${docSnap.id}:`, err.message);
            })
          );
        }
      });

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        console.log(`✅ บันทึกหมวดหมู่สำเร็จ ${updatePromises.length} รายการ`);
      }
    } catch (err) {
      console.error("❌ Error saving categories:", err);
    }
  };

  // 🤖 ฟังก์ชันจำแนกหมวดหมู่ที่แม่นยำยิ่งขึ้น (ใช้เหมือนกับใน API)
  const classifyFromKeywords = (title = "") => {
    const lower = title.toLowerCase().trim();
    
    const categoryKeywords = {
      "ยานพาหนะ/การเดินทาง": [
        "น้ำมัน", "เติมน้ำมัน", "ปตท", "esso", "shell", "caltex", "bangchak", "gas", "fuel", "petrol", "diesel",
        "แท็กซี่", "รถเมล์", "BTS", "MRT", "skytrain", "แกร็บ", "grab", "bolt", "รถไฟ", "รถไฟฟ้า", "taxi", "bus", "train",
        "เครื่องบิน", "สายการบิน", "ตั๋วบิน", "airasia", "nok air", "flight", "airline",
        "จอดรถ", "ค่าจอด", "parking", "ซ่อมรถ", "ล้างรถ", "car wash",
        "เดินทาง", "ค่าโดยสาร", "transportation"
      ],
      "อาหาร/เครื่องดื่ม": [
        "กาแฟ", "คาเฟ่", "สตาร์บัคส์", "starbucks", "amazon", "cafe", "coffee", "latte",
        "ชา", "ชาเขียว", "tea", "milk tea",
        "เครื่องดื่ม", "น้ำดื่ม", "น้ำอัดลม", "โค้ก", "coke", "pepsi", "juice", "smoothie",
        "ข้าว", "ข้าวผัด", "ข้าวมันไก่", "ก๋วยเตี๋ยว", "ผัดไทย", "ส้มตำ", "rice", "noodle",
        "อาหาร", "กินข้าว", "ของว่าง", "food", "meal", "breakfast", "lunch", "dinner", "snack",
        "ร้านอาหาร", "ฟู้ดคอร์ท", "restaurant", "food court",
        "พิซซ่า", "pizza", "burger", "เบอร์เกอร์", "แมคโดนัลด์", "mcdonald", "kfc", "subway",
        "แซนวิช", "แซนด์วิช", "เเวนวิท", "sandwich", "sub",
        "ขนม", "เค้ก", "ไอศกรีม", "cake", "ice cream", "dessert", "donut",
        "ผัก", "ผลไม้", "เนื้อ", "หมู", "ไก่", "ปลา", "ไข่", "นม", "ขนมปัง", "fruit", "meat", "chicken", "egg", "milk", "bread",
        "ตลาด", "เซเว่น", "7-11", "big c", "lotus", "tops", "market", "supermarket",
        "น้ำ", "drink"
      ],
      "ค่าที่อยู่อาศัย/เครื่องใช้": [
        "ค่าเช่า", "เช่าบ้าน", "เช่าคอนโด", "ห้องเช่า", "rent",
        "บ้าน", "คอนโด", "ห้อง", "apartment", "condo",
        "ค่าไฟ", "ไฟฟ้า", "electric", "electricity",
        "ค่าน้ำ", "ประปา", "water",
        "แอร์", "air conditioner", "ac",
        "ตู้เย็น", "refrigerator", "fridge",
        "ทีวี", "tv", "พัดลม", "fan", "เครื่องซักผ้า", "washing machine",
        "เฟอร์นิเจอร์", "โซฟา", "เตียง", "โต๊ะ", "furniture", "sofa", "bed", "table",
        "ของใช้", "ผงซักฟอก", "household", "detergent"
      ],
      "เสื้อผ้า/รองเท้า": [
        "เสื้อ", "เสื้อผ้า", "shirt", "clothes",
        "กางเกง", "pants", "jeans",
        "กระโปรง", "ชุด", "skirt", "dress",
        "รองเท้า", "shoes", "sneakers", "sandals", "boots",
        "ถุงเท้า", "socks", "หมวก", "hat",
        "กระเป๋า", "bag", "backpack", "wallet",
        "แว่นตา", "glasses",
        "uniqlo", "h&m", "zara", "nike", "adidas", "converse"
      ],
      "การสื่อสาร": [
        "มือถือ", "โทรศัพท์", "ค่าโทร", "phone", "mobile",
        "อินเทอร์เน็ต", "เน็ต", "wifi", "internet",
        "ซิม", "sim", "เติมเงิน", "top up",
        "true", "ais", "dtac", "3bb"
      ],
      "การศึกษา": [
        "เรียน", "ค่าเรียน", "ค่าเทอม", "tuition", "school",
        "หนังสือ", "ตำรา", "book", "textbook",
        "ติว", "คอร์ส", "อบรม", "course", "training",
        "ปากกา", "สมุด", "pen", "notebook", "stationery",
        "โรงเรียน", "มหาวิทยาลัย", "university"
      ],
      "เวชภัณฑ์/ค่ารักษา": [
        "ยา", "ยาแก้ปวด", "medicine", "pill",
        "วิตามิน", "vitamin", "supplement",
        "หมอ", "แพทย์", "doctor",
        "โรงพยาบาล", "hospital",
        "คลินิก", "clinic",
        "รักษา", "ตรวจ", "treatment",
        "ทันตแพทย์", "หมอฟัน", "dentist",
        "ร้านขายยา", "pharmacy"
      ],
      "บันเทิง": [
        "หนัง", "ดูหนัง", "โรงหนัง", "movie", "cinema",
        "เกม", "game", "steam", "playstation",
        "คอนเสิร์ต", "concert", "festival",
        "ปาร์ตี้", "party",
        "เที่ยว", "ท่องเที่ยว", "travel", "trip", "vacation",
        "ของขวัญ", "gift",
        "ผับ", "บาร์", "pub", "bar", "club",
        "สวนสนุก", "zoo", "museum",
        "คาราโอเกะ", "karaoke",
        "นวด", "สปา", "massage", "spa",
        "ฟิตเนส", "ยิม", "gym",
        "netflix", "spotify", "youtube premium", "disney+"
      ],
    };

    // เรียงลำดับหมวด: ยานพาหนะก่อน (เพราะมี "น้ำมัน") แล้วค่อยหมวดอื่น
    const orderedHints = [
      ["ยานพาหนะ/การเดินทาง", categoryKeywords["ยานพาหนะ/การเดินทาง"]],
      ["อาหาร/เครื่องดื่ม", categoryKeywords["อาหาร/เครื่องดื่ม"]],
      ["ค่าที่อยู่อาศัย/เครื่องใช้", categoryKeywords["ค่าที่อยู่อาศัย/เครื่องใช้"]],
      ["เสื้อผ้า/รองเท้า", categoryKeywords["เสื้อผ้า/รองเท้า"]],
      ["การสื่อสาร", categoryKeywords["การสื่อสาร"]],
      ["การศึกษา", categoryKeywords["การศึกษา"]],
      ["เวชภัณฑ์/ค่ารักษา", categoryKeywords["เวชภัณฑ์/ค่ารักษา"]],
      ["บันเทิง", categoryKeywords["บันเทิง"]],
    ];

    // เช็คแบบ exact match (เรียงจากคำยาวไปสั้น)
    for (const [cat, words] of orderedHints) {
      const sortedWords = [...words].sort((a, b) => b.length - a.length);
      for (const kw of sortedWords) {
        if (lower.includes(kw.toLowerCase())) {
          return cat;
        }
      }
    }

    return "อื่นๆ";
  };

  // 🔄 บันทึกหมวดหมู่อัตโนมัติก่อนออกจากหน้า (เมื่อเปลี่ยนหน้า)
  useEffect(() => {
    return () => {
      // ฟังก์ชันนี้จะทำงานเมื่อ component unmount (ก่อนออกจากหน้า)
      const saveCategories = async () => {
        try {
          const user = auth.currentUser;
          if (!user) return;

          const q = query(
            collection(db, "transactions"),
            where("userId", "==", user.uid)
          );

          const snapshot = await getDocs(q);
          const updatePromises = [];

          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            
            // กรองเฉพาะรายการในเดือนที่เลือก
            const d = new Date(data.date.seconds ? data.date.seconds * 1000 : data.date);
            if (d.toISOString().slice(0, 7) !== selectedMonth) return;
            
            // อัปเดตเฉพาะรายการที่ยังไม่มีหมวดหมู่หรือเป็น "อื่นๆ"
            if (data.type === "expense" && (!data.category || data.category === "อื่นๆ" || data.category === "")) {
              const title = data.title || data.name || "";
              const category = classifyFromKeywords(title);
              
              const docRef = doc(db, "transactions", docSnap.id);
              updatePromises.push(
                updateDoc(docRef, { category }).catch(err => {
                  console.warn(`ไม่สามารถอัปเดต ${docSnap.id}:`, err.message);
                })
              );
            }
          });

          if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            console.log(`✅ บันทึกหมวดหมู่อัตโนมัติก่อนออกจากหน้า: ${updatePromises.length} รายการ`);
          }
        } catch (err) {
          console.error("❌ Error auto-saving categories:", err);
        }
      };

      // เรียกฟังก์ชันบันทึก
      saveCategories();
    };
  }, [selectedMonth]); // เพิ่ม selectedMonth เป็น dependency

 // ✅ โหลดผล AI จาก sessionStorage (แสดงต่อเมื่อกลับจากหน้าอื่น)
useEffect(() => {
  const saved = sessionStorage.getItem("aiResult");
  const showFlag = sessionStorage.getItem("showAIResult") === "true";
  const skipFold = sessionStorage.getItem("skipFold") === "true"; // 🧠 flag สำหรับ "ไม่พับ"

  if (!saved) return;
  const data = JSON.parse(saved);

  // ✅ ถ้ามี flag skipFold → แสดงผล AI เดิมทันที
  if (skipFold && showFlag) {
    setAiData({ 
      categories: data.categories, 
      advice: data.advice,
      summary: data.summary,
  categoriesWithPercent: data.categoriesWithPercent,
  alerts: data.alerts || []
    });
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
    setAiData({ 
      categories: data.categories, 
      advice: data.advice,
      summary: data.summary,
  categoriesWithPercent: data.categoriesWithPercent,
  alerts: data.alerts || []
    });
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
        className={`flex flex-col min-h-screen pb-24 ${
          theme === "dark" ? "bg-gray-900" : "bg-blue-50"
        }`}
      >
        <header className={`px-4 py-3 font-bold text-lg flex items-center shadow-md ${
          theme === "dark" ? "bg-gray-800 text-white" : "bg-blue-600 text-white"
        }`}>
          <span>ExpenseTrackingAI</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ✅ สรุปยอด */}
          <div className={`rounded-xl shadow-md p-4 ${
            theme === "dark" ? "bg-gray-800" : "bg-white"
          }`}>
            <div className={`flex justify-between font-bold items-center ${
              theme === "dark" ? "text-gray-200" : "text-gray-800"
            }`}>
              <div>
                <p>รายรับทั้งหมด</p>
                <p className="text-green-600 text-xl">{income.toLocaleString()} บาท</p>
              </div>
              <div className="text-right">
                <p>รายจ่ายทั้งหมด</p>
                <p className="text-red-600 text-xl">{expense.toLocaleString()} บาท</p>
              </div>
            </div>

            <div className={`w-full h-5 rounded-full mt-3 flex overflow-hidden ${
              theme === "dark" ? "bg-gray-700" : "bg-gray-200"
            }`}>
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
              className={`flex-1 py-3 rounded-lg font-bold ${
                theme === "dark"
                  ? "bg-blue-700 text-white hover:bg-blue-800"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              📷 สแกนใบเสร็จ
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className={`flex-1 border-2 py-3 rounded-lg font-bold ${
                theme === "dark"
                  ? "border-blue-500 text-blue-400 bg-gray-800 hover:bg-gray-700"
                  : "border-blue-600 text-blue-600 bg-white hover:bg-blue-100"
              }`}
            >
              ＋ เพิ่มรายการ
            </button>
          </div>

  {/* ปุ่ม AI + เดือน + สถานะออโต้ */}
<div className="flex flex-col items-center gap-2 mt-4" ref={pickerRef}>
  {/* แถวบน: ปุ่ม AI + เดือน */}
  <div className="relative flex items-center gap-2">
    <button
      onClick={() => handleAIProcess()}
      disabled={loading}
      className={`py-3 px-6 rounded-lg font-bold shadow text-base w-[180px] text-center transition-transform ${
        loading 
          ? "bg-gray-400 cursor-not-allowed" 
          : theme === "dark"
          ? "bg-blue-800 text-white hover:bg-blue-900 active:scale-95"
          : "bg-blue-700 text-white hover:bg-blue-800 active:scale-95"
      }`}
    >
      {loading ? "⏳ กำลังวิเคราะห์..." : "🤖 ประมวลผล AI"}
    </button>

    {/* ปุ่ม 📅 เลือกเดือน */}
    <div className="relative">
      <button
        onClick={() => setShowMonthPicker((prev) => !prev)}
        className={`text-2xl transition-transform active:scale-95 ${
          theme === "dark" ? "text-blue-400 hover:text-blue-300" : "text-blue-700 hover:text-blue-800"
        }`}
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
            className={`absolute right-0 mt-2 w-[230px] border rounded-xl shadow-lg p-3 max-h-[300px] overflow-y-auto z-50 ${
              theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            }`}
          >
            {years.map((yearTH) => {
              const yearAD = yearTH - 543;
              return (
                <div key={yearTH} className="mb-2">
                  <p className={`font-bold mb-2 text-center ${
                    theme === "dark" ? "text-gray-200" : "text-gray-700"
                  }`}>{yearTH}</p>
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
                              ? theme === "dark"
                                ? "bg-blue-900 text-blue-300 border-blue-700"
                                : "bg-blue-100 text-blue-700 border-blue-300"
                              : theme === "dark"
                              ? "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600"
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
  
  {/* แถวล่าง: สถานะออโต้ */}
  <div className="flex items-center gap-2">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={autoProcess}
        onChange={(e) => {
          const newValue = e.target.checked;
          setAutoProcess(newValue);
          localStorage.setItem("autoProcess", newValue.toString());
        }}
        className="w-4 h-4 cursor-pointer accent-blue-600"
      />
      <span className={`text-xs font-medium ${
        theme === "dark" ? "text-gray-300" : "text-gray-600"
      }`}>
        🔄 ประมวลผลอัตโนมัติ
      </span>
    </label>
    {autoProcess && !loading && (
      <span className={`text-xs ${
        theme === "dark" ? "text-green-400" : "text-green-600"
      }`}>
        ✓ เปิดใช้งาน
      </span>
    )}
  </div>
</div>
          {/* 🌀 Loading */}
          {loading && (
            <div className={`rounded-xl shadow-md p-6 ${
              theme === "dark" ? "bg-gray-800" : "bg-white"
            }`}>
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl">🤖</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className={`font-bold text-lg ${
                    theme === "dark" ? "text-gray-200" : "text-gray-700"
                  }`}>AI กำลังวิเคราะห์ข้อมูล...</p>
                  <p className={`text-sm mt-1 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}>กำลังประมวลผลรายจ่ายของคุณ</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className={`p-3 rounded-lg text-center font-bold ${
              theme === "dark" ? "bg-red-900 text-red-200" : "bg-red-100 text-red-600"
            }`}>
              {error}
            </div>
          )}

          {/* ✅ ผลวิเคราะห์ AI */}
{showAIResult && aiData && (
  <div className={`rounded-xl shadow-md p-4 space-y-4 relative ${
    theme === "dark" ? "bg-gray-800" : "bg-white"
  }`}>
    {/* ปุ่มปิด */}
    <button
      onClick={handleCloseAIResult}
      className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
        theme === "dark" 
          ? "bg-gray-700 hover:bg-gray-600 text-gray-300" 
          : "bg-gray-100 hover:bg-gray-200 text-gray-600"
      }`}
      title="ปิดและบันทึกหมวดหมู่"
    >
      ✕
    </button>
    
    <p className={`font-bold text-lg pr-8 ${
      theme === "dark" ? "text-gray-200" : "text-gray-800"
    }`}>
      📊 ผลวิเคราะห์ค่าใช้จ่ายเดือน {formatThaiMonthShort(selectedMonth)}
    </p>

    {(() => {
      // 🧮 หาหมวดที่เกินลิมิต
      const overLimitCats = mergedCategories()
        .filter(cat => cat.amount > (limits[cat.name] || 10000))
        .map(cat => cat.name);

      const hasOverLimit = overLimitCats.length > 0;

      // 🧠 สร้างข้อความคำแนะนำ / คำเตือน
      const adviceText = hasOverLimit
        ? `⚠️ คุณใช้จ่ายเกินลิมิตในหมวด: ${overLimitCats.join(", ")} กรุณาพิจารณาลดรายจ่ายหรือปรับเพิ่มลิมิตในหน้าตั้งค่า 💸`
        : aiData.advice;

      return (
        <ul className="space-y-4">
          {/* ✅ กล่องคำแนะนำหรือคำเตือน */}
          {aiData.advice && (
            <li
              className={`rounded-lg p-4 border-2 ${
                hasOverLimit
                  ? theme === "dark"
                    ? "bg-red-900 border-red-700 text-red-200"
                    : "bg-red-50 border-red-300 text-red-700"
                  : theme === "dark"
                  ? "bg-blue-900 border-blue-700 text-blue-200"
                  : "bg-blue-50 border-blue-300 text-blue-700"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-3xl">
                  {hasOverLimit ? "⚠️" : "💡"}
                </span>
                <div className="flex-1">
                  <p className="font-bold text-base mb-1">
                    {hasOverLimit ? "⚠️ คำเตือนจาก AI" : "💡 คำแนะนำจาก AI"}
                  </p>
                  <p className="text-sm leading-relaxed">{adviceText}</p>
                </div>
              </div>
            </li>
          )}

          {/* ✅ รายละเอียดหมวดหมู่ */}
          {mergedCategories()
            .sort((a, b) => b.amount - a.amount) // เรียงจากมากไปน้อย
            .map((cat, idx) => {
            const limit = limits[cat.name] || 10000;
            const percent = Math.min(Math.round((cat.amount / limit) * 100), 100);
            const overLimit = cat.amount > limit;
            const remaining = limit - cat.amount;
            const percentInfo = aiData.categoriesWithPercent?.find((c) => c.name === cat.name);
            const percentOfLimit = percentInfo?.percentOfLimit ?? null;
            const percentOfTotal = percentInfo?.percent ?? 0;
            const percentLabel = percentOfLimit !== null
              ? `${percentOfLimit}% ของงบหมวดนี้`
              : `${percentOfTotal}% ของรายจ่ายทั้งหมด`;

            // ไม่แสดงหมวดที่ไม่มีรายจ่าย
            if (cat.amount === 0) return null;

            return (
              <li key={idx} className={`flex flex-col gap-2 p-3 rounded-lg ${
                theme === "dark" ? "bg-gray-700" : "bg-gray-50"
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{cat.icon}</span>
                    <div>
                      <p className={`font-bold ${
                        theme === "dark" ? "text-gray-200" : "text-gray-800"
                      }`}>{cat.name}</p>
                      <p className={`text-xs ${
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      }`}>
                        {overLimit 
                          ? `เกินลิมิต ${(cat.amount - limit).toLocaleString()} บาท` 
                          : `เหลือ ${remaining.toLocaleString()} บาท`
                        }
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-bold text-lg ${
                      overLimit ? "text-red-600" : "text-blue-600"
                    }`}>
                      ฿{cat.amount.toLocaleString()}
                    </div>
                    <div className={`text-xs ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}>
                      จาก {limit.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className={`w-full h-5 rounded-full overflow-hidden relative ${
                  theme === "dark" ? "bg-gray-600" : "bg-gray-200"
                }`}>
                  <div
                    className={`${
                      overLimit ? "bg-red-500" : cat.color
                    } h-5 transition-all duration-300 flex items-center justify-end pr-2`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  >
                    <span className="text-white text-xs font-bold drop-shadow">
                      {percent}%
                    </span>
                  </div>
                </div>

                {/* สถานะ */}
                <div className="flex justify-between items-center">
                  <p className={`text-xs font-bold ${
                    overLimit 
                      ? "text-red-600" 
                      : percent >= 80
                      ? "text-orange-600"
                      : percent >= 50
                      ? "text-yellow-600"
                      : theme === "dark" 
                      ? "text-green-400" 
                      : "text-green-600"
                  }`}>
                    {overLimit 
                      ? "⚠️ เกินงบประมาณ!" 
                      : percent >= 80
                      ? "⚡ ใกล้ถึงลิมิต"
                      : percent >= 50
                      ? "📊 ครึ่งทางแล้ว"
                      : "✅ อยู่ในงบ"
                    }
                  </p>
                  {aiData.categoriesWithPercent && (
                    <p className={`text-xs ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}>
                      {percentLabel}
                    </p>
                  )}
                </div>
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
        <LimitNotificationModal 
          isOpen={showLimitNotification} 
          onClose={() => setShowLimitNotification(false)}
          limitData={currentLimitAlert}
        />
      </motion.main>

      <BottomNav />
    </>
  );
}