import { redirect } from "next/navigation";
import Link from "next/link";
import type { Language } from "@nativo/core";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import { evaluatePhase1, type Condition } from "@/lib/phase";

const LANGUAGE_LABEL: Record<Language, string> = {
  english: "영어 🇺🇸",
  spanish: "스페인어 🇪🇸",
  japanese: "일본어 🇯🇵",
};

const PHASE_TITLE: Record<number, string> = {
  1: "기초 — SRS 플래시카드",
  2: "Chunk — 영어식 사고",
  3: "쉐도잉 — 발음·억양",
  4: "스피킹 — AI 롤플레이",
  5: "번역 — 원어민 확장",
};

export default async function DashboardPage() {
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
    .select("display_name, selected_language, current_phase, current_level")
    .eq("id", user.id)
    .single();

  const language = profile?.selected_language ?? "english";
  const phase = profile?.current_phase ?? 1;
  const level = profile?.current_level ?? "A2";
  const name = profile?.display_name ?? user.email ?? "학습자";

  // Phase 1 진행도 (카드 수 / 최고 스트릭 — 테스트 점수는 응시 시 확인)
  const { count: cardCount } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("language", language);
  const { data: streakRow } = await supabase
    .from("daily_logs")
    .select("streak_day")
    .eq("user_id", user.id)
    .eq("language", language)
    .order("streak_day", { ascending: false })
    .limit(1)
    .maybeSingle();
  const phase1 = evaluatePhase1({
    cardCount: cardCount ?? 0,
    bestStreak: streakRow?.streak_day ?? 0,
    testScore: null,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10 flex items-start justify-between">
        <div>
          <p className="text-sm text-neutral-500">안녕하세요,</p>
          <h1 className="text-2xl font-bold">{name}님</h1>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-50"
          >
            로그아웃
          </button>
        </form>
      </header>

      <section className="mb-8 grid grid-cols-3 gap-4">
        <StatCard label="학습 언어" value={LANGUAGE_LABEL[language]} />
        <StatCard label="현재 Phase" value={`Phase ${phase}`} />
        <StatCard label="레벨" value={level} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-500">현재 단계</h2>
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <p className="text-lg font-semibold">
            Phase {phase} — {PHASE_TITLE[phase]}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            오늘의 학습을 이어가세요.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/learn/flashcards"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90"
            >
              플래시카드 학습
            </Link>
            <Link
              href="/learn/routine"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-50"
            >
              오늘의 루틴
            </Link>
            <Link
              href="/learn/test"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-50"
            >
              단어 테스트
            </Link>
            <Link
              href="/onboarding"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-50"
            >
              설정 변경
            </Link>
          </div>
        </div>
      </section>

      {phase === 1 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-neutral-500">
            Phase 1 졸업 조건
          </h2>
          <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-6">
            <ProgressBar label="플래시카드" c={phase1.cards} unit="개" />
            <ProgressBar label="루틴 스트릭" c={phase1.streak} unit="일" />
            <p className="pt-1 text-xs text-neutral-500">
              + 단어 테스트 70점 이상 (응시 시 확인)
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

function ProgressBar({
  label,
  c,
  unit,
}: {
  label: string;
  c: Condition;
  unit: string;
}) {
  const current = c.current ?? 0;
  const pct = Math.min(100, Math.round((current / c.required) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={c.met ? "text-green-600" : "text-neutral-500"}>
          {c.met ? "✓ " : ""}
          {current}/{c.required}
          {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full ${c.met ? "bg-green-500" : "bg-brand"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
