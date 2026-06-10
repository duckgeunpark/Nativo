/**
 * Supabase 타입 클라이언트용 Database 스키마.
 *
 * supabase/migrations/0001_init.sql 과 1:1로 대응한다.
 * `createClient<Database>(...)` 에 주입하면 쿼리 결과가 타입 추론된다.
 *
 * 컨벤션:
 *   Row    — SELECT 결과 (모든 컬럼, DEFAULT 채워진 상태)
 *   Insert — INSERT 입력 (DEFAULT/nullable 컬럼은 optional)
 *   Update — UPDATE 입력 (전부 optional)
 *
 * 스키마 변경 시 이 파일과 SQL 마이그레이션을 함께 수정한다.
 * (향후 `supabase gen types typescript` 로 자동 생성으로 전환 가능)
 */

import type {
  CefrLevel,
  ChunkCategory,
  ChunkSource,
  ContentType,
  FlashcardSource,
  Language,
  RoleplayMode,
  ScenarioCategory,
  TranslationDirection,
} from "./enums.js";
import type {
  ChatMessage,
  DailyTaskId,
  Json,
  MissionCard,
  MonthlyStats,
  PhaseConditions,
  RoleplayFeedback,
  SavedChunk,
  SavedWord,
  TranslationFeedback,
  UnknownWord,
  WritingCorrection,
} from "./json.js";

/** 모든 테이블이 공유하는 타임스탬프(ISO 8601 문자열로 직렬화). */
type Timestamp = string;

/**
 * 각 테이블의 Row/Insert/Update 정의.
 * (postgrest-js가 요구하는 Relationships 필드는 아래 Database에서 일괄 주입)
 */
