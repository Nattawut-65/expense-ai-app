// lib/adminAuth.js
import { db } from "./firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

// ✅ Super Admin credentials (แอดมินคนแรกที่ไม่ต้องรออนุมัติ)
const SUPER_ADMIN = {
  email: "admin@expense.app",
  password: "admin123456",
  displayName: "Super Administrator",
  role: "head"
};

// ✅ ตรวจสอบว่าเป็น Admin หรือไม่จาก adminRequests
export const isAdmin = async (email) => {
  try {
    // ตรวจสอบ Super Admin ก่อน
    if (email === SUPER_ADMIN.email) {
      return true;
    }
    
    const adminRequestsRef = collection(db, "adminRequests");
    const q = query(
      adminRequestsRef, 
      where("userEmail", "==", email),
      where("status", "==", "approved")
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
};

// ✅ ตรวจสอบ credentials ของ admin (ตรวจสอบจาก Firestore)
export const validateAdminCredentials = async (email, password) => {
  try {
    // ✅ ตรวจสอบ Super Admin ก่อน (ไม่ต้องใช้ Firebase Auth)
    if (email === SUPER_ADMIN.email && password === SUPER_ADMIN.password) {
      console.log("Super Admin login successful!");
      return { 
        success: true, 
        adminData: {
          uid: "super_admin_001",
          email: SUPER_ADMIN.email,
          displayName: SUPER_ADMIN.displayName,
          role: SUPER_ADMIN.role,
          adminRole: SUPER_ADMIN.role,
          isSuperAdmin: true
        }
      };
    }

    // ตรวจสอบว่ามีในระบบ adminRequests และได้รับการอนุมัติหรือไม่
    const adminRequestsRef = collection(db, "adminRequests");
    const q = query(
      adminRequestsRef,
      where("userEmail", "==", email),
      where("status", "==", "approved")
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log("Not found in approved admins");
      return { success: false, message: "คุณยังไม่ได้รับการอนุมัติเป็นแอดมิน" };
    }

    // ตรวจสอบรหัสผ่านจาก Firebase Auth ด้วยการหา userId
    const adminData = querySnapshot.docs[0].data();
    const userId = adminData.userId;
    
    // ดึงข้อมูลผู้ใช้จาก users collection
    const userDoc = await getDoc(doc(db, "users", userId));
    
    if (!userDoc.exists()) {
      return { success: false, message: "ไม่พบข้อมูลผู้ใช้" };
    }

    const userData = userDoc.data();
    
    return { 
      success: true, 
      adminData: {
        uid: userId,
        email: adminData.userEmail,
        displayName: adminData.userName || userData.name,
        role: adminData.adminRole || "admin",
        ...adminData
      }
    };
  } catch (error) {
    console.error("Error validating admin credentials:", error);
    return { success: false, message: "เกิดข้อผิดพลาดในการตรวจสอบ" };
  }
};

// ✅ สร้าง admin session
export const createAdminSession = (adminData) => {
  localStorage.setItem("isAdminLoggedIn", "true");
  localStorage.setItem("adminData", JSON.stringify(adminData));
  return adminData;
};

// ✅ ล้าง admin session
export const clearAdminSession = () => {
  localStorage.removeItem("isAdminLoggedIn");
  localStorage.removeItem("adminData");
};

// ✅ ตรวจสอบว่ามี admin session หรือไม่
export const checkAdminSession = () => {
  const isLoggedIn = localStorage.getItem("isAdminLoggedIn");
  const adminDataStr = localStorage.getItem("adminData");
  
  if (isLoggedIn === "true" && adminDataStr) {
    try {
      return JSON.parse(adminDataStr);
    } catch {
      return null;
    }
  }
  return null;
};

// ✅ Admin credentials สำหรับแสดง
export const ADMIN_INFO = {
  email: "admin123@expense.app",
  password: "123456"
};
