-- =============================================================================
-- Nativo — 초기 스키마 (Phase 1~5 전체 테이블)
-- 설계서: documents/spec+db Schema v1.md 2장 기준
--
-- 적용 순서:
--   1) 공통 함수/트리거 (handle_new_user, set_updated_at)
--   2) users (auth.users 참조)
--   3) 사용자 소유 테이블 (flashcards ... content_history)
--   4) roleplay_scenarios (마스터 데이터)
--   5) RLS 활성화 + 정책
--
-- 저장 원칙:
--   O: URL, 학습 기록, 사용자가 저장한 단어/문장, 진행도, 점수
--   X: 영상 파일, 오디오 원본, 자막 전문 (저작권 보호)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. 공통 함수
-- -----------------------------------------------------------------------------

-- updated_at 자동 갱신 (여러 테이블에서 재사용)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. users — 사용자 기본 정보 (auth.users(id) 직접 참조)
-- -----------------------------------------------------------------------------
CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,

  selected_language  TEXT NOT NULL DEFAULT 'english',  -- english | spanish | japanese
  current_phase      INTEGER NOT NULL DEFAULT 1,        -- 1 ~ 5
  current_level      TEXT NOT NULL DEFAULT 'A2',        -- A2 | B1 | B2 | C1

  occupation         TEXT,
  interests          TEXT[],

  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 회원가입(auth.users INSERT) 시 public.users 행 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. flashcards — 플래시카드 (SRS / SM-2)
-- -----------------------------------------------------------------------------
CREATE TABLE public.flashcards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,

  word            TEXT NOT NULL,
  meaning         TEXT NOT NULL,           -- 한국어 뜻
  meaning_en      TEXT,                    -- 영영 뜻
  pronunciation   TEXT,                    -- 발음 기호
  example_1       TEXT,
  example_2       TEXT,
  part_of_speech  TEXT,                    -- noun | verb | adj ...
  difficulty      TEXT,                    -- A1 | A2 | B1 | B2 | C1 | C2
  language        TEXT NOT NULL,           -- english | spanish | japanese

  source          TEXT NOT NULL DEFAULT 'curated',  -- curated | video | reading | manual
  source_ref      TEXT,                    -- 출처 URL 또는 책 제목

  -- SM-2 알고리즘 필드 (packages/utils/srs.ts 와 1:1 매핑)
  next_review_at  TIMESTAMPTZ DEFAULT NOW(),
  ease_factor     FLOAT NOT NULL DEFAULT 2.5,    -- 1.3 ~ 2.5+
  interval_days   INTEGER NOT NULL DEFAULT 1,
  repetitions     INTEGER NOT NULL DEFAULT 0,
  last_grade      INTEGER,                       -- 0 ~ 5

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flashcards_user_review
  ON public.flashcards(user_id, next_review_at);

-- -----------------------------------------------------------------------------
-- 3. daily_logs — 일일 학습 루틴 기록
-- -----------------------------------------------------------------------------
CREATE TABLE public.daily_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES public.users(id) ON DELETE CASCADE,

  log_date          DATE NOT NULL,
  phase             INTEGER NOT NULL,
  language          TEXT NOT NULL,

  tasks_completed   JSONB DEFAULT '[]',    -- ["flashcard_review", ...]
  study_minutes     INTEGER DEFAULT 0,
  streak_day        INTEGER DEFAULT 0,

  created_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, log_date, language)
);

-- -----------------------------------------------------------------------------
-- 4. chunks — Chunk 컬렉션 (Phase 2)
-- -----------------------------------------------------------------------------
CREATE TABLE public.chunks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.users(id) ON DELETE CASCADE,

  expression       TEXT NOT NULL,          -- "I was wondering if..."
  translation_ko   TEXT,
  situation        TEXT,
  nuance           TEXT,
  example_1        TEXT,
  example_2        TEXT,
  category         TEXT,                   -- daily | business | travel | social | custom
  language         TEXT NOT NULL,
  level            TEXT,                   -- A2 | B1 | B2

  source           TEXT DEFAULT 'curated', -- curated | ai_generated | video | manual

  review_count     INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,

  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunks_user ON public.chunks(user_id);

