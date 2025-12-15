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
  LegacyGoal,
  LegacyGoalCreate,
  LegacyGoalUpdate,
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
  LlmSendRequest,
  LlmSendResponse,
  LlmConversation,
  LlmSettings,
  McpServer,
  McpServerCreate,
  McpServerUpdate,
  McpRoutingRule,
  McpRoutingRuleCreate,
  McpRoutingRuleUpdate,
  McpSettings,
  McpSettingsUpdate,
  McpDockerStatus,
  McpServerLogs,
  McpMatchResult,
  JupyterStatus,
  JupyterSettings,
  JupyterSettingsUpdate,
  JupyterExecuteResponse,
  JupyterExportCell,
  JupyterExportNode,
  JupyterImportResponse,
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

  toggleArchive: async (entryId: number): Promise<NoteEntry> => {
    const response = await api.post<NoteEntry>(`/api/entries/${entryId}/toggle-archive`);
    return response.data;
  },

  getArchived: async (): Promise<NoteEntry[]> => {
    const response = await api.get<NoteEntry[]>('/api/entries/archived');
    return response.data;
  },
};

// Goals API (unified)
export const goalsApi = {
  // =====================
  // Unified Goals API (new)
  // =====================
  
  getAll: async (includeHidden = false): Promise<Goal[]> => {
    const response = await api.get<Goal[]>('/api/goals/', { params: { include_hidden: includeHidden } });
    return response.data;
  },

  getActiveForDate: async (date: string): Promise<Goal[]> => {
    const response = await api.get<Goal[]>(`/api/goals/active/${date}`);
    return response.data;
  },

  getById: async (goalId: number): Promise<Goal> => {
    const response = await api.get<Goal>(`/api/goals/${goalId}`);
    return response.data;
  },

  create: async (goal: GoalCreate): Promise<Goal> => {
    const response = await api.post<Goal>('/api/goals/', goal);
    return response.data;
  },

  update: async (goalId: number, update: GoalUpdate): Promise<Goal> => {
    const response = await api.put<Goal>(`/api/goals/${goalId}`, update);
    return response.data;
  },

  toggleComplete: async (goalId: number): Promise<Goal> => {
    const response = await api.post<Goal>(`/api/goals/${goalId}/toggle-complete`);
    return response.data;
  },

  toggleVisibility: async (goalId: number): Promise<Goal> => {
    const response = await api.post<Goal>(`/api/goals/${goalId}/toggle-visibility`);
    return response.data;
  },

  reorder: async (goals: { id: number; order_index: number }[]): Promise<void> => {
    await api.put('/api/goals/reorder', goals);
  },

  delete: async (goalId: number): Promise<void> => {
    await api.delete(`/api/goals/${goalId}`);
  },

  getTypes: async (): Promise<{ time_based: string[]; lifestyle: string[]; all_preset: string[] }> => {
    const response = await api.get('/api/goals/types');
    return response.data;
  },

  // =====================
  // Legacy Sprint Goals (for backward compatibility)
  // =====================
  
  getAllSprints: async (): Promise<LegacyGoal[]> => {
    const response = await api.get<LegacyGoal[]>('/api/goals/sprint');
    return response.data;
  },

  getSprintForDate: async (date: string): Promise<LegacyGoal> => {
    const response = await api.get<LegacyGoal>(`/api/goals/sprint/${date}`, {
      validateStatus: (status) => status === 200 || status === 404,
    });
    if (response.status === 404) {
      throw { response: { status: 404 } };
    }
    return response.data;
  },

  createSprint: async (goal: LegacyGoalCreate): Promise<LegacyGoal> => {
    const response = await api.post<LegacyGoal>('/api/goals/sprint', goal);
    return response.data;
  },

  updateSprint: async (goalId: number, update: LegacyGoalUpdate): Promise<LegacyGoal> => {
    const response = await api.put<LegacyGoal>(`/api/goals/sprint/${goalId}`, update);
    return response.data;
  },

  deleteSprint: async (goalId: number): Promise<void> => {
    await api.delete(`/api/goals/sprint/${goalId}`);
  },

  // =====================
  // Legacy Quarterly Goals (for backward compatibility)
  // =====================
  
  getAllQuarterly: async (): Promise<LegacyGoal[]> => {
    const response = await api.get<LegacyGoal[]>('/api/goals/quarterly');
    return response.data;
  },

  getQuarterlyForDate: async (date: string): Promise<LegacyGoal> => {
    const response = await api.get<LegacyGoal>(`/api/goals/quarterly/${date}`, {
      validateStatus: (status) => status === 200 || status === 404,
    });
    if (response.status === 404) {
      throw { response: { status: 404 } };
    }
    return response.data;
  },

  createQuarterly: async (goal: LegacyGoalCreate): Promise<LegacyGoal> => {
    const response = await api.post<LegacyGoal>('/api/goals/quarterly', goal);
    return response.data;
  },

  updateQuarterly: async (goalId: number, update: LegacyGoalUpdate): Promise<LegacyGoal> => {
    const response = await api.put<LegacyGoal>(`/api/goals/quarterly/${goalId}`, update);
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

  getArchived: async (): Promise<ListWithEntries[]> => {
    const response = await api.get<ListWithEntries[]>('/api/lists/archived');
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

// LLM API
export const llmApi = {
  send: async (request: LlmSendRequest): Promise<LlmSendResponse> => {
    const response = await api.post<LlmSendResponse>('/api/llm/send', request);
    return response.data;
  },

  getConversation: async (entryId: number): Promise<LlmConversation | null> => {
    const response = await api.get<LlmConversation | null>(`/api/llm/conversation/${entryId}`);
    return response.data;
  },

  clearConversation: async (entryId: number): Promise<void> => {
    await api.delete(`/api/llm/conversation/${entryId}`);
  },

  getSettings: async (): Promise<LlmSettings> => {
    const response = await api.get<LlmSettings>('/api/llm/settings');
    return response.data;
  },

  checkMcpMatch: async (prompt: string, entryId: number): Promise<McpMatchResult> => {
    const response = await api.post<McpMatchResult>('/api/llm/check-mcp-match', {
      entry_id: entryId,
      prompt,
    });
    return response.data;
  },
};

// MCP API
export const mcpApi = {
  // Server management
  getServers: async (): Promise<McpServer[]> => {
    const response = await api.get<McpServer[]>('/api/mcp/servers');
    return response.data;
  },

  getServer: async (id: number): Promise<McpServer> => {
    const response = await api.get<McpServer>(`/api/mcp/servers/${id}`);
    return response.data;
  },

  createServer: async (server: McpServerCreate): Promise<McpServer> => {
    const response = await api.post<McpServer>('/api/mcp/servers', server);
    return response.data;
  },

  updateServer: async (id: number, update: McpServerUpdate): Promise<McpServer> => {
    const response = await api.put<McpServer>(`/api/mcp/servers/${id}`, update);
    return response.data;
  },

  deleteServer: async (id: number): Promise<void> => {
    await api.delete(`/api/mcp/servers/${id}`);
  },

  // Container operations
  startServer: async (id: number): Promise<McpServer> => {
    const response = await api.post<McpServer>(`/api/mcp/servers/${id}/start`);
    return response.data;
  },

  stopServer: async (id: number): Promise<McpServer> => {
    const response = await api.post<McpServer>(`/api/mcp/servers/${id}/stop`);
    return response.data;
  },

  restartServer: async (id: number): Promise<McpServer> => {
    const response = await api.post<McpServer>(`/api/mcp/servers/${id}/restart`);
    return response.data;
  },

  buildImage: async (id: number): Promise<McpServer> => {
    const response = await api.post<McpServer>(`/api/mcp/servers/${id}/build`);
    return response.data;
  },

  getLogs: async (id: number, tail?: number): Promise<McpServerLogs> => {
    const response = await api.get<McpServerLogs>(`/api/mcp/servers/${id}/logs`, {
      params: { tail: tail || 100 },
    });
    return response.data;
  },

  checkHealth: async (id: number): Promise<{ healthy: boolean; error?: string; server: McpServer }> => {
    const response = await api.get<{ healthy: boolean; error?: string; server: McpServer }>(
      `/api/mcp/servers/${id}/health`
    );
    return response.data;
  },

  // Docker status
  getDockerStatus: async (): Promise<McpDockerStatus> => {
    const response = await api.get<McpDockerStatus>('/api/mcp/docker/status');
    return response.data;
  },

  // GitHub import
  importFromManifest: async (manifestUrl: string): Promise<McpServer> => {
    const response = await api.post<McpServer>('/api/mcp/import', { manifest_url: manifestUrl });
    return response.data;
  },

  // Routing rules
  getRoutingRules: async (): Promise<McpRoutingRule[]> => {
    const response = await api.get<McpRoutingRule[]>('/api/mcp/routing-rules');
    return response.data;
  },

  createRoutingRule: async (rule: McpRoutingRuleCreate): Promise<McpRoutingRule> => {
    const response = await api.post<McpRoutingRule>('/api/mcp/routing-rules', rule);
    return response.data;
  },

  updateRoutingRule: async (id: number, update: McpRoutingRuleUpdate): Promise<McpRoutingRule> => {
    const response = await api.put<McpRoutingRule>(`/api/mcp/routing-rules/${id}`, update);
    return response.data;
  },

  deleteRoutingRule: async (id: number): Promise<void> => {
    await api.delete(`/api/mcp/routing-rules/${id}`);
  },

  // Settings
  getSettings: async (): Promise<McpSettings> => {
    const response = await api.get<McpSettings>('/api/mcp/settings');
    return response.data;
  },

  updateSettings: async (settings: McpSettingsUpdate): Promise<McpSettings> => {
    const response = await api.patch<McpSettings>('/api/mcp/settings', settings);
    return response.data;
  },
};

// Jupyter API
export const jupyterApi = {
  getStatus: async (): Promise<JupyterStatus> => {
    const response = await api.get<JupyterStatus>('/api/jupyter/status');
    return response.data;
  },

  getSettings: async (): Promise<JupyterSettings> => {
    const response = await api.get<JupyterSettings>('/api/jupyter/settings');
    return response.data;
  },

  updateSettings: async (settings: JupyterSettingsUpdate): Promise<JupyterSettings> => {
    const response = await api.patch<JupyterSettings>('/api/jupyter/settings', settings);
    return response.data;
  },

  start: async (): Promise<{ success: boolean; kernel_id?: string; error?: string }> => {
    const response = await api.post<{ success: boolean; kernel_id?: string; error?: string }>('/api/jupyter/start');
    return response.data;
  },

  stop: async (): Promise<{ success: boolean; error?: string }> => {
    const response = await api.post<{ success: boolean; error?: string }>('/api/jupyter/stop');
    return response.data;
  },

  execute: async (code: string): Promise<JupyterExecuteResponse> => {
    const response = await api.post<JupyterExecuteResponse>('/api/jupyter/execute', { code });
    return response.data;
  },

  interrupt: async (): Promise<{ success: boolean; error?: string }> => {
    const response = await api.post<{ success: boolean; error?: string }>('/api/jupyter/interrupt');
    return response.data;
  },

  restart: async (): Promise<{ success: boolean; error?: string }> => {
    const response = await api.post<{ success: boolean; error?: string }>('/api/jupyter/restart');
    return response.data;
  },

  getLogs: async (tail?: number): Promise<{ logs: string }> => {
    const response = await api.get<{ logs: string }>('/api/jupyter/logs', { params: { tail } });
    return response.data;
  },

  healthCheck: async (): Promise<{ healthy: boolean; error?: string }> => {
    const response = await api.get<{ healthy: boolean; error?: string }>('/api/jupyter/health');
    return response.data;
  },

  exportNotebook: async (cells: JupyterExportCell[], filename?: string): Promise<Blob> => {
    const response = await api.post('/api/jupyter/export', { cells, filename: filename || 'notebook.ipynb' }, {
      responseType: 'blob',
    });
    return response.data;
  },

  exportMixedNotebook: async (nodes: JupyterExportNode[], filename?: string): Promise<Blob> => {
    const response = await api.post('/api/jupyter/export-mixed', { nodes, filename: filename || 'notebook.ipynb' }, {
      responseType: 'blob',
    });
    return response.data;
  },

  importNotebook: async (file: File): Promise<JupyterImportResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<JupyterImportResponse>('/api/jupyter/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  importNotebookFromUrl: async (url: string, pyprojectUrl?: string): Promise<JupyterImportResponse> => {
    const body: { url: string; pyproject_url?: string } = { url };
    if (pyprojectUrl) {
      body.pyproject_url = pyprojectUrl;
    }
    const response = await api.post<JupyterImportResponse>('/api/jupyter/import-url', body);
    return response.data;
  },
};

export default api;

