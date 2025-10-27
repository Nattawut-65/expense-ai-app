import { doc, getDoc, setDoc, collection, setDoc as setSubDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * ตรวจสอบว่าผู้ใช้นี้มีข้อมูลใน Firestore แล้วหรือยัง
 * ถ้ายังไม่มี จะสร้างข้อมูลเริ่มต้นให้ทันที
 */
export async function ensureUserData(user) {
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  // ✅ ถ้ามีอยู่แล้ว ข้ามไป
  if (userSnap.exists()) {
    console.log("✅ ผู้ใช้นี้มีอยู่แล้ว:", user.uid);
    return;
  }

  // 🆕 ถ้ายังไม่มี → สร้างข้อมูลผู้ใช้ใหม่
  await setDoc(userRef, {
    name: user.displayName || "ไม่ระบุชื่อ",
    email: user.email || "",
    income: 0,
    budget: 0,
    createdAt: new Date(),
  });

  // 🎯 เพิ่มโครงสร้างเดือนปัจจุบัน (ไว้รองรับระบบรายเดือน)
  const currentMonth = new Date().toISOString().slice(0, 7); // เช่น "2025-10"
  const monthRef = doc(collection(userRef, "months"), currentMonth);
  await setSubDoc(monthRef, { createdAt: new Date() });

  console.log("🆕 สร้างผู้ใช้ใหม่พร้อมเดือนเริ่มต้น:", user.uid);
}
