"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";

export default function LimitNotificationModal({ isOpen, onClose, limitData }) {
  const { theme } = useTheme();

  if (!limitData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - เบลอแบบเชยๆ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className={`rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden ${
                theme === "dark" ? "bg-gray-800" : "bg-white"
              }`}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-red-600 p-5 text-white relative">
                <div className="flex items-center gap-3">
                  <span className="text-5xl">⚠️</span>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">เตือนงบประมาณ!</h2>
                    <p className="text-base font-semibold text-orange-100 mt-1">{limitData.category}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center transition-all text-white font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                {/* หมวดหมู่ */}
                <div className={`p-4 rounded-xl border-2 ${
                  limitData.isOver
                    ? theme === "dark"
                      ? "bg-red-900 bg-opacity-30 border-red-700"
                      : "bg-red-50 border-red-400"
                    : theme === "dark"
                    ? "bg-orange-900 bg-opacity-30 border-orange-700"
                    : "bg-orange-50 border-orange-400"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`font-bold text-lg ${
                      limitData.isOver
                        ? "text-red-600"
                        : theme === "dark" ? "text-orange-400" : "text-orange-700"
                    }`}>
                      {limitData.category}
                    </p>
                    <span className="text-3xl">
                      {limitData.isOver ? "🔴" : "⚡"}
                    </span>
                  </div>

                  {/* ยอดเงิน */}
                  <div className="space-y-2 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                        ใช้จ่ายไป:
                      </span>
                      <span className={`font-bold ${
                        limitData.isOver ? "text-red-600" : theme === "dark" ? "text-orange-400" : "text-orange-700"
                      }`}>
                        {limitData.amount.toLocaleString()} บาท
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                        งบที่ตั้งไว้:
                      </span>
                      <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
                        {limitData.limit.toLocaleString()} บาท
                      </span>
                    </div>

                    {limitData.isOver && (
                      <div className={`flex justify-between pt-2 border-t ${
                        theme === "dark" ? "border-red-800" : "border-red-300"
                      }`}>
                        <span className="font-bold text-gray-700">เกินไป:</span>
                        <span className="font-bold text-red-600 text-base">
                          +{(limitData.amount - limitData.limit).toLocaleString()} บาท
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className={`h-3 rounded-full overflow-hidden ${
                    theme === "dark" ? "bg-gray-700" : "bg-gray-200"
                  }`}>
                    <div
                      className={`h-full transition-all ${
                        limitData.isOver ? "bg-red-600" : "bg-orange-500"
                      }`}
                      style={{ width: `${Math.min(limitData.percent, 100)}%` }}
                    />
                  </div>
                  <p className={`text-xs text-right mt-1 font-bold ${
                    limitData.isOver ? "text-red-600" : "text-orange-600"
                  }`}>
                    {limitData.percent}%
                  </p>
                </div>

                {/* คำแนะนำ */}
                <div className={`mt-4 p-3 rounded-xl ${
                  theme === "dark" 
                    ? "bg-blue-900 bg-opacity-30 border border-blue-700" 
                    : "bg-blue-50 border border-blue-200"
                }`}>
                  <div className="flex items-start gap-2">
                    <span className="text-xl">💡</span>
                    <p className={`text-sm ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}>
                      {limitData.isOver
                        ? "คุณใช้จ่ายเกินงบแล้ว! ควรตรวจสอบรายจ่ายและลดค่าใช้จ่ายในหมวดนี้"
                        : "คุณใช้จ่ายใกล้ถึงลิมิตแล้ว ควรระมัดระวังการใช้จ่ายในหมวดนี้"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={`p-4 border-t ${
                theme === "dark" ? "border-gray-700" : "border-gray-200"
              }`}>
                <button
                  onClick={onClose}
                  className={`w-full py-3 rounded-xl font-bold text-white transition-all active:scale-95 ${
                    limitData.isOver
                      ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
                      : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                  }`}
                >
                  รับทราบ
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
