export interface Label {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface NoteEntry {
  id: number;
  daily_note_id: number;
  daily_note_date?: string; // YYYY-MM-DD format for navigation
  title: string;
  content: string;
  content_type: 'rich_text' | 'code' | 'markdown';
  order_index: number;
  created_at: string;
  updated_at: string;
  labels: Label[];
  lists?: List[];
  include_in_report: boolean;
  is_important: boolean;
  is_completed: boolean;
  is_pinned: boolean;
  is_archived?: boolean;
  reminder?: Reminder;
}

export interface DailyNote {
  id: number;
  date: string;
  fire_rating: number;
  daily_goal: string;
  created_at: string;
  updated_at: string;
  entries: NoteEntry[];
  labels: Label[];
}

export interface NoteEntryCreate {
  title?: string;
  content: string;
  content_type: 'rich_text' | 'code' | 'markdown';
  order_index: number;
}

export interface NoteEntryUpdate {
  title?: string;
  content?: string;
  content_type?: 'rich_text' | 'code' | 'markdown';
  order_index?: number;
}

export interface DailyNoteCreate {
  date: string;
  fire_rating?: number;
  daily_goal?: string;
}

export interface DailyNoteUpdate {
  fire_rating?: number;
  daily_goal?: string;
}

export interface AppSettings {
  id: number;
  sprint_goals: string;
  quarterly_goals: string;
  sprint_start_date: string;
  sprint_end_date: string;
  quarterly_start_date: string;
  quarterly_end_date: string;
  emoji_library: string;
  sprint_name: string;
  daily_goal_end_time: string;
  texture_enabled: boolean;
  texture_settings: string;
  // LLM settings
  llm_provider: LlmProvider;
  openai_api_key_set: boolean;
  anthropic_api_key_set: boolean;
  gemini_api_key_set: boolean;
  llm_global_prompt: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettingsUpdate {
  sprint_goals?: string;
  quarterly_goals?: string;
  sprint_start_date?: string;
  sprint_end_date?: string;
  quarterly_start_date?: string;
  quarterly_end_date?: string;
  emoji_library?: string;
  sprint_name?: string;
  daily_goal_end_time?: string;
  texture_enabled?: boolean;
  texture_settings?: string;
  // LLM settings
  llm_provider?: LlmProvider;
  openai_api_key?: string;
  anthropic_api_key?: string;
  gemini_api_key?: string;
  llm_global_prompt?: string;
}

// Goal type constants
export const TIME_BASED_GOAL_TYPES = ['Daily', 'Weekly', 'Sprint', 'Monthly', 'Quarterly', 'Yearly'] as const;
export const LIFESTYLE_GOAL_TYPES = ['Fitness', 'Health', 'Learning', 'Personal', 'Financial', 'Habits', 'Career', 'Relationships', 'Creativity'] as const;
export const ALL_GOAL_TYPES = [...TIME_BASED_GOAL_TYPES, ...LIFESTYLE_GOAL_TYPES] as const;

export type GoalType = typeof ALL_GOAL_TYPES[number] | `Custom:${string}`;

// New unified Goal interface
export interface Goal {
  id: number;
  name: string;
  goal_type: GoalType;
  text: string;
  start_date: string | null;  // Optional for lifestyle goals
  end_date: string | null;    // Optional for lifestyle goals
  end_time: string;  // HH:MM for daily countdown
  status_text: string;  // Custom badge text
  show_countdown: boolean;
  is_completed: boolean;
  completed_at: string | null;
  is_visible: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  days_remaining?: number | null;
}

export interface GoalCreate {
  name: string;
  goal_type: GoalType;
  text?: string;
  start_date?: string;  // Optional for lifestyle goals
  end_date?: string;    // Optional for lifestyle goals
  end_time?: string;
  status_text?: string;
  show_countdown?: boolean;
  is_visible?: boolean;
  order_index?: number;
}

export interface GoalUpdate {
  name?: string;
  goal_type?: GoalType;
  text?: string;
  start_date?: string;
  end_date?: string;
  end_time?: string;
  status_text?: string;
  show_countdown?: boolean;
  is_completed?: boolean;
  is_visible?: boolean;
  order_index?: number;
}

// Legacy Goal interfaces (for backward compatibility during transition)
export interface LegacyGoal {
  id: number;
  text: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  days_remaining?: number;
}

export interface LegacyGoalCreate {
  text: string;
  start_date: string;
  end_date: string;
}

export interface LegacyGoalUpdate {
  text?: string;
  start_date?: string;
  end_date?: string;
}

export interface List {
  id: number;
  name: string;
  description: string;
  color: string;
  order_index: number;
  is_archived: boolean;
  is_kanban?: boolean;
  kanban_order?: number;
  created_at: string;
  updated_at: string;
  entry_count?: number;
  labels?: Label[];
}

export interface ListWithEntries extends List {
  entries: NoteEntry[];
}

export interface ListCreate {
  name: string;
  description?: string;
  color?: string;
  order_index?: number;
  is_archived?: boolean;
  is_kanban?: boolean;
  kanban_order?: number;
}

export interface ListUpdate {
  name?: string;
  description?: string;
  color?: string;
  order_index?: number;
  is_archived?: boolean;
  is_kanban?: boolean;
  kanban_order?: number;
}

export interface EntryListAssociation {
  entry_id: number;
  list_id: number;
  order_index: number;
}

export interface CustomEmoji {
  id: number;
  name: string;
  image_url: string;
  category: string;
  keywords: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomEmojiCreate {
  name: string;
  category?: string;
  keywords?: string;
}

export interface CustomEmojiUpdate {
  name?: string;
  category?: string;
  keywords?: string;
}

export interface Reminder {
  id: number;
  entry_id: number;
  reminder_datetime: string; // ISO format
  is_dismissed: boolean;
  created_at: string;
  updated_at: string;
  entry?: NoteEntry; // Optional full entry details
}

export interface ReminderCreate {
  entry_id: number;
  reminder_datetime: string;
}

export interface ReminderUpdate {
  reminder_datetime?: string;
  is_dismissed?: boolean;
}

// ===========================
// LLM Integration Types
// ===========================

export type LlmProvider = 'openai' | 'anthropic' | 'gemini';

export type OpenaiApiType = 'chat_completions' | 'responses';

export interface LlmSettings {
  llm_provider: LlmProvider;
  openai_api_type: OpenaiApiType;
  openai_api_key_set: boolean;
  anthropic_api_key_set: boolean;
  gemini_api_key_set: boolean;
  llm_global_prompt: string;
}

export interface LlmSettingsUpdate {
  llm_provider?: LlmProvider;
  openai_api_type?: OpenaiApiType;
  openai_api_key?: string;
  anthropic_api_key?: string;
  gemini_api_key?: string;
  llm_global_prompt?: string;
}

export interface LlmMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LlmSendRequest {
  entry_id: number;
  prompt: string;
  continue_conversation?: boolean;
}

export interface LlmSendResponse {
  response: string;
  conversation_id: number;
  provider: LlmProvider;
  input_tokens: number;
  output_tokens: number;
}

export interface LlmConversation {
  id: number;
  entry_id: number;
  messages: LlmMessage[];
  created_at: string;
  updated_at: string;
}

// ===========================
// MCP Server Types
// ===========================

export type McpServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface McpRoutingRule {
  id: number;
  mcp_server_id: number;
  pattern: string;
  priority: number;
  is_enabled: boolean;
  created_at: string;
}

export interface McpServer {
  id: number;
  name: string;
  image: string;
  port: number;
  description: string;
  env_vars: string[];
  status: McpServerStatus;
  last_health_check: string | null;
  auto_start: boolean;
  source: 'local' | 'github';
  manifest_url: string;
  created_at: string;
  updated_at: string;
  routing_rules?: McpRoutingRule[];
}

export interface McpServerCreate {
  name: string;
  image: string;
  port: number;
  description?: string;
  env_vars?: string[];
  auto_start?: boolean;
}

export interface McpServerUpdate {
  name?: string;
  image?: string;
  port?: number;
  description?: string;
  env_vars?: string[];
  auto_start?: boolean;
}

export interface McpRoutingRuleCreate {
  mcp_server_id: number;
  pattern: string;
  priority?: number;
  is_enabled?: boolean;
}

export interface McpRoutingRuleUpdate {
  pattern?: string;
  priority?: number;
  is_enabled?: boolean;
}

export interface McpSettings {
  mcp_enabled: boolean;
  mcp_idle_timeout: number;
  mcp_fallback_to_llm: boolean;
  docker_available: boolean;
}

export interface McpSettingsUpdate {
  mcp_enabled?: boolean;
  mcp_idle_timeout?: number;
  mcp_fallback_to_llm?: boolean;
}

export interface McpDockerStatus {
  available: boolean;
  version?: string;
  error?: string;
}

export interface McpServerLogs {
  server_id: number;
  server_name: string;
  logs: string;
  timestamp: string;
}

export interface McpMatchResult {
  matched: boolean;
  mcp_enabled: boolean;
  server_name?: string;
  server_status?: McpServerStatus;
  description?: string;
}