-- -----------------------------------------------------------------------------
-- 5. writing_journal — 영작 일기 (Phase 2)
-- -----------------------------------------------------------------------------
CREATE TABLE public.writing_journal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,

  language        TEXT NOT NULL,
  entry_date      DATE NOT NULL,
  content         TEXT NOT NULL,

  ai_feedback     TEXT,
  corrections     JSONB DEFAULT '[]',      -- [{ original, corrected, reason }]
  used_chunks     TEXT[],                  -- 사용한 chunk ID 목록
  word_count      INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entry_date, language)
);

-- -----------------------------------------------------------------------------
-- 6. shadowing_videos — 쉐도잉 영상 (Phase 3)
-- -----------------------------------------------------------------------------
CREATE TABLE public.shadowing_videos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES public.users(id) ON DELETE CASCADE,

  youtube_url       TEXT NOT NULL,
  youtube_video_id  TEXT NOT NULL,
  title             TEXT,
  thumbnail_url     TEXT,
  duration_seconds  INTEGER,
  language          TEXT NOT NULL,

  last_position_sec INTEGER DEFAULT 0,
  total_watch_sec   INTEGER DEFAULT 0,
  completed         BOOLEAN DEFAULT FALSE,

  saved_words       JSONB DEFAULT '[]',    -- [{ word, timestamp, meaning }]
  saved_chunks      JSONB DEFAULT '[]',    -- [{ text, timestamp }]

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shadowing_videos_user ON public.shadowing_videos(user_id);

CREATE TRIGGER trg_shadowing_videos_updated_at
  BEFORE UPDATE ON public.shadowing_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. roleplay_scenarios — 롤플레이 시나리오 마스터 (Phase 4, 읽기 전용)
--    system_prompt 는 서버에서만 select (RLS + 애플리케이션 레벨에서 제외)
-- -----------------------------------------------------------------------------
CREATE TABLE public.roleplay_scenarios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title            TEXT NOT NULL,
  category         TEXT NOT NULL,          -- daily | business | travel | social | professional
  language         TEXT NOT NULL,
  level            TEXT NOT NULL,          -- A2 | B1 | B2 | C1

  ai_role          TEXT NOT NULL,
  user_mission     TEXT NOT NULL,
  conflict_element TEXT,
  mission_cards    JSONB DEFAULT '[]',     -- [{ mission }]

  system_prompt    TEXT NOT NULL,          -- GPT 시스템 프롬프트 (민감)

  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. roleplay_sessions — 롤플레이 세션 기록 (Phase 4)
-- -----------------------------------------------------------------------------
CREATE TABLE public.roleplay_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
  scenario_id     UUID REFERENCES public.roleplay_scenarios(id),

  language        TEXT NOT NULL,
  level           TEXT NOT NULL,
  mode            TEXT NOT NULL,           -- guided | free | pressure

  messages        JSONB NOT NULL DEFAULT '[]',  -- [{ role, content, timestamp }]

  score_total     INTEGER,                 -- 0 ~ 100
  score_fluency   INTEGER,                 -- 0 ~ 35
  score_accuracy  INTEGER,                 -- 0 ~ 35
  score_vocab     INTEGER,                 -- 0 ~ 30
  passed          BOOLEAN DEFAULT FALSE,   -- 70점 이상

  feedback        JSONB,                   -- { good_points, improvements, next_recommendation }
  new_flashcards  UUID[],

  duration_sec    INTEGER,
  exchange_count  INTEGER,

  evaluated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roleplay_sessions_user
  ON public.roleplay_sessions(user_id, language, passed);

-- -----------------------------------------------------------------------------
-- 9. translation_sessions — 번역 세션 (Phase 5)
-- -----------------------------------------------------------------------------
CREATE TABLE public.translation_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES public.users(id) ON DELETE CASCADE,

  language          TEXT NOT NULL,
  direction         TEXT NOT NULL DEFAULT 'to_korean',  -- to_korean | from_korean

  book_id           TEXT,                  -- Gutenberg 책 ID
  book_title        TEXT,
  chapter           TEXT,

  original_text     TEXT NOT NULL,
  user_translation  TEXT NOT NULL,

  score_total       INTEGER,               -- 0 ~ 100
  score_accuracy    INTEGER,               -- 0 ~ 40
  score_naturalness INTEGER,               -- 0 ~ 30
  score_nuance      INTEGER,               -- 0 ~ 30
  passed            BOOLEAN DEFAULT FALSE,  -- 80점 이상

  feedback          JSONB,                 -- { good_points, improvements }
  unknown_words     JSONB DEFAULT '[]',    -- [{ word, clicked_at }]
  new_flashcards    UUID[],

  evaluated_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_translation_sessions_user ON public.translation_sessions(user_id);

