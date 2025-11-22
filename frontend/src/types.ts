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
}

export interface Goal {
  id: number;
  text: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  days_remaining?: number;  // Calculated field relative to queried date
}

export interface GoalCreate {
  text: string;
  start_date: string;
  end_date: string;
}

export interface GoalUpdate {
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

