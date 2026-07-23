-- =============================================================================
-- Nativo — 내장 DB(SQLite/libSQL) 스키마
--
-- supabase/migrations/0001_init.sql 을 SQLite 로 변환한 단일 사용자(로컬) 버전.
--   - UUID            → TEXT  (어댑터가 crypto.randomUUID() 주입)
--   - TIMESTAMPTZ     → TEXT  (ISO8601, DEFAULT strftime(...Z))
--   - DATE            → TEXT  (YYYY-MM-DD)
--   - TEXT[] / JSONB  → TEXT  (JSON 문자열, 어댑터가 (역)직렬화)
--   - BOOLEAN         → INTEGER(0/1) (어댑터가 boolean 으로 변환)
--   - RLS / 트리거 / auth.users 참조 제거 (단일 사용자라 불필요)
--
-- 모든 문은 idempotent(IF NOT EXISTS) → 매 부팅 시 안전하게 재실행 가능.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- 1. users — 사용자 기본 정보 (단일 사용자 1행, 어댑터가 시드)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  email              TEXT UNIQUE NOT NULL,
  display_name       TEXT,
  avatar_url         TEXT,

  selected_language  TEXT NOT NULL DEFAULT 'english',
  current_phase      INTEGER NOT NULL DEFAULT 1,
  current_level      TEXT NOT NULL DEFAULT 'A2',

  occupation         TEXT,
  interests          TEXT DEFAULT '[]',            -- JSON string[]

  created_at         TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- -----------------------------------------------------------------------------
