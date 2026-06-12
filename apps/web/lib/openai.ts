/** OpenAI 설정/클라이언트 (서버 전용). 키 없으면 기능을 안내로 degrade. */
import OpenAI from "openai";

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function openaiClient(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
