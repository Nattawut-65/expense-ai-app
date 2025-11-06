import { redirect } from "next/navigation";

export default function Page() {
  redirect("/login"); // 👈 ให้เด้งไปหน้า login
}