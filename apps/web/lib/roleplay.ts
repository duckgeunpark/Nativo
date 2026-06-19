/** AI 롤플레이 시나리오 정의 + 시스템 프롬프트 빌더. */

import type { Language } from "@nativo/core";

export interface Scenario {
  id: string;
  emoji: string;
  title: string;
  category: string;
  aiRole: string; // AI가 맡는 역할 (한국어 안내)
  userMission: string; // 사용자 미션 (한국어 안내)
}

export const SCENARIOS: Scenario[] = [
  {
    id: "cafe",
    emoji: "☕",
    title: "카페에서 주문하기",
    category: "일상",
    aiRole: "카페 점원",
    userMission: "음료를 주문하고 커스텀(샷 추가 등)을 요청하기",
  },
  {
    id: "airport",
    emoji: "✈️",
    title: "공항 수하물 문제",
    category: "여행",
    aiRole: "항공사 카운터 직원",
    userMission: "초과 수하물 요금을 깎아보기",
  },
  {
    id: "refund",
    emoji: "🛍️",
    title: "환불 요청 (까다로운 직원)",
    category: "일상",
    aiRole: "환불을 꺼리는 매장 직원",
    userMission: "3일 된 제품을 환불받기",
  },
  {
    id: "interview",
    emoji: "💼",
    title: "취업 면접",
    category: "비즈니스",
    aiRole: "면접관",
    userMission: "자기소개와 강점을 어필하기",
  },
  {
    id: "smalltalk",
    emoji: "🙂",
    title: "처음 만난 사람과 스몰토크",
    category: "소셜",
    aiRole: "파티에서 처음 만난 사람",
    userMission: "공통 관심사를 찾아 대화를 이어가기",
  },
  {
    id: "restaurant",
    emoji: "🍝",
    title: "식당에서 컴플레인",
    category: "일상",
    aiRole: "식당 매니저",
    userMission: "잘못 나온 음식을 정중히 교환받기",
  },
  {
    id: "doctor",
    emoji: "🏥",
    title: "병원 진료 받기",
    category: "일상",
    aiRole: "의사",
    userMission: "증상을 설명하고 처방을 받기",
  },
  {
    id: "hotel",
    emoji: "🏨",
    title: "호텔 체크인 문제",
    category: "여행",
    aiRole: "호텔 프런트 직원",
    userMission: "예약이 누락된 상황에서 방을 배정받기",
  },
  {
    id: "negotiation",
    emoji: "🤝",
    title: "연봉 협상",
    category: "비즈니스",
    aiRole: "채용 담당 매니저",
    userMission: "제시받은 연봉을 10% 인상해서 합의하기",
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** 사용자가 직접 입력한 커스텀 상황(정해진 틀). */
export interface CustomScenarioInput {
  aiRole: string;
  userMission: string;
}

/** 종료 후 피드백 (모국어). /api/roleplay/feedback 응답 형태. */
export interface RoleplayCoachFeedback {
  scores: { total: number; fluency: number; accuracy: number; vocab: number };
  summary: string;
  expressions: Array<{
    original: string;
    rating: "좋음" | "어색" | "개선";
    comment: string;
    suggestion: string;
  }>;
  next_recommendation: string;
}

/** 정적 시나리오 또는 커스텀 입력을 시스템 프롬프트용 최소 형태로 정규화. */
export function toScenarioInfo(
  s: Scenario | CustomScenarioInput,
): { aiRole: string; userMission: string } {
  return { aiRole: s.aiRole, userMission: s.userMission };
}

const LANGUAGE_NAME: Record<Language, string> = {
  english: "English",
  spanish: "Spanish",
  japanese: "Japanese",
};

/** 미션 달성 시 AI 응답 끝에 붙는 신호 토큰 (클라이언트가 감지 후 제거). */
export const MISSION_COMPLETE_TOKEN = "[[MISSION_COMPLETE]]";

/** GPT 시스템 프롬프트 (서버에서만 사용). */
export function buildSystemPrompt(
  scenario: Scenario | CustomScenarioInput,
  language: Language,
): string {
  const lang = LANGUAGE_NAME[language];
  return [
    `You are a friendly language-practice partner for a learner of ${lang}.`,
    `Role-play strictly in character as: ${scenario.aiRole}.`,
    `Speak ONLY in ${lang}. Keep replies short and natural (1-3 sentences), in character.`,
    `The learner's mission: ${scenario.userMission}.`,
    `Drive the scene forward and add mild, realistic friction so the conversation keeps going.`,
    `If the learner is stuck, switches to Korean, or makes a big mistake, gently help by offering a simpler ${lang} phrasing — but stay in character.`,
    `When the learner has clearly accomplished their mission, give a brief natural closing line in character, then append the exact token ${MISSION_COMPLETE_TOKEN} at the very end of that message (and only then).`,
    `Never break character or mention you are an AI.`,
  ].join(" ");
}

/** 모국어(한국어) 피드백 생성용 시스템 프롬프트 (서버 전용). */
export function buildFeedbackPrompt(
  scenario: { aiRole: string; userMission: string },
  language: Language,
): string {
  const lang = LANGUAGE_NAME[language];
  return [
    `You are a ${lang} speaking coach. The learner just finished a role-play.`,
    `Their conversation partner played: ${scenario.aiRole}. The learner's mission: ${scenario.userMission}.`,
    `Evaluate ONLY the learner's (user) utterances. Write all feedback in Korean (the learner's native language).`,
    `Return strict JSON with this shape:`,
    `{"scores":{"total":0-100,"fluency":0-100,"accuracy":0-100,"vocab":0-100},`,
    `"summary":"한 줄 총평",`,
    `"expressions":[{"original":"학습자가 한 표현","rating":"좋음|어색|개선","comment":"한국어 코멘트","suggestion":"더 자연스러운 표현(없으면 빈 문자열)"}],`,
    `"next_recommendation":"다음에 연습하면 좋을 점"}`,
    `Pick the 3-6 most useful expressions. Be concrete and encouraging.`,
  ].join(" ");
}
