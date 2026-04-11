import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

// ── Forms ────────────────────────────────────────────────────────────────────

export const forms = pgTable("forms", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(12)),
  userId: text("user_id"),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  fields: jsonb("fields").notNull().$type<FormFieldDef[]>(),

  // Agent config
  voiceId: text("voice_id"),
  greeting: text("greeting"),
  systemContext: text("system_context"),
  personality: text("personality"),
  language: text("language").notNull().default("en"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Responses ────────────────────────────────────────────────────────────────

export const responses = pgTable("responses", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(12)),
  formId: text("form_id")
    .notNull()
    .references(() => forms.id, { onDelete: "cascade" }),
  answers: jsonb("answers").notNull().$type<Record<string, unknown>>(),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  duration: integer("duration"), // seconds
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Conversations (post-call webhook data) ──────────────────────────────────

export const conversations = pgTable("conversations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(12)),
  conversationId: text("conversation_id").notNull().unique(),
  agentId: text("agent_id"),
  formId: text("form_id").references(() => forms.id, { onDelete: "set null" }),
  transcript: jsonb("transcript").$type<ConversationTranscript[]>(),
  evaluation: jsonb("evaluation").$type<Record<string, EvaluationResult>>(),
  summary: text("summary"),
  durationSecs: integer("duration_secs"),
  status: text("status"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export interface ConversationTranscript {
  role: "agent" | "user";
  message: string;
  time_in_call_secs?: number;
}

export interface EvaluationResult {
  criteria_id: string;
  result: "success" | "failure" | "unknown";
  rationale?: string;
}

// ── Field type (used in forms.fields JSONB) ──────────────────────────────────

export type FieldType =
  | "text"
  | "long_text"
  | "number"
  | "boolean"
  | "enum"
  | "multi_select"
  | "email"
  | "date"
  | "scale"
  | "file";

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
}

export interface FormFieldDef {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  description?: string;
  options?: string[];
  validation?: FieldValidation;
}

export interface FormResponse {
  id: string;
  formId: string;
  answers: Record<string, unknown>;
  completed: boolean;
  completedAt: Date | null;
  duration: number | null;
  createdAt: Date;
}
