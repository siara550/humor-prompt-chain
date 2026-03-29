import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import FlavorsList from "./FlavorsList";
import LogoutButton from "./LogoutButton";

export default async function FlavorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin, is_matrix_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_superadmin && !profile?.is_matrix_admin) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-red-400">Access Denied — Superadmin or Matrix Admin only.</p>
      </main>
    );
  }

  const { data: flavors } = await supabase
    .from("humor_flavors")
    .select("id, description, slug, created_datetime_utc")
    .order("created_datetime_utc", { ascending: false });

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 h-14 bg-black/90 backdrop-blur border-b border-white/10">
        <span className="font-bold text-lg tracking-tight">
          Prompt Chain <span className="text-orange-500">Tool</span>
        </span>
        <LogoutButton />
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-bold mb-2">Humor Flavors</h1>
        <p className="text-white/50 mb-8">Create and manage humor flavors and their prompt steps.</p>
        <FlavorsList initialFlavors={flavors ?? []} userId={user.id} />
      </div>
    </main>
  );
}