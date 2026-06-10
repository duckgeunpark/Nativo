import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginButtons } from "./LoginButtons";
import { EmailAuthForm } from "./EmailAuthForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Nativo</CardTitle>
          <CardDescription>Speak your way to native.</CardDescription>
        </CardHeader>
        <CardContent>
          {isSupabaseConfigured() ? (
            <div className="flex flex-col gap-5">
              <EmailAuthForm />
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                또는
                <span className="h-px flex-1 bg-border" />
              </div>
              <LoginButtons />
            </div>
          ) : (
            <SupabaseNotice />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
