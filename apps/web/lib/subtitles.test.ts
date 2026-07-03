import { describe, expect, test } from "vitest";
import { parseSubtitles } from "./subtitles";

describe("parseSubtitles", () => {
  test("SRT 파싱", () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:04,500 --> 00:00:06,000
Second <i>line</i>`;
    const cues = parseSubtitles(srt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ start: 1, dur: 3, text: "Hello world" });
    expect(cues[1]!.start).toBe(4.5);
    expect(cues[1]!.text).toBe("Second line"); // 태그 제거
  });

  test("WebVTT 파싱 (헤더/태그 무시)", () => {
    const vtt = `WEBVTT

00:00:02.000 --> 00:00:05.000
<c>Hi there</c>

00:05.500 --> 00:07.000
Short form`;
    const cues = parseSubtitles(vtt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ start: 2, dur: 3, text: "Hi there" });
    expect(cues[1]!.start).toBe(5.5); // MM:SS.mmm
  });

  test("유튜브 스크립트 복사본 (타임스탬프 + 다음 줄)", () => {
    const yt = `0:05
Hello there
0:09
General Kenobi
1:02
You are a bold one`;
    const cues = parseSubtitles(yt);
    expect(cues).toHaveLength(3);
    expect(cues[0]!.start).toBe(5);
    expect(cues[0]!.text).toBe("Hello there");
    expect(cues[0]!.dur).toBe(4); // 9 - 5
    expect(cues[2]!.start).toBe(62);
    expect(cues[2]!.dur).toBe(4); // 마지막 기본 4초
  });

  test("시간순 정렬", () => {
    const srt = `1
00:00:10,000 --> 00:00:12,000
later

2
00:00:01,000 --> 00:00:02,000
earlier`;
    const cues = parseSubtitles(srt);
    expect(cues.map((c) => c.text)).toEqual(["earlier", "later"]);
  });

  test("빈 입력 → 빈 배열", () => {
    expect(parseSubtitles("")).toEqual([]);
    expect(parseSubtitles("   \n  ")).toEqual([]);
  });
});
