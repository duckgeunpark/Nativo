"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CefrLevel, Language } from "@nativo/core";
import {
  User,
  BookOpen,
  MessageCircle,
  Minus,
  Plus,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Play,
  KeyRound,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { saveSettings, saveApiKey, clearApiKey } from "./actions";
import {
  SESSION_SIZE,
  SESSION_MIN,
  SESSION_MAX,
  clampSize,
} from "@/lib/session-size";
import {
  TTS_RATES,
  AI_VOICES,
  getAutoSpeak,
  setAutoSpeak as persistAutoSpeak,
  getTtsRate,
  setTtsRate,
  getTtsVoiceURI,
  setTtsVoiceURI,
  getTtsEngine,
  setTtsEngine,
  getAiVoice,
  setAiVoice,
  getRoleplayStyle,
  setRoleplayStyle,
  type AiVoice,
  type TtsEngine,
  type ReplyLength,
  type ReplyDifficulty,
} from "@/lib/prefs";
import { getVoicesFor, isSpeechSupported, speak } from "@/lib/tts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const LANGUAGES: { value: Language; label: string; flag: string }[] = [
  { value: "english", label: "영어", flag: "🇺🇸" },
  { value: "spanish", label: "스페인어", flag: "🇪🇸" },
  { value: "japanese", label: "일본어", flag: "🇯🇵" },
];

const LEVELS: { value: CefrLevel; label: string }[] = [
  { value: "A1", label: "A1 입문" },
  { value: "A2", label: "A2 초급" },
  { value: "B1", label: "B1 중급" },
  { value: "B2", label: "B2 중상급" },
  { value: "C1", label: "C1 고급" },
  { value: "C2", label: "C2 원어민급" },
];

/** 음성 미리 듣기 샘플 문장. */
const VOICE_SAMPLE: Record<Language, string> = {
  english: "Hi! This is how I sound.",
  spanish: "¡Hola! Así es como sueno.",
  japanese: "こんにちは。こんな声です。",
};

function setCookie(name: string, value: number) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

interface Initial {
  language: Language;
  level: CefrLevel;
  displayName: string;
  flashcardSize: number;
  chunkSize: number;
  /** 저장된 개인 API 키의 마스킹 표시 (예: "sk-…abcd"), 없으면 null. */
  personalKeyMasked: string | null;
  /** 서버 환경변수 키 존재 여부 — 개인 키가 없을 때의 폴백. */
  hasEnvKey: boolean;
}

