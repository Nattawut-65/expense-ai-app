"use client";
import { useState, useEffect } from "react";
import { Camera, X, ImageIcon, RefreshCw, Save } from "lucide-react";
import Tesseract from "tesseract.js";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function ScanReceiptModal({ isOpen, onClose }) {
  const [image, setImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [items, setItems] = useState([]);
  const [date, setDate] = useState("");
  const [store, setStore] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // ✅ รีเซ็ตเมื่อปิด
  useEffect(() => {
    if (!isOpen) {
      setImage(null);
      setProcessing(false);
      setSuccess(false);
      setError(null);
      setItems([]);
      setDate("");
      setStore("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ✅ เลือกรูป
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setImage(URL.createObjectURL(file));
  };

  // ✅ แปลงวันที่เป็น พ.ศ.
  const toThaiDate = (dateStr) => {
    try {
      const [d, m, y] = dateStr.split(/[\/\-\.]/);
      const months = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
      ];
      const month = months[parseInt(m) - 1];
      return `${parseInt(d)} ${month} ${parseInt(y) + 543}`;
    } catch {
      return dateStr;
    }
  };

  // ✅ คืนวันที่ปัจจุบันในรูปแบบไทย
  const getTodayThaiDate = () => {
    const now = new Date();
    const d = now.getDate();
    const m = now.getMonth();
    const y = now.getFullYear() + 543;
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
    ];
    return `${d} ${months[m]} ${y}`;
  };

  // ✅ OCR
  const handleProcess = async () => {
    if (!image) return;
    setProcessing(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(image);
      const blob = await response.blob();
      const result = await Tesseract.recognize(blob, "tha+eng", {
        logger: (m) => console.log(m),
      });

      const text = result.data.text;
      console.log("OCR text:", text);

      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const extractedItems = [];
      let extractedDate = "";
      let detectedStore = "";

      // ✅ regex และคำต้องห้าม
      const dateRegex = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/;
      const storeKeywords = [
        "7-Eleven", "เซเว่น", "Tesco", "Lotus", "Big C", "Mini Big C",
        "Makro", "FamilyMart", "CP", "PTT", "ร้าน", "supermarket",
      ];
      const ignoreKeywords = [
        "รวม", "ยอดรวม", "เงินรวม", "รวมทั้งหมด",
        "เงินสด", "cash", "change", "เงินทอน",
        "nonvat", "non-vat", "vat", "ภาษี", "tax",
        "เครดิต", "debit", "ชำระ", "total", "payment",
      ];

      for (const line of lines) {
        const lower = line.toLowerCase();

        // ❌ ข้ามคำต้องห้าม
        if (ignoreKeywords.some((k) => lower.includes(k))) continue;

        // 🏪 ชื่อร้าน
        if (!detectedStore && storeKeywords.some((k) => line.includes(k))) {
          detectedStore = line;
        }

        // 📅 วันที่
        if (dateRegex.test(line)) {
          extractedDate = line.match(dateRegex)[0];
          continue;
        }

        // 💰 รายการสินค้า
        const match = line.match(/(.+?)\s+(\d+(?:\.\d{1,2})?)\s*(?:บาท)?$/);
        if (match) extractedItems.push({ name: match[1], amount: match[2] });
      }

      // 📅 ถ้าไม่เจอวันที่ → ใช้วันปัจจุบัน
      if (!extractedDate) {
        const altDateMatch = text.match(/วันที่[:\s]*(\d{1,2}\s*[A-Za-zก-ฮ]+\s*\d{2,4})/);
        if (altDateMatch) extractedDate = altDateMatch[1];
        else extractedDate = getTodayThaiDate(); // ✅ fallback
      } else {
        extractedDate = toThaiDate(extractedDate);
      }

      setItems(extractedItems);
      setDate(extractedDate);
      setStore(detectedStore || "ไม่พบชื่อร้าน");
      setSuccess(true);
    } catch (err) {
      setError("❌ " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ✅ บันทึก Firebase
  const handleSave = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนบันทึก");

      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        type: "expense",
        store,
        items,
        date,
        createdAt: serverTimestamp(),
      });

      alert("✅ บันทึกข้อมูลสำเร็จ!");
      onClose();
    } catch (err) {
      alert("❌ เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleReset = () => {
    setImage(null);
    setProcessing(false);
    setSuccess(false);
    setError(null);
    setItems([]);
    setDate("");
    setStore("");
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-fadeIn border border-gray-200">
        {/* Header */}
        <div className="flex justify-between items-center bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 rounded-t-2xl shadow">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Camera size={18} /> สแกนใบเสร็จ
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1">
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Upload Box */}
          <div className="relative border-2 border-dashed border-blue-400 rounded-xl h-[180px] bg-gray-50 flex flex-col items-center justify-center hover:bg-blue-50 transition-all">
            {!image ? (
              <label className="flex flex-col items-center text-gray-500 text-xs cursor-pointer">
                <ImageIcon className="w-10 h-10 mb-2 text-gray-400" />
                <p className="text-center leading-relaxed font-medium">
                  📷 คลิกเพื่อเลือกรูปภาพจากเครื่อง<br />รองรับ JPG / PNG
                </p>
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </label>
            ) : (
              <>
                <img src={image} alt="preview" className="max-h-[150px] w-auto mx-auto rounded-lg object-contain" />
                <button
                  onClick={handleReset}
                  className="absolute bottom-2 right-2 bg-white text-gray-700 border border-gray-300 rounded-full px-2 py-1 text-[10px] font-semibold shadow hover:bg-gray-100"
                >
                  <RefreshCw size={10} className="inline mr-1" /> เปลี่ยนรูป
                </button>
              </>
            )}
          </div>

          {/* Status */}
          {processing && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl text-blue-700 text-sm font-medium shadow-sm">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              กำลังประมวลผล...
            </div>
          )}
          {success && <div className="bg-green-50 border border-green-200 px-3 py-2 rounded-xl text-green-700 text-sm font-semibold flex items-center gap-2 shadow-sm">✅ สแกนสำเร็จ!</div>}
          {error && <div className="bg-red-50 border border-red-200 px-3 py-2 rounded-xl text-red-600 text-sm font-medium shadow-sm">{error}</div>}

          {/* OCR Result */}
          {items.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-700 shadow-inner max-h-[220px] overflow-y-auto">
              <p className="font-bold mb-1">🏪 ร้านค้า: {store}</p>
              <p className="font-bold mb-1">📅 วันที่: {date}</p>
              <ul className="list-disc list-inside space-y-1">
                {items.map((i, idx) => (
                  <li key={idx}>
                    {i.name} — {i.amount} บาท
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleProcess}
              disabled={!image || processing}
              className={`w-full py-2.5 rounded-lg font-bold text-white text-sm shadow-md transition-all ${
                image && !processing ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:scale-[1.02]" : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {processing ? "⏳ กำลังประมวลผล..." : "🤖 ประมวลผลด้วย OCR"}
            </button>

            {success && (
              <button
                onClick={handleSave}
                className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-1"
              >
                <Save size={14} /> บันทึกลง Firebase
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>

      {/* Animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(15px);
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
