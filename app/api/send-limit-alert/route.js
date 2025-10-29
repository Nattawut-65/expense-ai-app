import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { email, category, amount, limit, percent, isOver } = await request.json();

    // ในโปรเจคจริง ควรใช้ส service เช่น SendGrid, Resend, หรือ Nodemailer
    // ตัวอย่างนี้จะ log ข้อมูลแทน
    
    console.log("📧 ส่งอีเมลแจ้งเตือน:", {
      to: email,
      subject: `⚠️ แจ้งเตือนงบประมาณ: ${category}`,
      message: isOver 
        ? `คุณใช้จ่ายเกินงบประมาณในหมวด "${category}" แล้ว!\n\nยอดใช้จ่าย: ${amount.toLocaleString()} บาท\nงบที่ตั้งไว้: ${limit.toLocaleString()} บาท\nเกินไป: ${(amount - limit).toLocaleString()} บาท (${percent}%)`
        : `คุณใช้จ่ายในหมวด "${category}" ใกล้ถึงงบประมาณแล้ว!\n\nยอดใช้จ่าย: ${amount.toLocaleString()} บาท\nงบที่ตั้งไว้: ${limit.toLocaleString()} บาท\nใช้ไปแล้ว: ${percent}%`
    });

    // TODO: เพิ่มโค้ดส่งอีเมลจริงตรงนี้
    // ตัวอย่างการใช้ Resend:
    /*
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'Expense AI <onboarding@resend.dev>',
      to: email,
      subject: `⚠️ แจ้งเตือนงบประมาณ: ${category}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(to right, #f97316, #dc2626); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">⚠️ แจ้งเตือนงบประมาณ</h1>
          </div>
          <div style="padding: 20px; background: #f9fafb;">
            <h2 style="color: #1f2937;">หมวด: ${category}</h2>
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p><strong>ยอดใช้จ่าย:</strong> ${amount.toLocaleString()} บาท</p>
              <p><strong>งบที่ตั้งไว้:</strong> ${limit.toLocaleString()} บาท</p>
              ${isOver 
                ? `<p style="color: #dc2626;"><strong>เกินไป:</strong> ${(amount - limit).toLocaleString()} บาท</p>` 
                : `<p style="color: #f97316;"><strong>ใช้ไปแล้ว:</strong> ${percent}%</p>`
              }
            </div>
            <div style="background: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0; color: #1e40af;">
                💡 ${isOver 
                  ? 'คุณใช้จ่ายเกินงบแล้ว! ควรตรวจสอบรายจ่ายและลดค่าใช้จ่ายในหมวดนี้' 
                  : 'คุณใช้จ่ายใกล้ถึงลิมิตแล้ว ควรระมัดระวังการใช้จ่ายในหมวดนี้'}
              </p>
            </div>
          </div>
        </div>
      `
    });
    */

    return NextResponse.json({ 
      success: true, 
      message: "Email notification logged (implement actual email service)" 
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