-- -----------------------------------------------------------------------------
-- 10. phase_completions — Phase 졸업 기록
-- -----------------------------------------------------------------------------
CREATE TABLE public.phase_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,

  language        TEXT NOT NULL,
  phase           INTEGER NOT NULL,        -- 1 ~ 5

  conditions_met  JSONB NOT NULL,          -- { flashcard_count, streak_days, ... }
  final_score     INTEGER,
  completed_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, language, phase)
);

-- -----------------------------------------------------------------------------
-- 11. study_stats — 학습 통계 (언어별 집계)
-- -----------------------------------------------------------------------------
CREATE TABLE public.study_stats (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID REFERENCES public.users(id) ON DELETE CASCADE,
  language                TEXT NOT NULL,

  total_study_minutes     INTEGER DEFAULT 0,
  total_flashcards        INTEGER DEFAULT 0,
  total_chunks            INTEGER DEFAULT 0,
  total_shadowing_sec     INTEGER DEFAULT 0,
  total_roleplay_sessions INTEGER DEFAULT 0,
  total_translations      INTEGER DEFAULT 0,
  current_streak          INTEGER DEFAULT 0,
  longest_streak          INTEGER DEFAULT 0,

  monthly_stats           JSONB DEFAULT '{}',  -- { "2026-06": { minutes, sessions } }

  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, language)
);

CREATE TRIGGER trg_study_stats_updated_at
  BEFORE UPDATE ON public.study_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 12. content_history — 원서 독서 진행 (Phase 5)
-- -----------------------------------------------------------------------------
CREATE TABLE public.content_history (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES public.users(id) ON DELETE CASCADE,

  content_type       TEXT NOT NULL,        -- book | article | ai_generated
  content_id         TEXT NOT NULL,        -- Gutenberg book ID 또는 자체 ID
  title              TEXT NOT NULL,
  author             TEXT,
  language           TEXT NOT NULL,

  total_chapters     INTEGER,
  completed_chapters INTEGER DEFAULT 0,
  last_chapter       TEXT,
  progress_pct       FLOAT DEFAULT 0.0,    -- 0.0 ~ 100.0
  completed          BOOLEAN DEFAULT FALSE,

  started_at         TIMESTAMPTZ DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,

  UNIQUE(user_id, content_id, language)
);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- users — 본인 행만
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_self" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "update_self" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
-- INSERT는 handle_new_user() 트리거(SECURITY DEFINER)가 수행 → 클라이언트 정책 없음

-- 사용자 소유 테이블 공통 패턴 (user_id 기준)
DO $$
DECLARE
  t TEXT;
  owned_tables TEXT[] := ARRAY[
    'flashcards', 'daily_logs', 'chunks', 'writing_journal',
    'shadowing_videos', 'roleplay_sessions', 'translation_sessions',
    'phase_completions', 'study_stats', 'content_history'
  ];
BEGIN
  FOREACH t IN ARRAY owned_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format(
      'CREATE POLICY "select_own" ON public.%I FOR SELECT USING (auth.uid() = user_id);', t);
    EXECUTE format(
      'CREATE POLICY "insert_own" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id);', t);
    EXECUTE format(
      'CREATE POLICY "update_own" ON public.%I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);', t);
    EXECUTE format(
      'CREATE POLICY "delete_own" ON public.%I FOR DELETE USING (auth.uid() = user_id);', t);
  END LOOP;
END $$;

-- roleplay_scenarios — 마스터 데이터 (authenticated 읽기 전용, 쓰기는 service_role만)
ALTER TABLE public.roleplay_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scenarios_read_all" ON public.roleplay_scenarios
  FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE/DELETE 정책 없음 → service_role(서버)만 수정 가능
