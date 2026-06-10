import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import { AddCardForm } from "./AddCardForm";

export default async function NewFlashcardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <SupabaseNotice />
      </main>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("selected_language")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/learn/flashcards"
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← 플래시카드
        </Link>
        <h1 className="mt-2 text-2xl font-bold">카드 추가</h1>
      </header>

      <AddCardForm language={profile?.selected_language ?? "english"} />
    </main>
  );
}
