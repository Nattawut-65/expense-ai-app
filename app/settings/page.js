"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Cropper from "react-easy-crop";
import BottomNav from "@/components/BottomNav";
import { useState, useEffect } from "react";
import { updatePassword } from "firebase/auth"; // 👈 ย้ายไปบนสุดสุดของไฟล์ (ใต้ "use client")

// 🧩 ฟังก์ชันครอบภาพ
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return canvas.toDataURL("image/jpeg");
}

export default function SettingsPage() {
  const router = useRouter();
  const [openSection, setOpenSection] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("กำลังโหลด...");
  const [profilePic, setProfilePic] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState("");

  // 🔔 การแจ้งเตือน
const [notifications, setNotifications] = useState({
  inApp: true,
  email: false,
  sms: false,
});

// โหลดค่าที่บันทึกไว้
useEffect(() => {
  const saved = localStorage.getItem("userNotifications");
  if (saved) setNotifications(JSON.parse(saved));
}, []);

// บันทึก
const handleSaveNotifications = () => {
  localStorage.setItem("userNotifications", JSON.stringify(notifications));
  alert("บันทึกการตั้งค่าการแจ้งเตือนแล้ว ✅");
  setOpenSection(null);
};

// ยกเลิก
const handleResetNotifications = () => {
  const saved = localStorage.getItem("userNotifications");
  if (saved) {
    setNotifications(JSON.parse(saved));
  } else {
    setNotifications({ inApp: true, email: false, sms: false });
  }
  alert("ยกเลิกการเปลี่ยนแปลงแล้ว ❌");
  setOpenSection(null);
};


// 📨 ข้อเสนอแนะ
const [suggestion, setSuggestion] = useState("");

// ✅ ฟังก์ชันส่งข้อเสนอแนะ
const handleSendSuggestion = () => {
  if (!suggestion.trim()) {
    alert("กรุณากรอกข้อเสนอแนะก่อนส่งนะครับ 🙂");
    return;
  }

  alert("ขอบคุณสำหรับข้อเสนอแนะครับ ❤️");
  setSuggestion("");
};


    // 🌗 ธีม (โหมดปกติ / มืด)
  const [theme, setTheme] = useState("light");

  // โหลดธีมจาก localStorage ตอนเปิดหน้า
  useEffect(() => {
    const savedTheme = localStorage.getItem("appTheme") || "light";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
  }, []);

  // เมื่อ theme เปลี่ยน → อัปเดต localStorage และ apply class
  useEffect(() => {
    localStorage.setItem("appTheme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

    const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = async () => {
    const user = auth.currentUser;
    if (!user) return alert("กรุณาเข้าสู่ระบบก่อน 🔑");

    if (newPassword.length < 6)
      return alert("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร 🔒");

    if (newPassword !== confirmPassword)
      return alert("รหัสผ่านไม่ตรงกัน ❌");

    try {
      await updatePassword(user, newPassword);
      alert("เปลี่ยนรหัสผ่านสำเร็จ ✅");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      if (error.code === "auth/requires-recent-login") {
        alert("กรุณาเข้าสู่ระบบใหม่ก่อนเปลี่ยนรหัสผ่าน 🔐");
      } else {
        alert("เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน ❌");
        console.error(error);
      }
    }
  };
  


  // ✅ รีมิตของแต่ละหมวด
  const defaultLimits = {
    "อาหาร/เครื่องดื่ม": 10000,
    "ค่าที่อยู่อาศัย/เครื่องใช้": 10000,
    "ยานพาหนะ/การเดินทาง": 10000,
    "เสื้อผ้า/รองเท้า": 10000,
    "การสื่อสาร": 10000,
    "การศึกษา": 10000,
    "เวชภัณฑ์/ค่ารักษา": 10000,
    "บันเทิง": 10000,
    "อื่นๆ": 10000,
  };
  const [limits, setLimits] = useState(defaultLimits);

  // 🪄 Crop states
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // ✏️ State สำหรับการแก้ไขชื่อ
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  // 🧠 โหลดข้อมูลผู้ใช้
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");
      setUserEmail(user.email);
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setUserName(data.name || "ผู้ใช้ใหม่");
      }

      const savedPic = localStorage.getItem("localProfilePic");
      if (savedPic) setProfilePic(savedPic);

      const savedLimits = localStorage.getItem("categoryLimits");
      if (savedLimits) setLimits(JSON.parse(savedLimits));
    });
    return () => unsubscribe();
  }, [router]);

  // ✅ ฟังก์ชันบันทึกชื่อใหม่
  const handleSaveName = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { name: newName });
      setUserName(newName);
      setEditingName(false);
      setStatusText("บันทึกชื่อเรียบร้อย ✅");
      setTimeout(() => setStatusText(""), 2000);
    } catch (error) {
      console.error(error);
      setStatusText("เกิดข้อผิดพลาด ❌");
      setTimeout(() => setStatusText(""), 2000);
    }
  };

  // ✅ บันทึกรีมิต (พร้อมหุบกลับ)
  const handleSaveLimits = () => {
    localStorage.setItem("categoryLimits", JSON.stringify(limits));
    setStatusText("บันทึกรีมิตสำเร็จ ✅");
    setTimeout(() => setStatusText(""), 2000);
    setOpenSection(null);
  };

  // ✅ ยกเลิกการแก้ไขรีมิต
  const handleCancelLimits = () => {
    const saved = localStorage.getItem("categoryLimits");
    if (saved) {
      setLimits(JSON.parse(saved));
      setStatusText("ยกเลิกการเปลี่ยนแปลงแล้ว ❌");
    } else {
      setLimits(defaultLimits);
      setStatusText("คืนค่าเริ่มต้นแล้ว 🌀");
    }
    setTimeout(() => setStatusText(""), 2000);
    setOpenSection(null);
  };

  // ✅ เปลี่ยนค่ารีมิต
  const handleLimitChange = (cat, value) => {
    setLimits((prev) => ({
      ...prev,
      [cat]: Number(value) || 0,
    }));
  };

  // 🖼️ จัดการรูปโปรไฟล์
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageToCrop(url);
    setShowCropper(true);
  };

  const handleCropComplete = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setProfilePic(croppedImage);
      localStorage.setItem("localProfilePic", croppedImage);
      setStatusText("อัปโหลดสำเร็จ ✅");
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      setShowCropper(false);
      setTimeout(() => setStatusText(""), 2000);
    }
  };

  const handleRemoveImage = () => {
    localStorage.removeItem("localProfilePic");
    setProfilePic(null);
    setStatusText("ลบรูปแล้ว ❌");
    setTimeout(() => setStatusText(""), 2000);
  };

  // 🚪 ออกจากระบบ
  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const sections = [
    { title: "ตั้งค่างบประมาณ", icon: "💰" },
    { title: "การแจ้งเตือน", icon: "🔔" },
    { title: "ธีม", icon: "🎨" },
    { title: "ข้อเสนอแนะ", icon: "💡" },
    { title: "เปลี่ยนรหัสผ่าน", icon: "🔑" },
    { title: "ออกจากระบบ", icon: "🚪" },
  ];

  return (
    <>
      {/* ✅ Header */}
      <header className="bg-blue-600 text-white px-5 py-3 font-bold text-lg flex items-center justify-start shadow-md fixed top-0 left-0 w-full z-50">
        ⚙️ ตั้งค่า
      </header>

      <motion.main
        key="settings"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-50 flex justify-center pt-16 pb-24"
      >
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl w-full max-w-md p-6">
          {/* 🧑🏻 การ์ดโปรไฟล์ */}
          <div className="bg-gradient-to-r from-blue-500 to-sky-400 rounded-2xl p-5 mb-4 text-center shadow-md relative overflow-hidden">
            <div className="relative w-24 h-24 mx-auto mb-3">
              {profilePic ? (
                <img
                  src={profilePic}
                  alt="Profile"
                  className={`w-24 h-24 object-cover rounded-full border-4 border-white shadow-md transition ${
                    uploading ? "opacity-60" : "opacity-100"
                  }`}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white/30 border-4 border-white flex items-center justify-center text-5xl shadow-md">
                  👤
                </div>
              )}
              <label
                htmlFor="fileInput"
                className="absolute -bottom-1 -right-1 bg-white text-blue-600 rounded-full p-2 cursor-pointer shadow-md hover:bg-blue-50"
                title="เปลี่ยนรูปโปรไฟล์"
              >
                ✏️
              </label>
              <input
                id="fileInput"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              {profilePic && (
                <button
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full hover:bg-red-600 transition"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 🧾 ส่วนชื่อแก้ไขได้ */}
            <div className="flex flex-col items-center">
              {editingName ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="px-3 py-1 rounded-lg text-gray-800 font-semibold border-2 border-blue-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="กรอกชื่อใหม่"
                  />
                  <button
                    onClick={handleSaveName}
                    className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 font-bold"
                  >
                    💾
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="bg-gray-300 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-400 font-bold"
                  >
                    ❌
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white text-lg">{userName}</p>
                  <button
                    onClick={() => {
                      setEditingName(true);
                      setNewName(userName);
                    }}
                    className="text-sm bg-white/30 hover:bg-white/40 text-white rounded-full p-1"
                    title="แก้ไขชื่อ"
                  >
                    ✏️
                  </button>
                </div>
              )}
              <p className="text-sm text-blue-100">{userEmail}</p>
              {statusText && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-white text-sm mt-2"
                >
                  {statusText}
                </motion.p>
              )}
            </div>
          </div>

          {/* 🔧 เมนูตั้งค่า */}
          <div className="space-y-2">
            {sections.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
              >
                <button
                  onClick={() =>
                    setOpenSection(openSection === index ? null : index)
                  }
                  className="w-full flex justify-between items-center px-4 py-3 font-semibold text-gray-800"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{item.icon}</span> {item.title}
                  </span>
                  <span
                    className={`transition-transform duration-300 ${
                      openSection === index ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>

                {/* 🔹 ตั้งค่างบประมาณ */}
                {item.title === "ตั้งค่างบประมาณ" && openSection === index && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="overflow-hidden bg-gray-50 px-4 py-3 border-t border-gray-200 space-y-3"
                  >
                    {Object.keys(limits).map((cat) => (
                      <div
                        key={cat}
                        className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm"
                      >
                        <span className="text-sm font-semibold text-gray-700">
                          {cat}
                        </span>
                        <input
                          type="number"
                          className="w-24 text-right bg-gray-50 border-2 border-blue-300 rounded-lg px-3 py-1.5 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white shadow-sm"
                          value={limits[cat]}
                          onChange={(e) => handleLimitChange(cat, e.target.value)}
                        />
                      </div>
                    ))}

                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={handleSaveLimits}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg shadow"
                      >
                        💾 บันทึก
                      </button>
                      <button
                        onClick={handleCancelLimits}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 rounded-lg shadow"
                      >
                        ❌ ยกเลิก
                      </button>
                    </div>
                  </motion.div>
                )}
                {item.title === "ธีม" && openSection === index && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="overflow-hidden bg-gray-50 px-4 py-3 border-t border-gray-200 space-y-3"
  >
    <div className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm">
      <span className="text-sm font-semibold text-gray-700">โหมดปกติ ☀️</span>
      <input
        type="radio"
        name="theme"
        className="accent-blue-600 w-5 h-5"
        checked={theme === "light"}
        onChange={() => {
          setTheme("light");
          localStorage.setItem("appTheme", "light");
        }}
      />
    </div>

    <div className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm">
      <span className="text-sm font-semibold text-gray-700">โหมดมืด 🌙</span>
      <input
        type="radio"
        name="theme"
        className="accent-blue-600 w-5 h-5"
        checked={theme === "dark"}
        onChange={() => {
          setTheme("dark");
          localStorage.setItem("appTheme", "dark");
        }}
      />
    </div>
  </motion.div>
)}

{/* 🔹 ข้อเสนอแนะ */}
{item.title === "ข้อเสนอแนะ" && openSection === index && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="overflow-hidden bg-gray-50 px-4 py-3 border-t border-gray-200 space-y-3"
  >
    <label className="block text-sm font-semibold text-gray-700 mb-1">
      ความคิดเห็นของคุณ 💬
    </label>
    <textarea
      className="w-full h-24 border-2 border-gray-300 rounded-lg p-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
      placeholder="พิมพ์ข้อเสนอแนะที่นี่..."
      value={suggestion}
      onChange={(e) => setSuggestion(e.target.value)}
    />
    <div className="flex justify-end">
      <button
        onClick={handleSendSuggestion}
        className="bg-green-500 hover:bg-green-600 text-white font-bold px-5 py-1.5 rounded-lg shadow"
      >
        ส่ง
      </button>
    </div>
  </motion.div>
)}

{/* 🔹 ออกจากระบบ */}
{item.title === "ออกจากระบบ" && openSection === index && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="overflow-hidden bg-gray-50 px-4 py-3 border-t border-gray-200 space-y-3"
  >
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setOpenSection(null)} // แค่พับกลับ
        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-lg shadow-sm transition"
      >
        ❌ ยกเลิก
      </button>

      <button
        onClick={handleLogout}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg shadow-sm transition"
      >
        🚪 ออก
      </button>
    </div>
  </motion.div>
)}
{/* 🔹 เปลี่ยนรหัสผ่าน */}
{item.title === "เปลี่ยนรหัสผ่าน" && openSection === index && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="overflow-hidden bg-gray-50 px-4 py-3 border-t border-gray-200 space-y-3"
  >
    {/* ถ้าเป็น Google → แสดงปุ่มลิงก์แทน */}
    {auth.currentUser?.providerData[0]?.providerId === "google.com" ? (
      <div className="text-center space-y-3">
        <p className="text-gray-700 font-semibold">
          บัญชีนี้ล็อกอินผ่าน <span className="text-blue-600">Google</span> 🔒
        </p>
        <p className="text-sm text-gray-500">
          หากต้องการเปลี่ยนรหัสผ่าน โปรดไปที่หน้าความปลอดภัยของ Google
        </p>
        <a
          href="https://myaccount.google.com/security"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg shadow"
        >
          🔗 ไปที่ Google Security
        </a>
      </div>
    ) : (
      <>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          รหัสผ่านใหม่ 🔐
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="กรอกรหัสผ่านใหม่"
          className="w-full border-2 border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <label className="block text-sm font-semibold text-gray-700 mb-1">
          ยืนยันรหัสผ่านอีกครั้ง 🔁
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="ยืนยันรหัสผ่านใหม่"
          className="w-full border-2 border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <div className="flex justify-end">
          <button
            onClick={handleChangePassword}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-1.5 rounded-lg shadow"
          >
            ยืนยันการเปลี่ยนรหัสผ่าน
          </button>
        </div>
      </>
    )}
  </motion.div>
)}
{/* 🔔 การแจ้งเตือน */}
{item.title === "การแจ้งเตือน" && openSection === index && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="overflow-hidden bg-gray-50 px-4 py-3 border-t border-gray-200 space-y-4"
  >
    <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
      <span className="text-sm font-semibold text-gray-700">
        การแจ้งเตือนในแอป 📱
      </span>
      <input
        type="checkbox"
        className="w-5 h-5 accent-blue-600"
        checked={notifications.inApp}
        onChange={(e) =>
          setNotifications({ ...notifications, inApp: e.target.checked })
        }
      />
    </div>

    <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
      <span className="text-sm font-semibold text-gray-700">
        การแจ้งเตือนทางอีเมล ✉️
      </span>
      <input
        type="checkbox"
        className="w-5 h-5 accent-blue-600"
        checked={notifications.email}
        onChange={(e) =>
          setNotifications({ ...notifications, email: e.target.checked })
        }
      />
    </div>

    <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
      <span className="text-sm font-semibold text-gray-700">
        การแจ้งเตือนทาง SMS 📩
      </span>
      <input
        type="checkbox"
        className="w-5 h-5 accent-blue-600"
        checked={notifications.sms}
        onChange={(e) =>
          setNotifications({ ...notifications, sms: e.target.checked })
        }
      />
    </div>

    <div className="flex gap-3 mt-3">
      <button
        onClick={handleSaveNotifications}
        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg shadow"
      >
        💾 บันทึก
      </button>
      <button
        onClick={handleResetNotifications}
        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 rounded-lg shadow"
      >
        ❌ ยกเลิก
      </button>
    </div>
  </motion.div>
)}


              </motion.div>
            ))}
          </div>
        </div>
      </motion.main>

      {/* 🪄 Modal ครอบรูป */}
      <AnimatePresence>
        {showCropper && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-50"
          >
            <div className="bg-white rounded-2xl p-4 shadow-xl w-[90%] max-w-md relative">
              <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">
                ปรับมุมและขนาดรูปโปรไฟล์
              </h2>
              <div className="relative w-full h-64 bg-gray-200 rounded-lg overflow-hidden">
                <Cropper
                  image={imageToCrop}
                  cropShape="round"
                  aspect={1}
                  crop={crop}
                  zoom={zoom}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, areaPixels) =>
                    setCroppedAreaPixels(areaPixels)
                  }
                />
              </div>
              <div className="mt-4 flex flex-col items-center">
                <label className="text-gray-600 text-sm mb-1">ซูม</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-2/3 accent-blue-600"
                />
              </div>
              <div className="flex justify-between mt-5">
                <button
                  onClick={() => setShowCropper(false)}
                  className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleCropComplete}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  ใช้รูปนี้
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </>
  );
}
