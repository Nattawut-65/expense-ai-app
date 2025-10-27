import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

// 🧠 ฟังก์ชันคำนวณความคล้ายของคำ (Levenshtein)
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1],
              matrix[i][j - 1],
              matrix[i - 1][j]
            ) + 1;
    }
  }
  return matrix[b.length][a.length];
}

export async function POST(req) {
  try {
    const { userId, baseCategories, transactions } = await req.json();

    // ✅ ตรวจสอบ userId
    if (!userId) {
      return NextResponse.json({ error: "❌ ต้องระบุ userId" }, { status: 400 });
    }

    // ✅ หมวดหมู่พื้นฐาน (ถ้าไม่ได้ส่งมา)
    const categoriesFromHome =
      baseCategories && baseCategories.length > 0
        ? baseCategories
        : [
            "อาหาร/เครื่องดื่ม",
            "ค่าที่อยู่อาศัย/เครื่องใช้",
            "ยานพาหนะ/การเดินทาง",
            "เสื้อผ้า/รองเท้า",
            "การสื่อสาร",
            "การศึกษา",
            "เวชภัณฑ์/ค่ารักษา",
            "บันเทิง",
            "อื่นๆ",
          ];

    // ✅ ดึงข้อมูลจาก Firestore แยกตามผู้ใช้
    let expenseTransactions = [];
    if (transactions && transactions.length > 0) {
      expenseTransactions = transactions;
    } else {
      const userTransRef = collection(db, `users/${userId}/transactions`);
      const snapshot = await getDocs(userTransRef);
      if (snapshot.empty) {
        return NextResponse.json({ message: "ยังไม่มีข้อมูลธุรกรรมของผู้ใช้นี้" });
      }
      const allTrans = snapshot.docs.map((doc) => doc.data());
      expenseTransactions = allTrans.filter((t) => t.type === "expense");
    }

    // ✅ ตรวจสอบว่ามีรายจ่ายไหม
    if (expenseTransactions.length === 0) {
      return NextResponse.json({ message: "ยังไม่มีข้อมูลรายจ่ายของผู้ใช้" });
    }

    // ✅ คำใบ้หมวดหมู่
    const categoryHints = {
      "อาหาร/เครื่องดื่ม": ["ข้าว", "กาแฟ", "ชา", "อาหาร", "ขนม", "น้ำ", "ร้าน", "เครื่องดื่ม"],
      "ค่าที่อยู่อาศัย/เครื่องใช้": ["ค่าไฟ", "ค่าน้ำ", "ของใช้", "บ้าน", "คอนโด", "ห้อง", "เฟอร์นิเจอร์"],
      "ยานพาหนะ/การเดินทาง": ["น้ำมัน", "แท็กซี่", "รถเมล์", "BTS", "MRT", "Grab", "เดินทาง", "จอดรถ"],
      "เสื้อผ้า/รองเท้า": ["เสื้อ", "กางเกง", "รองเท้า", "หมวก", "กระเป๋า", "ชุด", "ถุงเท้า"],
      "การสื่อสาร": ["มือถือ", "โทรศัพท์", "อินเทอร์เน็ต", "wifi", "ซิม", "ค่าโทร", "เน็ต"],
      "การศึกษา": ["เรียน", "หนังสือ", "ติว", "ค่าเทอม", "คอร์ส", "อบรม"],
      "เวชภัณฑ์/ค่ารักษา": ["ยา", "หมอ", "โรงพยาบาล", "คลินิก", "รักษา", "พยาบาล"],
      "บันเทิง": ["ดูหนัง", "เกม", "เที่ยว", "คอนเสิร์ต", "ปาร์ตี้", "ของขวัญ", "ผับ"],
      "อื่นๆ": ["บริจาค", "ของฝาก", "งานพิธี", "ซ่อมของ", "ทั่วไป"],
    };

    // ✅ เตรียม object เก็บยอดรวมหมวดหมู่
    const categoryTotals = Object.fromEntries(categoriesFromHome.map((c) => [c, 0]));

    // 🧩 ฟังก์ชันจำแนกหมวด
    const classifyExpense = (title = "") => {
      const lower = title.toLowerCase();
      let best = "อื่นๆ";
      let minDist = Infinity;

      for (const [cat, words] of Object.entries(categoryHints)) {
        for (const kw of words) {
          if (lower.includes(kw.toLowerCase())) return cat;
          const dist = levenshtein(lower, kw.toLowerCase());
          if (dist < minDist && dist <= 3) {
            minDist = dist;
            best = cat;
          }
        }
      }
      return best;
    };

    // ✅ รวมยอดรายจ่ายตามหมวด
    for (const t of expenseTransactions) {
      const category = classifyExpense(t.title || t.name || "");
      if (categoryTotals[category] !== undefined) {
        categoryTotals[category] += Number(t.amount) || 0;
      }
    }

    // ✅ แปลงเป็น array สำหรับส่งกลับ
    const categories = categoriesFromHome.map((name) => ({
      name,
      total: categoryTotals[name],
    }));

    // 🔍 หาหมวดที่ใช้เยอะสุด
    const top = categories.reduce(
      (max, c) => (c.total > max.total ? c : max),
      { name: "ไม่มีข้อมูล", total: 0 }
    );

    // 💡 คำแนะนำ
    const advice =
      top.total > 0
        ? `เดือนนี้คุณใช้จ่ายในหมวด "${top.name}" มากที่สุด (${top.total.toLocaleString()} บาท)`
        : "ยังไม่มีข้อมูลเพียงพอในการให้คำแนะนำ";

    // ✅ ส่งกลับข้อมูล
    return NextResponse.json({ data: { categories, advice } }, { status: 200 });
  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json(
      {
        error: "เกิดข้อผิดพลาดในการประมวลผลข้อมูล",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
