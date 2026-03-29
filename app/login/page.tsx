"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const signIn = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) alert(error.message);
    } finally { setLoading(false); }
  };
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
        <p className="text-xs text-white/50">Humor Project · Prompt Chain Tool</p>
        <h1 className="mt-2 text-3xl font-semibold">Sign In</h1>
        <p className="mt-2 text-sm text-white/60">Superadmin or Matrix Admin access required.</p>
        <button onClick={signIn} disabled={loading}
          className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-60">
          {loading ? "Opening Google…" : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}