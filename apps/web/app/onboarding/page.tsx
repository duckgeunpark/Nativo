import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
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
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">어떤 언어를 배울까요?</CardTitle>
          <CardDescription>지금 고른 언어로 바로 시작해요. 언제든 바꿀 수 있어요.</CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm
            initial={{ selectedLanguage: profile?.selected_language ?? "english" }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
