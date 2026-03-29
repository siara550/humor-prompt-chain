"use client";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };
  return (
    <button onClick={handleLogout} className="text-sm text-white/60 hover:text-white border border-white/20 rounded-full px-4 py-1.5 transition">
      Sign out
    </button>
  );
}