interface TableDefinitions {
  users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          selected_language: Language;
          current_phase: number;
          current_level: CefrLevel;
          occupation: string | null;
          interests: string[] | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          selected_language?: Language;
          current_phase?: number;
          current_level?: CefrLevel;
          occupation?: string | null;
          interests?: string[] | null;
        };
        Update: {
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          selected_language?: Language;
          current_phase?: number;
          current_level?: CefrLevel;
          occupation?: string | null;
          interests?: string[] | null;
        };
      };

      flashcards: {
        Row: {
          id: string;
          user_id: string;
          word: string;
          meaning: string;
          meaning_en: string | null;
          pronunciation: string | null;
          example_1: string | null;
          example_2: string | null;
          part_of_speech: string | null;
          difficulty: CefrLevel | null;
          language: Language;
          source: FlashcardSource;
          source_ref: string | null;
          next_review_at: Timestamp;
          ease_factor: number;
          interval_days: number;
          repetitions: number;
          last_grade: number | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          word: string;
          meaning: string;
          meaning_en?: string | null;
          pronunciation?: string | null;
          example_1?: string | null;
          example_2?: string | null;
          part_of_speech?: string | null;
          difficulty?: CefrLevel | null;
          language: Language;
          source?: FlashcardSource;
          source_ref?: string | null;
          next_review_at?: Timestamp;
          ease_factor?: number;
          interval_days?: number;
          repetitions?: number;
          last_grade?: number | null;
        };
        Update: {
          word?: string;
          meaning?: string;
          meaning_en?: string | null;
          pronunciation?: string | null;
          example_1?: string | null;
          example_2?: string | null;
          part_of_speech?: string | null;
          difficulty?: CefrLevel | null;
          next_review_at?: Timestamp;
          ease_factor?: number;
          interval_days?: number;
          repetitions?: number;
          last_grade?: number | null;
        };
      };

      daily_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string; // DATE
          phase: number;
          language: Language;
          tasks_completed: DailyTaskId[];
          study_minutes: number;
          streak_day: number;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          log_date: string;
          phase: number;
          language: Language;
          tasks_completed?: DailyTaskId[];
          study_minutes?: number;
          streak_day?: number;
        };
        Update: {
          tasks_completed?: DailyTaskId[];
          study_minutes?: number;
          streak_day?: number;
        };
      };

      chunks: {
        Row: {
          id: string;
          user_id: string;
          expression: string;
          translation_ko: string | null;
          situation: string | null;
          nuance: string | null;
          example_1: string | null;
          example_2: string | null;
          category: ChunkCategory | null;
          language: Language;
          level: CefrLevel | null;
          source: ChunkSource;
          review_count: number;
          last_reviewed_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          expression: string;
          translation_ko?: string | null;
          situation?: string | null;
          nuance?: string | null;
          example_1?: string | null;
          example_2?: string | null;
          category?: ChunkCategory | null;
          language: Language;
          level?: CefrLevel | null;
          source?: ChunkSource;
          review_count?: number;
          last_reviewed_at?: Timestamp | null;
        };
        Update: {
          expression?: string;
          translation_ko?: string | null;
          situation?: string | null;
          nuance?: string | null;
          example_1?: string | null;
          example_2?: string | null;
          category?: ChunkCategory | null;
          level?: CefrLevel | null;
          review_count?: number;
          last_reviewed_at?: Timestamp | null;
        };
      };

      writing_journal: {
        Row: {
          id: string;
          user_id: string;
          language: Language;
          entry_date: string; // DATE
          content: string;
          ai_feedback: string | null;
          corrections: WritingCorrection[];
          used_chunks: string[] | null;
          word_count: number;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          language: Language;
          entry_date: string;
          content: string;
          ai_feedback?: string | null;
          corrections?: WritingCorrection[];
          used_chunks?: string[] | null;
          word_count?: number;
        };
        Update: {
          content?: string;
          ai_feedback?: string | null;
          corrections?: WritingCorrection[];
          used_chunks?: string[] | null;
          word_count?: number;
        };
      };

      shadowing_videos: {
        Row: {
          id: string;
          user_id: string;
          youtube_url: string;
          youtube_video_id: string;
          title: string | null;
          thumbnail_url: string | null;
          duration_seconds: number | null;
          language: Language;
          last_position_sec: number;
          total_watch_sec: number;
          completed: boolean;
          saved_words: SavedWord[];
          saved_chunks: SavedChunk[];
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          youtube_url: string;
          youtube_video_id: string;
          title?: string | null;
          thumbnail_url?: string | null;
          duration_seconds?: number | null;
          language: Language;
          last_position_sec?: number;
          total_watch_sec?: number;
          completed?: boolean;
          saved_words?: SavedWord[];
          saved_chunks?: SavedChunk[];
        };
        Update: {
          title?: string | null;
          thumbnail_url?: string | null;
          duration_seconds?: number | null;
          last_position_sec?: number;
          total_watch_sec?: number;
          completed?: boolean;
          saved_words?: SavedWord[];
          saved_chunks?: SavedChunk[];
        };
      };

      roleplay_scenarios: {
        Row: {
          id: string;
          title: string;
          category: ScenarioCategory;
          language: Language;
          level: CefrLevel;
          ai_role: string;
          user_mission: string;
          conflict_element: string | null;
          mission_cards: MissionCard[];
          system_prompt: string; // 민감: 서버에서만 select
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          title: string;
          category: ScenarioCategory;
          language: Language;
          level: CefrLevel;
          ai_role: string;
          user_mission: string;
          conflict_element?: string | null;
          mission_cards?: MissionCard[];
          system_prompt: string;
        };
        Update: {
          title?: string;
          category?: ScenarioCategory;
          level?: CefrLevel;
          ai_role?: string;
          user_mission?: string;
          conflict_element?: string | null;
          mission_cards?: MissionCard[];
          system_prompt?: string;
        };
      };

      roleplay_sessions: {
        Row: {
          id: string;
          user_id: string;
          scenario_id: string | null;
          language: Language;
          level: CefrLevel;
          mode: RoleplayMode;
          messages: ChatMessage[];
          score_total: number | null;
          score_fluency: number | null;
          score_accuracy: number | null;
          score_vocab: number | null;
          passed: boolean;
          feedback: RoleplayFeedback | null;
          new_flashcards: string[] | null;
          duration_sec: number | null;
          exchange_count: number | null;
          evaluated_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          scenario_id?: string | null;
          language: Language;
          level: CefrLevel;
          mode: RoleplayMode;
          messages?: ChatMessage[];
          score_total?: number | null;
          score_fluency?: number | null;
          score_accuracy?: number | null;
          score_vocab?: number | null;
          passed?: boolean;
          feedback?: RoleplayFeedback | null;
          new_flashcards?: string[] | null;
          duration_sec?: number | null;
          exchange_count?: number | null;
          evaluated_at?: Timestamp | null;
        };
        Update: {
          messages?: ChatMessage[];
          score_total?: number | null;
          score_fluency?: number | null;
          score_accuracy?: number | null;
          score_vocab?: number | null;
          passed?: boolean;
          feedback?: RoleplayFeedback | null;
          new_flashcards?: string[] | null;
          duration_sec?: number | null;
          exchange_count?: number | null;
          evaluated_at?: Timestamp | null;
        };
      };

      translation_sessions: {
        Row: {
          id: string;
          user_id: string;
          language: Language;
          direction: TranslationDirection;
          book_id: string | null;
          book_title: string | null;
          chapter: string | null;
          original_text: string;
          user_translation: string;
          score_total: number | null;
          score_accuracy: number | null;
          score_naturalness: number | null;
          score_nuance: number | null;
          passed: boolean;
          feedback: TranslationFeedback | null;
          unknown_words: UnknownWord[];
          new_flashcards: string[] | null;
          evaluated_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          language: Language;
          direction?: TranslationDirection;
          book_id?: string | null;
          book_title?: string | null;
          chapter?: string | null;
          original_text: string;
          user_translation: string;
          score_total?: number | null;
          score_accuracy?: number | null;
          score_naturalness?: number | null;
          score_nuance?: number | null;
          passed?: boolean;
          feedback?: TranslationFeedback | null;
          unknown_words?: UnknownWord[];
          new_flashcards?: string[] | null;
          evaluated_at?: Timestamp | null;
        };
        Update: {
          user_translation?: string;
          score_total?: number | null;
          score_accuracy?: number | null;
          score_naturalness?: number | null;
          score_nuance?: number | null;
          passed?: boolean;
          feedback?: TranslationFeedback | null;
          unknown_words?: UnknownWord[];
          new_flashcards?: string[] | null;
          evaluated_at?: Timestamp | null;
        };
      };

      phase_completions: {
        Row: {
          id: string;
          user_id: string;
          language: Language;
          phase: number;
          conditions_met: PhaseConditions;
          final_score: number | null;
          completed_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          language: Language;
          phase: number;
          conditions_met: PhaseConditions;
          final_score?: number | null;
        };
        Update: {
          conditions_met?: PhaseConditions;
          final_score?: number | null;
        };
      };

      study_stats: {
        Row: {
          id: string;
          user_id: string;
          language: Language;
          total_study_minutes: number;
          total_flashcards: number;
          total_chunks: number;
          total_shadowing_sec: number;
          total_roleplay_sessions: number;
          total_translations: number;
          current_streak: number;
          longest_streak: number;
          monthly_stats: MonthlyStats;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          language: Language;
          total_study_minutes?: number;
          total_flashcards?: number;
          total_chunks?: number;
          total_shadowing_sec?: number;
          total_roleplay_sessions?: number;
          total_translations?: number;
          current_streak?: number;
          longest_streak?: number;
          monthly_stats?: MonthlyStats;
        };
        Update: {
          total_study_minutes?: number;
          total_flashcards?: number;
          total_chunks?: number;
          total_shadowing_sec?: number;
          total_roleplay_sessions?: number;
          total_translations?: number;
          current_streak?: number;
          longest_streak?: number;
          monthly_stats?: MonthlyStats;
        };
      };

      content_history: {
        Row: {
          id: string;
          user_id: string;
          content_type: ContentType;
          content_id: string;
          title: string;
          author: string | null;
          language: Language;
          total_chapters: number | null;
          completed_chapters: number;
          last_chapter: string | null;
          progress_pct: number;
          completed: boolean;
          started_at: Timestamp;
          completed_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          content_type: ContentType;
          content_id: string;
          title: string;
          author?: string | null;
          language: Language;
          total_chapters?: number | null;
          completed_chapters?: number;
          last_chapter?: string | null;
          progress_pct?: number;
          completed?: boolean;
          completed_at?: Timestamp | null;
        };
        Update: {
          total_chapters?: number | null;
          completed_chapters?: number;
          last_chapter?: string | null;
          progress_pct?: number;
          completed?: boolean;
          completed_at?: Timestamp | null;
        };
      };
}

export interface Database {
  public: {
    // 각 테이블에 빈 Relationships([]) 주입 → postgrest-js GenericSchema 충족
    Tables: {
      [K in keyof TableDefinitions]: TableDefinitions[K] & { Relationships: [] };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

/** 테이블 Row 타입 단축 접근자. 예: Tables<"flashcards">. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

/** Json 재노출(외부에서 jsonb 범용 타입 필요 시). */
export type { Json };