/** 기기별 환경설정(localStorage) 폼 값 — 저장 전까지는 상태로만 유지. */
interface DevicePrefs {
  autoSpeak: boolean;
  engine: TtsEngine;
  aiVoice: AiVoice;
  rate: number;
  voiceURI: string; // "" = 브라우저 기본 목소리
  replyLength: ReplyLength;
  difficulty: ReplyDifficulty;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initial.language);
  const [level, setLevel] = useState<CefrLevel>(initial.level);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [flashcardSize, setFlashcardSize] = useState(initial.flashcardSize);
  const [chunkSize, setChunkSize] = useState(initial.chunkSize);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  // 기기별 환경설정: SSR에는 없으므로 마운트 후 localStorage 에서 로드
  const [prefs, setPrefs] = useState<DevicePrefs | null>(null);
  const [prefsBase, setPrefsBase] = useState<DevicePrefs | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const style = getRoleplayStyle();
    const loaded: DevicePrefs = {
      autoSpeak: getAutoSpeak(),
      engine: getTtsEngine(),
      aiVoice: getAiVoice(),
      rate: getTtsRate(),
      voiceURI: getTtsVoiceURI(language) ?? "",
      replyLength: style.length,
      difficulty: style.difficulty,
    };
    setPrefs(loaded);
    setPrefsBase(loaded);
  }, [language]);

  // 학습 언어에 맞는 브라우저 목소리 목록 (voiceschanged 이후 채워질 수 있음)
  useEffect(() => {
    if (!isSpeechSupported()) return;
    const load = () => setVoices(getVoicesFor(language));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [language]);

  function updatePrefs(patch: Partial<DevicePrefs>) {
    setPrefs((p) => (p ? { ...p, ...patch } : p));
    setState("idle");
  }

  /** 저장 전 값으로 미리 듣기 — speak() 에 오버라이드를 넘겨 그대로 재생. */
  function previewVoice() {
    if (!prefs) return;
    speak(VOICE_SAMPLE[language], language, {
      engine: prefs.engine,
      aiVoice: prefs.aiVoice,
      rate: prefs.rate,
      voiceURI: prefs.voiceURI || null,
    });
  }

  const prefsDirty = useMemo(() => {
    if (!prefs || !prefsBase) return false;
    return (
      prefs.autoSpeak !== prefsBase.autoSpeak ||
      prefs.engine !== prefsBase.engine ||
      prefs.aiVoice !== prefsBase.aiVoice ||
      prefs.rate !== prefsBase.rate ||
      prefs.voiceURI !== prefsBase.voiceURI ||
      prefs.replyLength !== prefsBase.replyLength ||
      prefs.difficulty !== prefsBase.difficulty
    );
  }, [prefs, prefsBase]);

  const dirty = useMemo(
    () =>
      language !== initial.language ||
      level !== initial.level ||
      displayName.trim() !== initial.displayName.trim() ||
      flashcardSize !== initial.flashcardSize ||
      chunkSize !== initial.chunkSize ||
      prefsDirty,
    [language, level, displayName, flashcardSize, chunkSize, prefsDirty, initial],
  );

  async function save() {
    if (!dirty || state === "saving") return;
    setState("saving");
    setError(null);
    const res = await saveSettings({ language, level, displayName });
    if (!res.ok) {
      setState("error");
      setError(res.error ?? "알 수 없는 오류가 발생했어요.");
      return;
    }
    // 회당 학습량은 쿠키로(기기별)
    setCookie(SESSION_SIZE.flashcard.cookie, clampSize(flashcardSize, SESSION_SIZE.flashcard.default));
    setCookie(SESSION_SIZE.chunk.cookie, clampSize(chunkSize, SESSION_SIZE.chunk.default));
    // 음성·대화 스타일은 localStorage 로(기기별)
    if (prefs) {
      persistAutoSpeak(prefs.autoSpeak);
      setTtsEngine(prefs.engine);
      setAiVoice(prefs.aiVoice);
      setTtsRate(prefs.rate);
      setTtsVoiceURI(language, prefs.voiceURI || null);
      setRoleplayStyle({ length: prefs.replyLength, difficulty: prefs.difficulty });
      setPrefsBase(prefs);
    }
    setState("saved");
    router.refresh();
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" aria-hidden />
            프로필
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-muted-foreground">닉네임</span>
            <Input
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value.slice(0, 40));
                setState("idle");
              }}
              placeholder="표시할 이름을 입력하세요"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">학습 언어</span>
            <SelectField
              value={language}
              onChange={(v) => {
                setLanguage(v as Language);
                setState("idle");
              }}
              options={LANGUAGES.map((l) => ({ value: l.value, label: `${l.flag} ${l.label}` }))}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">CEFR 레벨</span>
            <SelectField
              value={level}
              onChange={(v) => {
                setLevel(v as CefrLevel);
                setState("idle");
              }}
              options={LEVELS}
            />
          </label>
        </CardContent>
      </Card>

      <ApiKeyCard masked={initial.personalKeyMasked} hasEnvKey={initial.hasEnvKey} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden />
            학습
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <StepperField
            label="회당 플래시카드 수"
            hint={`권장 ${SESSION_MIN}~${SESSION_MAX}장 (복습 도래 카드는 제한 없이 모두 나와요)`}
            value={flashcardSize}
            onChange={(v) => {
              setFlashcardSize(v);
              setState("idle");
            }}
          />
          <StepperField
            label="회당 청크 수"
            hint={`권장 ${SESSION_MIN}~${SESSION_MAX}개 (복습 도래 청크는 제한 없이 모두 나와요)`}
            value={chunkSize}
            onChange={(v) => {
              setChunkSize(v);
              setState("idle");
            }}
          />
        </CardContent>
      </Card>

      {prefs && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Volume2 className="h-4 w-4 text-muted-foreground" aria-hidden />
              음성
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              발음 듣기와 AI 대화 음성에 적용돼요. 이 기기에만 저장됩니다.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleField
              label="AI 응답 자동 재생"
              hint="AI 대화에서 응답이 오면 자동으로 소리 내어 읽어줘요"
              value={prefs.autoSpeak}
              onChange={(v) => updatePrefs({ autoSpeak: v })}
            />
            <SegmentedField
              label="음성 엔진"
              value={prefs.engine}
              onChange={(v) => updatePrefs({ engine: v as TtsEngine })}
              options={[
                { value: "ai", label: "AI 음성 (자연스러움)" },
                { value: "browser", label: "브라우저 기본" },
              ]}
            />
            <SegmentedField
              label="말하기 속도"
              value={String(prefs.rate)}
              onChange={(v) => updatePrefs({ rate: Number(v) })}
              options={TTS_RATES.map((r) => ({ value: String(r.value), label: r.label }))}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">목소리</p>
                <p className="text-xs text-muted-foreground">
                  {prefs.engine === "ai"
                    ? "11가지 자연스러운 목소리 중에서 골라요 (모든 언어 지원)"
                    : voices.length > 0
                      ? "브라우저가 제공하는 목소리 중에서 골라요"
                      : "이 브라우저에서 사용할 수 있는 목소리가 없어요"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {prefs.engine === "ai" ? (
                  <select
                    value={prefs.aiVoice}
                    onChange={(e) => updatePrefs({ aiVoice: e.target.value as AiVoice })}
                    className={cn(
                      "flex h-9 w-full max-w-56 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    aria-label="AI 목소리 선택"
                  >
                    {AI_VOICES.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={prefs.voiceURI}
                    onChange={(e) => updatePrefs({ voiceURI: e.target.value })}
                    disabled={voices.length === 0}
                    className={cn(
                      "flex h-9 w-full max-w-56 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                    aria-label="목소리 선택"
                  >
                    <option value="">기본 목소리</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={previewVoice}
                  aria-label="목소리 미리 듣기"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden /> 미리 듣기
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {prefs && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
              AI 대화
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              AI 역할극에서 상대의 말하기 방식을 조절해요. 이 기기에만 저장됩니다.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <SegmentedField
              label="응답 길이"
              value={prefs.replyLength}
              onChange={(v) => updatePrefs({ replyLength: v as ReplyLength })}
              options={[
                { value: "short", label: "짧게" },
                { value: "normal", label: "보통" },
              ]}
            />
            <SegmentedField
              label="난이도"
              value={prefs.difficulty}
              onChange={(v) => updatePrefs({ difficulty: v as ReplyDifficulty })}
              options={[
                { value: "match", label: "내 레벨에 맞게" },
                { value: "challenge", label: "도전적으로" },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {state === "saved" && !dirty && (
        <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          저장했어요.
        </div>
      )}
      {state === "error" && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          저장하지 못했어요{error ? `: ${error}` : ""}
        </div>
      )}

      {/* 모바일에서는 하단 고정, 데스크톱에서는 인라인 */}
      <div className="sticky bottom-16 z-30 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={!dirty || state === "saving"}>
            {state === "saving" ? "저장 중…" : "변경사항 저장"}
          </Button>
          {dirty && state !== "saving" && (
            <span className="text-xs text-muted-foreground">저장하지 않은 변경사항이 있어요</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 개인 OpenAI API 키 카드 — 즉시 저장/삭제 (메인 저장 버튼과 별개).
 * 키 원문은 httpOnly 쿠키에만 있고 화면에는 마스킹 값만 내려온다.
 */
function ApiKeyCard({ masked, hasEnvKey }: { masked: string | null; hasEnvKey: boolean }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = key.trim();
    if (!trimmed || state === "saving") return;
    setState("saving");
    setError(null);
    const res = await saveApiKey(trimmed);
    if (!res.ok) {
      setState("error");
      setError(res.error ?? "알 수 없는 오류가 발생했어요.");
      return;
    }
    setKey("");
    setState("saved");
    router.refresh();
  }

  async function remove() {
    if (state === "saving") return;
    setState("saving");
    setError(null);
    await clearApiKey();
    setState("idle");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
          AI 서비스 (OpenAI API 키)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          AI 대화·피드백·힌트·번역·음성에 사용돼요. 키는 이 브라우저에만 안전하게(httpOnly
          쿠키) 저장되고, 서버 기본 키보다 우선 적용돼요.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {masked ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-success/10 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              개인 키 사용 중: <span className="font-mono">{masked}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={remove}
              disabled={state === "saving"}
              className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> 삭제
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {hasEnvKey
              ? "지금은 서버 기본 키로 동작 중이에요. 개인 키를 저장하면 그 키를 대신 사용해요."
              : "저장된 키가 없어 AI 기능이 꺼져 있어요. 키를 입력하면 AI 대화·피드백·음성이 켜져요."}
          </p>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={show ? "text" : "password"}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setState("idle");
              }}
              placeholder={masked ? "새 키로 교체하려면 입력…" : "sk-..."}
              autoComplete="off"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={show ? "키 숨기기" : "키 표시"}
            >
              {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          <Button
            type="button"
            onClick={save}
            disabled={!key.trim() || state === "saving"}
            className="shrink-0"
          >
            {state === "saving" ? "확인 중…" : "키 저장"}
          </Button>
        </div>

        {state === "saved" && (
          <p className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            키를 확인하고 저장했어요. 이제 모든 AI 기능에 이 키가 쓰여요.
          </p>
        )}
        {state === "error" && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function StepperField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const atMin = value <= SESSION_MIN;
  const atMax = value >= SESSION_MAX;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`${label} 줄이기`}
          disabled={atMin}
          onClick={() => onChange(clampSize(value - 1, value))}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="w-12 text-center text-sm font-medium tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`${label} 늘리기`}
          disabled={atMax}
          onClick={() => onChange(clampSize(value + 1, value))}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** ON/OFF 스위치 필드. */
function ToggleField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          value ? "bg-primary" : "bg-secondary",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-[left]",
            value ? "left-[22px]" : "left-0.5",
          )}
          aria-hidden
        />
      </button>
    </div>
  );
}

/** 2~3개 선택지 세그먼트 필드. */
function SegmentedField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex shrink-0 rounded-lg bg-secondary p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              value === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
