import { NextResponse } from "next/server";
import Tesseract from "tesseract.js";

export async function POST(req) {
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64)
      return NextResponse.json({ error: "No imageBase64" }, { status: 400 });

    // 🧠 ใช้ Tesseract.js ประมวลผล OCR
    const buffer = Buffer.from(imageBase64, "base64");
    const result = await Tesseract.recognize(buffer, "tha+eng"); // ไทย + อังกฤษ
    const text = result.data.text || "";

    // 🧾 แยกรายการสินค้าและราคา
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const items = [];
    for (const line of lines) {
      const match = line.match(/(.+?)\s+(\d+(?:\.\d{1,2})?)\s*(?:บาท)?$/);
      if (match) {
        items.push({ name: match[1], price: parseFloat(match[2]) });
      }
    }

    // 🗓️ แยกวันที่
    const dateMatch =
      text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/) ||
      text.match(/วันที่[:\s]*(\d{1,2}\s*[A-Za-zก-ฮ]+\s*\d{2,4})/);
    const date = dateMatch ? dateMatch[1] : "ไม่พบวันที่";

    return NextResponse.json({ data: { date, items, rawText: text } });
  } catch (err) {
    console.error("OCR Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
