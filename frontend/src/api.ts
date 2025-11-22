import axios from 'axios';
import type {
  DailyNote,
  DailyNoteCreate,
  DailyNoteUpdate,
  NoteEntry,
  NoteEntryCreate,
  NoteEntryUpdate,
  Goal,
  GoalCreate,
  GoalUpdate,
  List,
  ListWithEntries,
  ListCreate,
  ListUpdate,
  EntryListAssociation,
  CustomEmoji,
  CustomEmojiCreate,
  CustomEmojiUpdate,
  Reminder,
  ReminderCreate,
  ReminderUpdate,
  AppSettings,
  AppSettingsUpdate,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Daily Notes API
export const notesApi = {
  getAll: async (): Promise<DailyNote[]> => {
    const response = await api.get<DailyNote[]>('/api/notes/');
    return response.data;
  },

  getByDate: async (date: string): Promise<DailyNote> => {
    const response = await api.get<DailyNote>(`/api/notes/${date}`);
    return response.data;
  },

  create: async (note: DailyNoteCreate): Promise<DailyNote> => {
    const response = await api.post<DailyNote>('/api/notes/', note);
    return response.data;
  },

  update: async (date: string, update: DailyNoteUpdate): Promise<DailyNote> => {
    const response = await api.put<DailyNote>(`/api/notes/${date}`, update);
    return response.data;
  },

  delete: async (date: string): Promise<void> => {
    await api.delete(`/api/notes/${date}`);
  },

  getByMonth: async (year: number, month: number): Promise<DailyNote[]> => {
    const response = await api.get<DailyNote[]>(`/api/notes/month/${year}/${month}`);
    return response.data;
  },
};

// Entries API
export const entriesApi = {
  getForDate: async (date: string): Promise<NoteEntry[]> => {
    const response = await api.get<NoteEntry[]>(`/api/entries/note/${date}`);
    return response.data;
  },

  create: async (date: string, entry: NoteEntryCreate): Promise<NoteEntry> => {
    const response = await api.post<NoteEntry>(`/api/entries/note/${date}`, entry);
    return response.data;
  },

  update: async (entryId: number, update: NoteEntryUpdate): Promise<NoteEntry> => {
    const response = await api.put<NoteEntry>(`/api/entries/${entryId}`, update);
    return response.data;
  },

  delete: async (entryId: number): Promise<void> => {
    await api.delete(`/api/entries/${entryId}`);
  },

  get: async (entryId: number): Promise<NoteEntry> => {
    const response = await api.get<NoteEntry>(`/api/entries/${entryId}`);
    return response.data;
  },

  togglePin: async (entryId: number): Promise<NoteEntry> => {
    const response = await api.post<NoteEntry>(`/api/entries/${entryId}/toggle-pin`);
    return response.data;
  },
};

// Goals API
export const goalsApi = {
  // Sprint Goals
  getAllSprints: async (): Promise<Goal[]> => {
    const response = await api.get<Goal[]>('/api/goals/sprint');
    return response.data;
  },

  getSprintForDate: async (date: string): Promise<Goal> => {
    const response = await api.get<Goal>(`/api/goals/sprint/${date}`, {
      validateStatus: (status) => status === 200 || status === 404, // Don't throw on 404
    });
    if (response.status === 404) {
      throw { response: { status: 404 } }; // Throw a simple error for the caller to handle
    }
    return response.data;
  },

  createSprint: async (goal: GoalCreate): Promise<Goal> => {
    const response = await api.post<Goal>('/api/goals/sprint', goal);
    return response.data;
  },

  updateSprint: async (goalId: number, update: GoalUpdate): Promise<Goal> => {
    const response = await api.put<Goal>(`/api/goals/sprint/${goalId}`, update);
    return response.data;
  },

  deleteSprint: async (goalId: number): Promise<void> => {
    await api.delete(`/api/goals/sprint/${goalId}`);
  },

  // Quarterly Goals
  getAllQuarterly: async (): Promise<Goal[]> => {
    const response = await api.get<Goal[]>('/api/goals/quarterly');
    return response.data;
  },

  getQuarterlyForDate: async (date: string): Promise<Goal> => {
    const response = await api.get<Goal>(`/api/goals/quarterly/${date}`, {
      validateStatus: (status) => status === 200 || status === 404, // Don't throw on 404
    });
    if (response.status === 404) {
      throw { response: { status: 404 } }; // Throw a simple error for the caller to handle
    }
    return response.data;
  },

  createQuarterly: async (goal: GoalCreate): Promise<Goal> => {
    const response = await api.post<Goal>('/api/goals/quarterly', goal);
    return response.data;
  },

  updateQuarterly: async (goalId: number, update: GoalUpdate): Promise<Goal> => {
    const response = await api.put<Goal>(`/api/goals/quarterly/${goalId}`, update);
    return response.data;
  },

  deleteQuarterly: async (goalId: number): Promise<void> => {
    await api.delete(`/api/goals/quarterly/${goalId}`);
  },
};

// Lists API
export const listsApi = {
  getAll: async (includeArchived: boolean = false): Promise<List[]> => {
    const response = await api.get<List[]>('/api/lists', { params: { include_archived: includeArchived } });
    return response.data;
  },

  getById: async (listId: number): Promise<ListWithEntries> => {
    const response = await api.get<ListWithEntries>(`/api/lists/${listId}`);
    return response.data;
  },

  create: async (list: ListCreate): Promise<List> => {
    const response = await api.post<List>('/api/lists', list);
    return response.data;
  },

  update: async (listId: number, update: ListUpdate): Promise<List> => {
    const response = await api.put<List>(`/api/lists/${listId}`, update);
    return response.data;
  },

  delete: async (listId: number): Promise<void> => {
    await api.delete(`/api/lists/${listId}`);
  },

  addEntry: async (listId: number, entryId: number, orderIndex: number = 0): Promise<void> => {
    await api.post(`/api/lists/${listId}/entries/${entryId}`, { order_index: orderIndex });
  },

  removeEntry: async (listId: number, entryId: number): Promise<void> => {
    await api.delete(`/api/lists/${listId}/entries/${entryId}`);
  },

  reorderEntries: async (listId: number, entries: EntryListAssociation[]): Promise<void> => {
    await api.put(`/api/lists/${listId}/reorder`, { entries });
  },

  reorderLists: async (lists: { id: number; order_index: number }[]): Promise<void> => {
    await api.put('/api/lists/reorder', { lists });
  },

  addLabel: async (listId: number, labelId: number): Promise<void> => {
    await api.post(`/api/lists/${listId}/labels/${labelId}`);
  },

  removeLabel: async (listId: number, labelId: number): Promise<void> => {
    await api.delete(`/api/lists/${listId}/labels/${labelId}`);
  },

  updateEntry: async (entryId: number, update: Partial<NoteEntry>): Promise<NoteEntry> => {
    const response = await api.patch<NoteEntry>(`/api/entries/${entryId}`, update);
    return response.data;
  },
};

// Kanban API
export const kanbanApi = {
  getBoards: async (): Promise<ListWithEntries[]> => {
    const response = await api.get<List[]>('/api/lists/kanban');
    const detailedBoards = await Promise.all(
      response.data.map((board) => listsApi.getById(board.id))
    );
    detailedBoards.sort((a, b) => (a.kanban_order || 0) - (b.kanban_order || 0));
    return detailedBoards;
  },

  initialize: async (): Promise<{ message: string; columns: List[] }> => {
    const response = await api.post<{ message: string; columns: List[] }>('/api/lists/kanban/initialize');
    return response.data;
  },

  reorderColumns: async (columns: { id: number; order_index: number }[]): Promise<void> => {
    await api.put('/api/lists/kanban/reorder', { lists: columns });
  },
};

// Custom Emojis API
export const customEmojisApi = {
  getAll: async (includeDeleted = false): Promise<CustomEmoji[]> => {
    const response = await api.get<CustomEmoji[]>('/api/custom-emojis', {
      params: { include_deleted: includeDeleted },
    });
    return response.data;
  },

  create: async (formData: FormData): Promise<CustomEmoji> => {
    const response = await api.post<CustomEmoji>('/api/custom-emojis', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  update: async (id: number, data: CustomEmojiUpdate): Promise<CustomEmoji> => {
    const response = await api.patch<CustomEmoji>(`/api/custom-emojis/${id}`, data);
    return response.data;
  },

  delete: async (id: number, permanent = false): Promise<void> => {
    await api.delete(`/api/custom-emojis/${id}`, {
      params: { permanent },
    });
  },
};

// Reminders API
export const remindersApi = {
  getAll: async (includeDismissed = false): Promise<Reminder[]> => {
    const response = await api.get<Reminder[]>('/api/reminders', {
      params: { include_dismissed: includeDismissed },
    });
    return response.data;
  },

  getForEntry: async (entryId: number): Promise<Reminder | null> => {
    const response = await api.get<Reminder | null>(`/api/reminders/entry/${entryId}`);
    return response.data;
  },

  getDue: async (): Promise<Reminder[]> => {
    const response = await api.get<Reminder[]>('/api/reminders/due');
    return response.data;
  },

  create: async (reminder: ReminderCreate): Promise<Reminder> => {
    const response = await api.post<Reminder>('/api/reminders', reminder);
    return response.data;
  },

  update: async (reminderId: number, update: ReminderUpdate): Promise<Reminder> => {
    const response = await api.patch<Reminder>(`/api/reminders/${reminderId}`, update);
    return response.data;
  },

  delete: async (reminderId: number): Promise<void> => {
    await api.delete(`/api/reminders/${reminderId}`);
  },
};

// Settings API
export const settingsApi = {
  get: async (): Promise<AppSettings> => {
    const response = await api.get<AppSettings>('/api/settings');
    return response.data;
  },

  update: async (settings: AppSettingsUpdate): Promise<AppSettings> => {
    const response = await api.patch<AppSettings>('/api/settings', settings);
    return response.data;
  },
};

export default api;

