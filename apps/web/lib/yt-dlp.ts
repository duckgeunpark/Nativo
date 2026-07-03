/**
 * yt-dlp 기반 유튜브 자막 자동 추출 (서버 전용, 로컬).
 *
 * 유튜브가 키 없는 서버측 자막 수집을 막아서, 로컬에 설치된 yt-dlp 로 자막을
 * 받아온다. yt-dlp 가 없으면 "no_ytdlp" 로 신호하고 수동 입력으로 폴백한다.
 * (설치: https://github.com/yt-dlp/yt-dlp — Windows 는 yt-dlp.exe 를 PATH 에 두면 됨)
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Language } from "@nativo/core";
import { parseSubtitles } from "./subtitles";
import type { TranscriptCue } from "./youtube";

const exec = promisify(execFile);

const LANG_CODE: Record<Language, string> = {
  english: "en",
  spanish: "es",
  japanese: "ja",
};

/** yt-dlp 가 PATH 에 설치돼 있는지. */
export async function ytDlpAvailable(): Promise<boolean> {
  try {
    await exec("yt-dlp", ["--version"], { timeout: 8000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * yt-dlp 로 자막(수동 우선, 없으면 자동생성)을 받아 TranscriptCue[] 로 반환.
 * 자막이 없으면 빈 배열. yt-dlp 미설치 시 throw("no_ytdlp").
 */
export async function fetchTranscriptViaYtDlp(
  videoId: string,
  language: Language,
): Promise<TranscriptCue[]> {
  const dir = await mkdtemp(join(tmpdir(), "nativo-sub-"));
  try {
    const lang = LANG_CODE[language];
    await exec(
      "yt-dlp",
      [
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        `${lang}.*,${lang},en.*,en`, // 선택 언어 우선, 영어 폴백
        "--sub-format",
        "vtt/srt/best",
        "-o",
        join(dir, "%(id)s.%(ext)s"),
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { timeout: 90000, windowsHide: true },
    );

    const files = await readdir(dir);
    // 선택 언어 자막 우선, 없으면 첫 자막 파일
    const subFile =
      files.find((f) => f.includes(`.${lang}.`) && /\.(vtt|srt)$/.test(f)) ??
      files.find((f) => /\.(vtt|srt)$/.test(f));
    if (!subFile) return [];

    const text = await readFile(join(dir, subFile), "utf8");
    return parseSubtitles(text);
  } catch (err) {
    // 실행 파일 없음 → 상위에서 설치 안내로 분기
    const e = err as NodeJS.ErrnoException;
    if (e?.code === "ENOENT") throw new Error("no_ytdlp");
    throw err;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