-- 2. flashcards — 플래시카드 (SRS / SM-2)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flashcards (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,

  word            TEXT NOT NULL,
  meaning         TEXT NOT NULL,
  meaning_en      TEXT,
  pronunciation   TEXT,
  example_1       TEXT,
  example_2       TEXT,
  part_of_speech  TEXT,
  difficulty      TEXT,
  language        TEXT NOT NULL,

  source          TEXT NOT NULL DEFAULT 'curated',
  source_ref      TEXT,

  next_review_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ease_factor     REAL NOT NULL DEFAULT 2.5,
  interval_days   INTEGER NOT NULL DEFAULT 1,
  repetitions     INTEGER NOT NULL DEFAULT 0,
  last_grade      INTEGER,

  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_flashcards_user_review
  ON flashcards(user_id, next_review_at);

-- -----------------------------------------------------------------------------
-- 3. daily_logs — 일일 학습 루틴 기록
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_logs (
  id                TEXT PRIMARY KEY,
  user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,

  log_date          TEXT NOT NULL,
  phase             INTEGER NOT NULL,
  language          TEXT NOT NULL,

  tasks_completed   TEXT DEFAULT '[]',            -- JSON DailyTaskId[]
  study_minutes     INTEGER DEFAULT 0,
  streak_day        INTEGER DEFAULT 0,

  created_at        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  UNIQUE(user_id, log_date, language)
);

-- -----------------------------------------------------------------------------
-- 4. chunks — Chunk 컬렉션
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chunks (
  id               TEXT PRIMARY KEY,
  user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,

  expression       TEXT NOT NULL,
  translation_ko   TEXT,
  situation        TEXT,
  nuance           TEXT,
  example_1        TEXT,
  example_2        TEXT,
  category         TEXT,
  language         TEXT NOT NULL,
  level            TEXT,

  source           TEXT DEFAULT 'curated',

  review_count     INTEGER DEFAULT 0,
  last_reviewed_at TEXT,

  created_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_chunks_user ON chunks(user_id);

-- -----------------------------------------------------------------------------
-- 5. writing_journal — 영작 일기
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS writing_journal (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,

  language        TEXT NOT NULL,
  entry_date      TEXT NOT NULL,
  content         TEXT NOT NULL,

  ai_feedback     TEXT,
  corrections     TEXT DEFAULT '[]',            -- JSON WritingCorrection[]
  used_chunks     TEXT DEFAULT '[]',            -- JSON string[]
  word_count      INTEGER DEFAULT 0,

  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, entry_date, language)
);

-- -----------------------------------------------------------------------------
-- 6. shadowing_videos — 쉐도잉 영상
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shadowing_videos (
  id                TEXT PRIMARY KEY,
  user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,

  youtube_url       TEXT NOT NULL,
  youtube_video_id  TEXT NOT NULL,
  title             TEXT,
  thumbnail_url     TEXT,
  duration_seconds  INTEGER,
  language          TEXT NOT NULL,

  last_position_sec INTEGER DEFAULT 0,
  total_watch_sec   INTEGER DEFAULT 0,
  completed         INTEGER DEFAULT 0,            -- boolean

  saved_words       TEXT DEFAULT '[]',            -- JSON SavedWord[]
  saved_chunks      TEXT DEFAULT '[]',            -- JSON SavedChunk[]
  transcript        TEXT DEFAULT '[]',            -- JSON TranscriptCue[] (사용자가 직접 넣은 자막)

  created_at        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_shadowing_videos_user ON shadowing_videos(user_id);

-- -----------------------------------------------------------------------------
-- 7. roleplay_scenarios — 롤플레이 시나리오 마스터 (앱 코드의 정적 데이터가 주 출처)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roleplay_scenarios (
  id               TEXT PRIMARY KEY,

  title            TEXT NOT NULL,
  category         TEXT NOT NULL,
  language         TEXT NOT NULL,
  level            TEXT NOT NULL,

  ai_role          TEXT NOT NULL,
  user_mission     TEXT NOT NULL,
  conflict_element TEXT,
  mission_cards    TEXT DEFAULT '[]',            -- JSON MissionCard[]

  system_prompt    TEXT NOT NULL,

  created_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- -----------------------------------------------------------------------------
-- 8. roleplay_sessions — 롤플레이 세션 기록
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roleplay_sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
  -- 시나리오는 앱 코드(lib/roleplay.ts)의 정적 상수라 DB 마스터가 비어 있다.
  -- FK 를 걸면 세션 저장이 막히므로 코드 시나리오 id 를 담는 일반 텍스트로 둔다.
  scenario_id     TEXT,

  language        TEXT NOT NULL,
  level           TEXT NOT NULL,
  mode            TEXT NOT NULL,

  messages        TEXT NOT NULL DEFAULT '[]',   -- JSON ChatMessage[]

  score_total     INTEGER,
  score_fluency   INTEGER,
  score_accuracy  INTEGER,
  score_vocab     INTEGER,
  passed          INTEGER DEFAULT 0,            -- boolean

  feedback        TEXT,                         -- JSON RoleplayFeedback
  new_flashcards  TEXT DEFAULT '[]',            -- JSON string[]

  duration_sec    INTEGER,
  exchange_count  INTEGER,

  evaluated_at    TEXT,
  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_user
  ON roleplay_sessions(user_id, language, passed);

-- -----------------------------------------------------------------------------
-- 9. translation_sessions — 번역 세션
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS translation_sessions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,

  language          TEXT NOT NULL,
  direction         TEXT NOT NULL DEFAULT 'to_korean',

  book_id           TEXT,
  book_title        TEXT,
  chapter           TEXT,

  original_text     TEXT NOT NULL,
  user_translation  TEXT NOT NULL,

  score_total       INTEGER,
  score_accuracy    INTEGER,
  score_naturalness INTEGER,
  score_nuance      INTEGER,
  passed            INTEGER DEFAULT 0,           -- boolean

  feedback          TEXT,                        -- JSON TranslationFeedback
  unknown_words     TEXT DEFAULT '[]',           -- JSON UnknownWord[]
  new_flashcards    TEXT DEFAULT '[]',           -- JSON string[]

  evaluated_at      TEXT,
  created_at        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_translation_sessions_user ON translation_sessions(user_id);

-- -----------------------------------------------------------------------------
-- 10. phase_completions — Phase 졸업 기록
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phase_completions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,

  language        TEXT NOT NULL,
  phase           INTEGER NOT NULL,

  conditions_met  TEXT NOT NULL DEFAULT '{}',   -- JSON PhaseConditions
  final_score     INTEGER,
  completed_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  UNIQUE(user_id, language, phase)
);

-- -----------------------------------------------------------------------------
-- 11. study_stats — 학습 통계 (언어별 집계)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_stats (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT REFERENCES users(id) ON DELETE CASCADE,
  language                TEXT NOT NULL,

  total_study_minutes     INTEGER DEFAULT 0,
  total_flashcards        INTEGER DEFAULT 0,
  total_chunks            INTEGER DEFAULT 0,
  total_shadowing_sec     INTEGER DEFAULT 0,
  total_roleplay_sessions INTEGER DEFAULT 0,
  total_translations      INTEGER DEFAULT 0,
  current_streak          INTEGER DEFAULT 0,
  longest_streak          INTEGER DEFAULT 0,

  monthly_stats           TEXT DEFAULT '{}',    -- JSON MonthlyStats

  updated_at              TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, language)
);

-- -----------------------------------------------------------------------------
-- 12. content_history — 원서 독서 진행
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_history (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT REFERENCES users(id) ON DELETE CASCADE,

  content_type       TEXT NOT NULL,
  content_id         TEXT NOT NULL,
  title              TEXT NOT NULL,
  author             TEXT,
  language           TEXT NOT NULL,

  total_chapters     INTEGER,
  completed_chapters INTEGER DEFAULT 0,
  last_chapter       TEXT,
  progress_pct       REAL DEFAULT 0.0,
  completed          INTEGER DEFAULT 0,           -- boolean

  started_at         TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at       TEXT,

  UNIQUE(user_id, content_id, language)
);

-- -----------------------------------------------------------------------------
-- 13. documents — 사용자가 업로드한 읽기 자료 (PDF→텍스트 등)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,

  title         TEXT NOT NULL,
  author        TEXT,
  language      TEXT NOT NULL,

  pages         TEXT NOT NULL DEFAULT '[]',   -- JSON string[] (페이지별 본문)
  total_pages   INTEGER NOT NULL DEFAULT 0,

  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

-- -----------------------------------------------------------------------------
-- 14. dictionary_cache — 단어 조회 캐시 (DeepL/사전 API 결과 저장)
--
-- 조회 순서: 정적 word-db(JSON) → 이 캐시 → DeepL/사전 API → 결과를 여기 저장.
-- 사용자 종속이 아닌 언어별 공용 캐시라 user_id 없음. word 는 소문자 정규화 키.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dictionary_cache (
  id              TEXT PRIMARY KEY,

  language        TEXT NOT NULL,
  word            TEXT NOT NULL,               -- 소문자 정규화된 조회 키

  meaning         TEXT NOT NULL,               -- 한국어 뜻 (DeepL 우선)
  meaning_en      TEXT,                        -- 영영 뜻 (사전 API)
  pronunciation   TEXT,
  example_1       TEXT,
  part_of_speech  TEXT,

  source          TEXT NOT NULL DEFAULT 'deepl',  -- 'deepl' | 'ai'

  created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  UNIQUE(language, word)
);
