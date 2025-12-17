import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Upload, Settings as SettingsIcon, Clock, Archive, Tag, Trash2, Edit2, Palette, Plus, RotateCcw, ChevronRight, Columns, BookOpen, Target, Sparkles, Server, FileCode, Play, Square, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { listsApi, entriesApi, goalsApi, jupyterApi } from '../api';
import { useTimezone } from '../contexts/TimezoneContext';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { useCustomBackground } from '../contexts/CustomBackgroundContext';
import { useTransparentLabels } from '../contexts/TransparentLabelsContext';
import { useDailyGoals } from '../contexts/DailyGoalsContext';
import { useDayLabels } from '../contexts/DayLabelsContext';
import { useEmojiLibrary } from '../contexts/EmojiLibraryContext';
import CustomThemeCreator from './CustomThemeCreator';
import CustomBackgroundSettings from './CustomBackgroundSettings';
import CustomEmojiManager from './CustomEmojiManager';
import TextureSettings from './TextureSettings';
import GoalCard from './GoalCard';
import GoalForm from './GoalForm';
import McpServerManager from './McpServerManager';
import { useTexture } from '../hooks/useTexture';
import type { Goal, GoalCreate, GoalUpdate, LlmProvider, OpenaiApiType, JupyterStatus, JupyterSettings } from '../types';

interface Label {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

type ConfirmationDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmationDialog = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl p-6"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-primary)',
        }}
      >
        <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h3>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-primary)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-accent-text)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Skeleton component for loading state
const SettingsSkeleton = () => (
  <div className="space-y-6">
    {/* General Settings Skeleton */}
    <section className="animate-pulse">
      <div className="h-7 w-32 rounded mb-4" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <div className="h-4 w-24 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
          <div className="h-8 w-40 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
          <div className="h-8 w-24 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
        </div>
      </div>
    </section>

    {/* Goals Skeleton */}
    <section className="animate-pulse">
      <div className="h-7 w-24 rounded mb-4" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
              <div className="flex-1">
                <div className="h-4 w-48 rounded mb-2" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
                <div className="h-3 w-32 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* Theme Skeleton */}
    <section className="animate-pulse">
      <div className="h-7 w-28 rounded mb-4" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
      <div className="flex flex-wrap gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-20 h-20 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
        ))}
      </div>
    </section>

    {/* Labels Skeleton */}
    <section className="animate-pulse">
      <div className="h-7 w-20 rounded mb-4" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
              <div className="h-4 w-24 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
            </div>
            <div className="h-4 w-12 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
          </div>
        ))}
      </div>
    </section>

    {/* AI Settings Skeleton */}
    <section className="animate-pulse">
      <div className="h-7 w-36 rounded mb-4" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <div className="h-4 w-28 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
          <div className="h-8 w-32 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
        </div>
        <div className="h-24 w-full rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
      </div>
    </section>

    {/* Archive Skeleton */}
    <section 
      className="animate-pulse rounded-xl p-6"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-primary)',
      }}
    >
      <div className="h-7 w-24 rounded mb-4" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
      <div className="grid grid-cols-2 gap-4">
        <div 
          className="rounded-lg p-4 text-center"
          style={{
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border-primary)',
          }}
        >
          <div className="h-4 w-4 mx-auto rounded mb-2" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
          <div className="h-8 w-8 mx-auto rounded mb-2" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
          <div className="h-4 w-24 mx-auto rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
        </div>
        <div 
          className="rounded-lg p-4 text-center"
          style={{
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border-primary)',
          }}
        >
          <div className="h-4 w-4 mx-auto rounded mb-2" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
          <div className="h-8 w-8 mx-auto rounded mb-2" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
          <div className="h-4 w-24 mx-auto rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }} />
        </div>
      </div>
    </section>
  </div>
);

const Settings = () => {
  const navigate = useNavigate();
  const textureStyles = useTexture('settings');
  const [initialLoading, setInitialLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingFiles, setIsDownloadingFiles] = useState(false);
  const [isRestoringFiles, setIsRestoringFiles] = useState(false);
  const [isFullRestoring, setIsFullRestoring] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'markdown'>('json');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { timezone, setTimezone } = useTimezone();
  const { currentTheme, setTheme, availableThemes, customThemes, deleteCustomTheme, isBuiltInTheme, isThemeModified, restoreThemeToDefault } = useTheme();
  
  const {
    enabled: customBgEnabled,
    toggleEnabled: toggleCustomBgEnabled,
    currentImage: customBgCurrentImage,
    uploadedImages: customBgUploadedImages,
    fetchUploadedImages: fetchCustomBgUploadedImages,
    nextImage: nextCustomBgImage,
    autoRotate: customBgAutoRotate,
    toggleAutoRotate: toggleCustomBgAutoRotate,
    rotationInterval: customBgRotationInterval,
    setRotationInterval: setCustomBgRotationInterval,
  } = useCustomBackground();
  
  const { transparentLabels, toggleTransparentLabels } = useTransparentLabels();
  const { showDailyGoals, setShowDailyGoals } = useDailyGoals();
  const { showDayLabels, setShowDayLabels } = useDayLabels();
  const { emojiLibrary, setEmojiLibrary } = useEmojiLibrary();
  
  // Goals state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  
  // Archive data
  const [archivedLists, setArchivedLists] = useState<any[]>([]);
  const [archivedCards, setArchivedCards] = useState<any[]>([]);
  
  const loadArchivedData = useCallback(async () => {
    try {
      const [lists, entries] = await Promise.all([
        listsApi.getArchived(),
        entriesApi.getArchived(),
      ]);
      setArchivedLists(lists);
      setArchivedCards(entries);
    } catch (err) {
      console.error('Error loading archived data:', err);
    }
  }, []);
  
  // Load goals
  const loadGoals = useCallback(async () => {
    setLoadingGoals(true);
    try {
      const allGoals = await goalsApi.getAll(true); // Include hidden goals
      setGoals(allGoals);
    } catch (error) {
      console.error('Failed to load goals:', error);
    } finally {
      setLoadingGoals(false);
    }
  }, []);

  // Goal handlers
  const handleCreateGoal = async (goalData: GoalCreate) => {
    try {
      const newGoal = await goalsApi.create(goalData);
      // Optimistic update - add to list immediately without reloading
      setGoals(prev => [...prev, newGoal]);
      setShowGoalForm(false);
      showMessage('success', 'Goal created successfully');
    } catch (error: any) {
      console.error('Failed to create goal:', error);
      showMessage('error', error.response?.data?.detail || 'Failed to create goal');
    }
  };

  const handleUpdateGoal = async (goalData: GoalUpdate) => {
    if (!editingGoal) return;
    try {
      const updatedGoal = await goalsApi.update(editingGoal.id, goalData);
      // Optimistic update - update in list immediately without reloading
      setGoals(prev => prev.map(g => g.id === editingGoal.id ? updatedGoal : g));
      setEditingGoal(null);
      setShowGoalForm(false);
      showMessage('success', 'Goal updated successfully');
    } catch (error: any) {
      console.error('Failed to update goal:', error);
      showMessage('error', error.response?.data?.detail || 'Failed to update goal');
    }
  };

  const handleToggleGoalComplete = async (goalId: number) => {
    // Optimistic update - toggle locally first for smooth UX
    setGoals(prev => prev.map(g => 
      g.id === goalId ? { ...g, is_completed: !g.is_completed } : g
    ));
    
    try {
      await goalsApi.toggleComplete(goalId);
      // Don't reload all goals - optimistic update already applied
    } catch (error) {
      console.error('Failed to toggle goal completion:', error);
      // Revert on error by reloading
      await loadGoals();
    }
  };

  const handleToggleGoalVisibility = async (goalId: number) => {
    // Optimistic update - toggle locally first for smooth UX
    setGoals(prev => prev.map(g => 
      g.id === goalId ? { ...g, is_visible: !g.is_visible } : g
    ));
    
    try {
      await goalsApi.toggleVisibility(goalId);
      // Don't reload all goals - optimistic update already applied
    } catch (error) {
      console.error('Failed to toggle goal visibility:', error);
      // Revert on error by reloading
      await loadGoals();
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    // Optimistic update - remove from list immediately
    const previousGoals = goals;
    setGoals(prev => prev.filter(g => g.id !== goalId));
    
    try {
      await goalsApi.delete(goalId);
      showMessage('success', 'Goal deleted successfully');
    } catch (error) {
      console.error('Failed to delete goal:', error);
      // Revert on error
      setGoals(previousGoals);
      showMessage('error', 'Failed to delete goal');
    }
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setShowGoalForm(true);
  };
  
  // Strip HTML for preview
  const stripHtml = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };
  const [labels, setLabels] = useState<Label[]>([]);
  const [showEmojiManager, setShowEmojiManager] = useState(false);
  const [deletingLabelId, setDeletingLabelId] = useState<number | null>(null);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');
  const [dailyGoalEndTime, setDailyGoalEndTime] = useState('17:00');
  const [savingDailyGoalEndTime, setSavingDailyGoalEndTime] = useState(false);
  const [isUploadingCustomBgImage, setIsUploadingCustomBgImage] = useState(false);
  const [labelSortBy, setLabelSortBy] = useState<'name' | 'usage'>('name');
  const [isEditingTimezone, setIsEditingTimezone] = useState(false);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [showThemeCreator, setShowThemeCreator] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showFullRestoreConfirm, setShowFullRestoreConfirm] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // LLM Settings state
  const [llmProvider, setLlmProvider] = useState<LlmProvider>('openai');
  const [openaiApiType, setOpenaiApiType] = useState<OpenaiApiType>('chat_completions');
  const [openaiKeySet, setOpenaiKeySet] = useState(false);
  const [anthropicKeySet, setAnthropicKeySet] = useState(false);
  const [geminiKeySet, setGeminiKeySet] = useState(false);
  const [llmGlobalPrompt, setLlmGlobalPrompt] = useState('');
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
  const [anthropicKeyInput, setAnthropicKeyInput] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [savingLlmSettings, setSavingLlmSettings] = useState(false);

  // Jupyter Notebooks state
  const [jupyterStatus, setJupyterStatus] = useState<JupyterStatus | null>(null);
  const [jupyterSettings, setJupyterSettings] = useState<JupyterSettings | null>(null);
  const [jupyterLoading, setJupyterLoading] = useState(false);
  const [jupyterActionLoading, setJupyterActionLoading] = useState<string | null>(null);

  const loadJupyterSettings = useCallback(async () => {
    try {
      const [status, settings] = await Promise.all([
        jupyterApi.getStatus(),
        jupyterApi.getSettings(),
      ]);
      setJupyterStatus(status);
      setJupyterSettings(settings);
    } catch (error) {
      console.error('Error loading Jupyter settings:', error);
    }
  }, []);

  const handleJupyterToggle = async (field: 'jupyter_enabled' | 'jupyter_auto_start') => {
    if (!jupyterSettings) return;
    
    const newValue = !jupyterSettings[field];
    
    // Optimistic update
    setJupyterSettings(prev => prev ? { ...prev, [field]: newValue } : prev);
    
    try {
      await jupyterApi.updateSettings({ [field]: newValue });
      await loadJupyterSettings();
    } catch (error) {
      console.error('Error updating Jupyter setting:', error);
      // Revert on error
      setJupyterSettings(prev => prev ? { ...prev, [field]: !newValue } : prev);
      showMessage('error', 'Failed to update Jupyter setting');
    }
  };

  const handleJupyterVersionChange = async (version: string) => {
    if (!jupyterSettings) return;
    
    const oldValue = jupyterSettings.jupyter_python_version;
    
    // Optimistic update
    setJupyterSettings(prev => prev ? { ...prev, jupyter_python_version: version } : prev);
    
    try {
      await jupyterApi.updateSettings({ jupyter_python_version: version });
      // If container is running, show message about restart
      if (jupyterStatus?.container_running) {
        showMessage('success', 'Python version updated. Restart container for changes to take effect.');
      }
    } catch (error) {
      console.error('Error updating Python version:', error);
      setJupyterSettings(prev => prev ? { ...prev, jupyter_python_version: oldValue } : prev);
      showMessage('error', 'Failed to update Python version');
    }
  };

  const handleJupyterCustomImageChange = async (image: string) => {
    if (!jupyterSettings) return;
    
    // Optimistic update
    setJupyterSettings(prev => prev ? { ...prev, jupyter_custom_image: image } : prev);
    
    // Debounce the API call - only save after user stops typing
    // For simplicity, we'll save immediately but could add debounce
    try {
      await jupyterApi.updateSettings({ jupyter_custom_image: image });
    } catch (error) {
      console.error('Error updating custom image:', error);
      showMessage('error', 'Failed to update custom image');
    }
  };

  const handleJupyterStart = async () => {
    setJupyterActionLoading('start');
    try {
      const result = await jupyterApi.start();
      if (result.success) {
        showMessage('success', 'Jupyter container started successfully');
        await loadJupyterSettings();
      } else {
        showMessage('error', result.error || 'Failed to start Jupyter container');
      }
    } catch (error: any) {
      console.error('Error starting Jupyter:', error);
      showMessage('error', error.response?.data?.detail || 'Failed to start Jupyter container');
    } finally {
      setJupyterActionLoading(null);
    }
  };

  const handleJupyterStop = async () => {
    setJupyterActionLoading('stop');
    try {
      const result = await jupyterApi.stop();
      if (result.success) {
        showMessage('success', 'Jupyter container stopped');
        await loadJupyterSettings();
      } else {
        showMessage('error', result.error || 'Failed to stop Jupyter container');
      }
    } catch (error: any) {
      console.error('Error stopping Jupyter:', error);
      showMessage('error', error.response?.data?.detail || 'Failed to stop Jupyter container');
    } finally {
      setJupyterActionLoading(null);
    }
  };

  const handleJupyterRestart = async () => {
    setJupyterActionLoading('restart');
    try {
      const result = await jupyterApi.restart();
      if (result.success) {
        showMessage('success', 'Jupyter kernel restarted');
        await loadJupyterSettings();
      } else {
        showMessage('error', 'Failed to restart Jupyter kernel');
      }
    } catch (error: any) {
      console.error('Error restarting Jupyter:', error);
      showMessage('error', error.response?.data?.detail || 'Failed to restart Jupyter kernel');
    } finally {
      setJupyterActionLoading(null);
    }
  };

  const loadLlmSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings`);
      setLlmProvider(response.data.llm_provider || 'openai');
      setOpenaiApiType(response.data.openai_api_type || 'chat_completions');
      setOpenaiKeySet(response.data.openai_api_key_set || false);
      setAnthropicKeySet(response.data.anthropic_api_key_set || false);
      setGeminiKeySet(response.data.gemini_api_key_set || false);
      setLlmGlobalPrompt(response.data.llm_global_prompt || '');
    } catch (error) {
      console.error('Error loading LLM settings:', error);
    }
  };

  const handleSaveLlmSettings = async () => {
    setSavingLlmSettings(true);
    try {
      const updates: any = {
        llm_provider: llmProvider,
        openai_api_type: openaiApiType,
        llm_global_prompt: llmGlobalPrompt,
      };

      // Only update keys if they were entered (not empty placeholder)
      if (openaiKeyInput) updates.openai_api_key = openaiKeyInput;
      if (anthropicKeyInput) updates.anthropic_api_key = anthropicKeyInput;
      if (geminiKeyInput) updates.gemini_api_key = geminiKeyInput;

      await axios.patch(`${API_URL}/api/settings`, updates);

      // Refresh to get updated "key set" status
      await loadLlmSettings();

      // Clear input fields
      setOpenaiKeyInput('');
      setAnthropicKeyInput('');
      setGeminiKeyInput('');

      showMessage('success', 'AI settings saved successfully');
    } catch (error) {
      console.error('Error saving LLM settings:', error);
      showMessage('error', 'Failed to save AI settings');
    } finally {
      setSavingLlmSettings(false);
    }
  };

  // Unified initial data loading
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([
          loadArchivedData(),
          loadGoals(),
          loadLabels(),
          loadDailyGoalEndTime(),
          loadLlmSettings(),
          loadJupyterSettings(),
        ]);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setInitialLoading(false);
      }
    };
    loadInitialData();
  }, [loadArchivedData, loadGoals, loadJupyterSettings]);

  const loadDailyGoalEndTime = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings`);
      setDailyGoalEndTime(response.data.daily_goal_end_time || '17:00');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleDailyGoalEndTimeChange = async (newTime: string) => {
    setDailyGoalEndTime(newTime);
    setSavingDailyGoalEndTime(true);
    try {
      await axios.patch(`${API_URL}/api/settings`, { daily_goal_end_time: newTime });
    } catch (error) {
      console.error('Error saving daily goal end time:', error);
    } finally {
      setSavingDailyGoalEndTime(false);
    }
  };

  const handleOpenThemeCreator = () => {
    setEditingTheme(null);
    setShowThemeCreator(true);
  };

  const handleEditTheme = (theme: Theme) => {
    setEditingTheme(theme);
    setShowThemeCreator(true);
  };

  const handleCloseThemeCreator = () => {
    setShowThemeCreator(false);
    setEditingTheme(null);
  };

  const handleDeleteTheme = (themeId: string) => {
    deleteCustomTheme(themeId);
    showMessage('success', 'Custom theme deleted successfully');
  };

  const handleRestoreTheme = (themeId: string) => {
    restoreThemeToDefault(themeId);
    showMessage('success', 'Theme restored to default');
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const endpoint = exportFormat === 'json' ? '/api/backup/export' : '/api/backup/export-markdown';
      const response = await axios.get(`${API_URL}${endpoint}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const extension = exportFormat === 'json' ? 'json' : 'md';
      const filename = `track-the-thing-${new Date().toISOString().split('T')[0]}.${extension}`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      const formatName = exportFormat === 'json' ? 'JSON backup' : 'Markdown export';
      showMessage('success', `${formatName} downloaded successfully!`);
    } catch (error) {
      console.error('Export failed:', error);
      showMessage('error', 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const resetImportSelection = () => {
    setPendingImportFile(null);
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
  };

  const handleImportFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingImportFile(file);
    setShowImportConfirm(true);
  };

  const cancelImportConfirmation = () => {
    setShowImportConfirm(false);
    resetImportSelection();
  };

  const performJsonImport = async () => {
    if (!pendingImportFile) return;
    setShowImportConfirm(false);
    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', pendingImportFile);

    try {
      const response = await axios.post(`${API_URL}/api/backup/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const importedNotes = response.data?.stats?.notes_imported ?? 0;
      const warningSuffix = response.data?.warning ? ` Warning: ${response.data.warning}` : '';
      const reminder =
        ' Remember to restore the uploads ZIP to bring back custom backgrounds, emojis, and attachments.';

      showMessage('success', `Import successful! ${importedNotes} notes imported.${warningSuffix}${reminder}`);
    } catch (error: any) {
      console.error('Import failed:', error);
      showMessage('error', error.response?.data?.detail || 'Failed to import data');
    } finally {
      setIsImporting(false);
      resetImportSelection();
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadLabels = async () => {
    try {
      const response = await axios.get<Label[]>(`${API_URL}/api/labels/`);
      setLabels(response.data);
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  };

  // Filter and sort labels
  const filteredLabels = useMemo(() => {
    let filtered = labels;

    // Apply search filter
    if (labelSearchQuery.trim()) {
      const query = labelSearchQuery.trim();
      const queryLower = query.toLowerCase();
      
      filtered = filtered.filter(label => {
        // Check if the label itself is emoji
        const labelIsEmoji = isEmojiOnly(label.name);
        const queryIsEmoji = isEmojiOnly(query);
        
        // If both are emojis, do exact emoji matching
        if (labelIsEmoji && queryIsEmoji) {
          return label.name.includes(query);
        }
        
        // If query is emoji but label is text, no match
        if (queryIsEmoji && !labelIsEmoji) {
          return false;
        }
        
        // If label is emoji but query is text, no match
        if (labelIsEmoji && !queryIsEmoji) {
          return false;
        }
        
        // Both are text - do case-insensitive search
        return label.name.toLowerCase().includes(queryLower);
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      if (labelSortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // For usage sorting, we'd need usage counts from backend
      // For now, just sort by name as fallback
      return a.name.localeCompare(b.name);
    });

    return sorted;
  }, [labels, labelSearchQuery, labelSortBy]);

  const handleDeleteLabel = async (labelId: number, labelName: string) => {
    setDeletingLabelId(labelId);
    try {
      await axios.delete(`${API_URL}/api/labels/${labelId}`);
      setLabels(labels.filter(l => l.id !== labelId));
      showMessage('success', `Label "${labelName}" deleted successfully`);
    } catch (error: any) {
      console.error('Failed to delete label:', error);
      showMessage('error', error.response?.data?.detail || 'Failed to delete label');
    } finally {
      setDeletingLabelId(null);
    }
  };

  const handleCustomBgImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingCustomBgImage(true);
    try {
      // Upload all selected files
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        await axios.post(`${API_URL}/api/background-images/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      // Refresh the list of uploaded images
      await fetchCustomBgUploadedImages();
      showMessage('success', `Successfully uploaded ${files.length} image(s)`);
    } catch (error: any) {
      console.error('Failed to upload images:', error);
      showMessage('error', error.response?.data?.detail || 'Failed to upload images');
    } finally {
      setIsUploadingCustomBgImage(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleDeleteCustomBgImage = async (imageId: string) => {
    try {
      await axios.delete(`${API_URL}/api/background-images/${imageId}`);
      await fetchCustomBgUploadedImages();
      showMessage('success', 'Image deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete image:', error);
      showMessage('error', error.response?.data?.detail || 'Failed to delete image');
    }
  };

  // Check if a string is only emojis (with optional spaces)
  const isEmojiOnly = (str: string): boolean => {
    const emojiRegex = /^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}\s]+$/u;
    return emojiRegex.test(str.trim());
  };

  // Check if a label name is a custom emoji URL
  const isCustomEmojiUrl = (str: string): boolean => {
    return str.startsWith('/api/uploads/') || str.startsWith('http');
  };

  const handleDownloadFiles = async () => {
    setIsDownloadingFiles(true);
    try {
      const response = await axios.get(`${API_URL}/api/uploads/download-all`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from response headers or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'track-the-thing-files.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      showMessage('success', 'All uploaded files downloaded successfully!');
    } catch (error: any) {
      console.error('Download files failed:', error);
      if (error.response?.status === 404) {
        showMessage('error', 'No uploaded files found to download');
      } else {
        showMessage('error', 'Failed to download files');
      }
    } finally {
      setIsDownloadingFiles(false);
    }
  };

  const handleRestoreFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      showMessage('error', 'Please select a ZIP file');
      event.target.value = '';
      return;
    }

    setIsRestoringFiles(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/uploads/restore-files`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const stats = response.data.stats;
      showMessage('success', `Restored ${stats.restored} file(s), skipped ${stats.skipped} existing file(s)`);
    } catch (error: any) {
      console.error('Restore files failed:', error);
      showMessage('error', error.response?.data?.detail || 'Failed to restore files');
    } finally {
      setIsRestoringFiles(false);
      event.target.value = ''; // Reset file input
    }
  };

  const startFullRestore = () => {
    if (!jsonFile || !zipFile) {
      showMessage('error', 'Please select both JSON backup and ZIP files');
      return;
    }
    setShowFullRestoreConfirm(true);
  };

  const cancelFullRestore = () => {
    setShowFullRestoreConfirm(false);
  };

  const performFullRestore = async () => {
    if (!jsonFile || !zipFile) {
      setShowFullRestoreConfirm(false);
      showMessage('error', 'Please select both JSON backup and ZIP files');
      return;
    }

    setShowFullRestoreConfirm(false);
    setIsFullRestoring(true);
    const formData = new FormData();
    formData.append('backup_file', jsonFile);
    formData.append('files_archive', zipFile);

    try {
      const response = await axios.post(`${API_URL}/api/backup/full-restore`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const dataStats = response.data.data_restore;
      const filesStats = response.data.files_restore;
      showMessage('success', 
        `Full restore completed! ${dataStats.entries_imported} entries and ${filesStats.restored} files restored.`
      );
      
      // Clear file selections
      setJsonFile(null);
      setZipFile(null);
    } catch (error: any) {
      console.error('Full restore failed:', error);
      showMessage('error', error.response?.data?.detail || 'Failed to perform full restore');
    } finally {
      setIsFullRestoring(false);
    }
  };


  return (
    <div className="max-w-5xl mx-auto page-fade-in" style={{ position: 'relative', zIndex: 1 }}>
      <div 
        className="rounded-lg shadow-lg p-5" 
        style={{ backgroundColor: 'var(--color-bg-primary)', ...textureStyles }}
      >
        <div className="flex items-center gap-3 mb-5">
          <SettingsIcon className="h-8 w-8" style={{ color: 'var(--color-text-secondary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Settings</h1>
        </div>

        {message && (
          <div 
            className="mb-5 p-3 rounded-lg"
            style={{
              backgroundColor: message.type === 'success' 
                ? `${getComputedStyle(document.documentElement).getPropertyValue('--color-success')}20`
                : `${getComputedStyle(document.documentElement).getPropertyValue('--color-error')}20`,
              color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-error)'
            }}
          >
            {message.text}
          </div>
        )}

        {initialLoading ? (
          <SettingsSkeleton />
        ) : (
          <div className="animate-fade-in">
        {/* General Settings Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <SettingsIcon className="h-5 w-5" />
            General
          </h2>
          <div className="rounded-lg p-5" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {/* Display Toggles - Compact Grid */}
            <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)' }}>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>Display Options</h3>
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Toggle which dashboard widgets are visible</span>
              </div>
              <div className="space-y-2">
                {[
                  {
                    label: 'Daily Goals',
                    description: 'Show the per-day daily goal section',
                    value: showDailyGoals,
                    toggle: () => setShowDailyGoals(!showDailyGoals),
                  },
                  {
                    label: 'Day Labels',
                    description: 'Show day headers above each entry list',
                    value: showDayLabels,
                    toggle: () => setShowDayLabels(!showDayLabels),
                  },
                ].map(({ label, description, value, toggle }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border-primary)' }}
                  >
                    <div className="text-xs leading-tight">
                      <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</div>
                      <div style={{ color: 'var(--color-text-secondary)' }}>{description}</div>
                    </div>
                    <button
                      onClick={toggle}
                      className="relative inline-flex h-5 w-10 items-center rounded-full transition-colors"
                      style={{
                        backgroundColor: value ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-primary)',
                      }}
                    >
                      <span
                        className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm"
                        style={{
                          transform: value ? 'translateX(1.2rem)' : 'translateX(0.15rem)',
                        }}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Customization - Compact */}
            <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)' }}>
              <h3 className="font-medium mb-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>Customization</h3>
              <div className="space-y-2">
                {/* Daily Goal End Time */}
                <div className="flex items-center gap-2">
                  <label className="text-sm w-24 flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>Day Goal End Time</label>
                  <input
                    type="time"
                    value={dailyGoalEndTime}
                    onChange={(e) => handleDailyGoalEndTimeChange(e.target.value)}
                    className="px-2 py-1 rounded-md border text-sm"
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      borderColor: 'var(--color-border-primary)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                  {savingDailyGoalEndTime && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Saving...</span>}
                </div>
              </div>
            </div>

            {/* Emoji Library Selection */}
            <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)' }}>
              <h3 className="font-medium mb-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Emoji Picker
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setEmojiLibrary('emoji-picker-react')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    emojiLibrary === 'emoji-picker-react' ? 'font-medium' : ''
                  }`}
                  style={{
                    backgroundColor: emojiLibrary === 'emoji-picker-react' ? 'var(--color-accent)' : 'var(--color-bg-primary)',
                    color: emojiLibrary === 'emoji-picker-react' ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-primary)',
                  }}
                >
                  Emoji Picker React
                </button>
                <button
                  onClick={() => setEmojiLibrary('emoji-mart')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    emojiLibrary === 'emoji-mart' ? 'font-medium' : ''
                  }`}
                  style={{
                    backgroundColor: emojiLibrary === 'emoji-mart' ? 'var(--color-accent)' : 'var(--color-bg-primary)',
                    color: emojiLibrary === 'emoji-mart' ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-primary)',
                  }}
                >
                  Emoji Mart
                </button>
                <button
                  onClick={() => setShowEmojiManager(true)}
                  className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-text)',
                  }}
                >
                  Manage Custom
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Goals Management Section */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <Target className="h-5 w-5" />
              Goals
              {goals.length > 0 && (
                <span className="text-sm font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                  ({goals.length})
                </span>
              )}
            </h2>
            {/* Quick Add Button in Header */}
            {!showGoalForm && (
              <button
                onClick={() => {
                  setEditingGoal(null);
                  setShowGoalForm(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-accent-text)',
                }}
              >
                <Plus className="w-4 h-4" />
                Add Goal
              </button>
            )}
          </div>
          <div className="rounded-lg p-5" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {/* Inline Goal Form */}
            {showGoalForm && (
              <div className="mb-4">
                <GoalForm
                  goal={editingGoal}
                  onSave={editingGoal ? handleUpdateGoal : handleCreateGoal}
                  onClose={() => {
                    setShowGoalForm(false);
                    setEditingGoal(null);
                  }}
                  initialDate={new Date().toISOString().split('T')[0]}
                  inline={true}
                />
              </div>
            )}
            
            {/* Goals List */}
            {loadingGoals ? (
              <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
                Loading goals...
              </div>
            ) : goals.length === 0 && !showGoalForm ? (
              <div 
                className="text-center py-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors"
                style={{ 
                  color: 'var(--color-text-secondary)',
                  borderColor: 'var(--color-border-primary)',
                }}
                onClick={() => {
                  setEditingGoal(null);
                  setShowGoalForm(true);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Plus className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="font-medium">No goals yet</p>
                <p className="text-xs mt-1">Click here or the "Add Goal" button to create your first goal</p>
              </div>
            ) : goals.length > 0 ? (
              <div className="space-y-3">
                {goals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onToggleComplete={handleToggleGoalComplete}
                    onToggleVisibility={handleToggleGoalVisibility}
                    onEdit={handleEditGoal}
                    onDelete={handleDeleteGoal}
                    editable={true}
                    showVisibilityToggle={true}
                    showDeleteButton={true}
                    compact={false}
                  />
                ))}
                
                {/* Add Goal Card at Bottom - only show when form is closed */}
                {!showGoalForm && (
                  <div 
                    className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors"
                    style={{ 
                      borderColor: 'var(--color-border-primary)',
                    }}
                    onClick={() => {
                      setEditingGoal(null);
                      setShowGoalForm(true);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                      e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}10`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Plus className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      Add another goal
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>

        {/* AI Integration Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Sparkles className="h-5 w-5" />
            AI Integration
          </h2>
          <div className="rounded-lg p-5" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Configure AI providers for the "Send to LLM" feature in the editor. Your API keys are stored securely and never exposed in the browser.
            </p>

            {/* Provider Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Preferred Provider
              </label>
              <div className="flex gap-2">
                {(['openai', 'anthropic', 'gemini'] as LlmProvider[]).map((provider) => (
                  <button
                    key={provider}
                    onClick={() => setLlmProvider(provider)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize"
                    style={{
                      backgroundColor: llmProvider === provider ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                      color: llmProvider === provider ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-primary)',
                    }}
                  >
                    {provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Gemini'}
                  </button>
                ))}
              </div>
            </div>

            {/* OpenAI API Type Selection */}
            {llmProvider === 'openai' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  OpenAI API Format
                </label>
                <div className="flex gap-2">
                  {(['chat_completions', 'responses'] as OpenaiApiType[]).map((apiType) => (
                    <button
                      key={apiType}
                      onClick={() => setOpenaiApiType(apiType)}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: openaiApiType === apiType ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                        color: openaiApiType === apiType ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                        border: '1px solid var(--color-border-primary)',
                      }}
                    >
                      {apiType === 'chat_completions' ? 'Chat Completions' : 'Responses API'}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  {openaiApiType === 'chat_completions' 
                    ? 'Standard chat format (gpt-4o-mini)' 
                    : 'Newer Responses API format (gpt-4o-mini)'}
                </p>
              </div>
            )}

            {/* API Keys */}
            <div className="space-y-4 mb-4">
              {/* OpenAI */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  OpenAI API Key {openaiKeySet && <span className="text-green-500">✓ Configured</span>}
                </label>
                <input
                  type="password"
                  value={openaiKeyInput}
                  onChange={(e) => setOpenaiKeyInput(e.target.value)}
                  placeholder={openaiKeySet ? '••••••••••••••••' : 'sk-...'}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              {/* Anthropic */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Anthropic API Key {anthropicKeySet && <span className="text-green-500">✓ Configured</span>}
                </label>
                <input
                  type="password"
                  value={anthropicKeyInput}
                  onChange={(e) => setAnthropicKeyInput(e.target.value)}
                  placeholder={anthropicKeySet ? '••••••••••••••••' : 'sk-ant-...'}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              {/* Gemini */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Gemini API Key {geminiKeySet && <span className="text-green-500">✓ Configured</span>}
                </label>
                <input
                  type="password"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder={geminiKeySet ? '••••••••••••••••' : 'AIza...'}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Global Prompt */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Global Prompt Rules (Optional)
              </label>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                These instructions will be prepended to every prompt sent to the AI.
              </p>
              <textarea
                value={llmGlobalPrompt}
                onChange={(e) => setLlmGlobalPrompt(e.target.value)}
                placeholder="e.g., Always respond concisely. Use a professional tone."
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-primary)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveLlmSettings}
              disabled={savingLlmSettings}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-accent-text)',
                opacity: savingLlmSettings ? 0.5 : 1,
              }}
            >
              {savingLlmSettings ? 'Saving...' : 'Save AI Settings'}
            </button>
          </div>
        </section>

        {/* MCP Servers Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Server className="h-5 w-5" />
            MCP Servers
          </h2>
          <div className="rounded-lg p-5" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Configure MCP (Model Context Protocol) servers for AI processing. Supports Docker containers
              (HTTP or STDIO transport) and remote HTTP endpoints. Text selections matching routing patterns
              will be processed by MCP servers instead of cloud LLMs.
            </p>
            <McpServerManager onMessage={showMessage} />
          </div>
        </section>

        {/* Jupyter Notebooks Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <FileCode className="h-5 w-5" />
            Jupyter Notebooks
          </h2>
          <div className="rounded-lg p-5" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Enable Jupyter notebook cells in the rich text editor for inline Python code execution.
              Requires Docker to be running on your system.
            </p>

            {/* Docker Status Banner */}
            {jupyterSettings && !jupyterSettings.docker_available && (
              <div 
                className="mb-4 p-3 rounded-lg flex items-center gap-2"
                style={{
                  backgroundColor: `${getComputedStyle(document.documentElement).getPropertyValue('--color-warning')}15`,
                  border: '1px solid var(--color-warning)'
                }}
              >
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-warning)' }}>
                    Docker Not Available
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Install and start Docker Desktop to use Jupyter notebooks
                  </p>
                </div>
              </div>
            )}

            {/* Container Status Row - MCP style */}
            {jupyterStatus && jupyterSettings?.docker_available && (
              <div 
                className="mb-4 rounded-lg overflow-hidden"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-primary)',
                }}
              >
                <div className="p-3 flex items-center gap-3">
                  {/* Status dot */}
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ 
                      backgroundColor: jupyterStatus.container_running 
                        ? 'var(--color-success)' 
                        : 'var(--color-text-tertiary)'
                    }}
                  />
                
                  {/* Container info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {/* Jupyter color indicator - matches MCP server style */}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: jupyterStatus.container_running ? '#f97316' : '#64748b',
                          boxShadow: `0 0 4px ${jupyterStatus.container_running ? '#f97316' : '#64748b'}`,
                        }}
                        title="Jupyter Kernel Gateway"
                      />
                      <FileCode className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                    <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      Jupyter Kernel Gateway
                    </span>
                    <span
                      className="text-xs"
                      style={{
                        color: jupyterActionLoading === 'start' || jupyterActionLoading === 'stop'
                          ? 'var(--color-warning)'
                          : jupyterStatus.container_running 
                            ? 'var(--color-success)' 
                            : 'var(--color-text-tertiary)',
                      }}
                    >
                      {jupyterActionLoading === 'start' ? 'starting' : 
                       jupyterActionLoading === 'stop' ? 'stopping' :
                       jupyterStatus.container_running ? 'running' : 'stopped'}
                    </span>
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                    {jupyterStatus.kernel_id 
                      ? `Kernel: ${jupyterStatus.kernel_id.slice(0, 8)}... • Port 8888`
                      : 'jupyter/minimal-notebook:python-3.11 • Port 8888'}
                  </p>
                </div>

                {/* Action Buttons - icon only like MCP */}
                <div className="flex items-center gap-1">
                  {jupyterStatus.container_running ? (
                    <>
                      <button
                        onClick={handleJupyterStop}
                        disabled={jupyterActionLoading !== null}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ 
                          color: 'var(--color-text-secondary)',
                          opacity: jupyterActionLoading !== null ? 0.5 : 1,
                        }}
                        title="Stop"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleJupyterRestart}
                        disabled={jupyterActionLoading !== null}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ 
                          color: 'var(--color-text-secondary)',
                          opacity: jupyterActionLoading !== null ? 0.5 : 1,
                        }}
                        title="Restart Kernel"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleJupyterStart}
                      disabled={jupyterActionLoading !== null}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ 
                        color: 'var(--color-success)',
                        opacity: jupyterActionLoading !== null ? 0.5 : 1,
                      }}
                      title="Start"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Settings Toggles */}
            <div className="space-y-3">
              {/* Enable Jupyter */}
              <div 
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ 
                  backgroundColor: 'var(--color-bg-secondary)', 
                  border: '1px solid var(--color-border-primary)',
                  opacity: jupyterSettings?.docker_available ? 1 : 0.5,
                }}
              >
                <div>
                  <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    Enable Jupyter Integration
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Show notebook cell button in the editor toolbar
                  </p>
                </div>
                <button
                  onClick={() => handleJupyterToggle('jupyter_enabled')}
                  disabled={!jupyterSettings?.docker_available}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{
                    backgroundColor: jupyterSettings?.jupyter_enabled ? 'var(--color-accent)' : 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-primary)',
                    cursor: jupyterSettings?.docker_available ? 'pointer' : 'not-allowed',
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm"
                    style={{
                      transform: jupyterSettings?.jupyter_enabled ? 'translateX(1.4rem)' : 'translateX(0.2rem)',
                    }}
                  />
                </button>
              </div>

              {/* Auto-start Container */}
              <div 
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ 
                  backgroundColor: 'var(--color-bg-secondary)', 
                  border: '1px solid var(--color-border-primary)',
                  opacity: jupyterSettings?.docker_available && jupyterSettings?.jupyter_enabled ? 1 : 0.5,
                }}
              >
                <div>
                  <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    Auto-start Container
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Automatically start the Jupyter container when inserting a notebook cell
                  </p>
                </div>
                <button
                  onClick={() => handleJupyterToggle('jupyter_auto_start')}
                  disabled={!jupyterSettings?.docker_available || !jupyterSettings?.jupyter_enabled}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{
                    backgroundColor: jupyterSettings?.jupyter_auto_start ? 'var(--color-accent)' : 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-primary)',
                    cursor: (jupyterSettings?.docker_available && jupyterSettings?.jupyter_enabled) ? 'pointer' : 'not-allowed',
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm"
                    style={{
                      transform: jupyterSettings?.jupyter_auto_start ? 'translateX(1.4rem)' : 'translateX(0.2rem)',
                    }}
                  />
                </button>
              </div>

              {/* Python Version Selector */}
              <div 
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ 
                  backgroundColor: 'var(--color-bg-secondary)', 
                  border: '1px solid var(--color-border-primary)',
                  opacity: jupyterSettings?.docker_available && jupyterSettings?.jupyter_enabled ? 1 : 0.5,
                }}
              >
                <div>
                  <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    Python Version
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Requires container restart to take effect
                  </p>
                </div>
                <select
                  value={jupyterSettings?.jupyter_python_version || '3.11'}
                  onChange={(e) => handleJupyterVersionChange(e.target.value)}
                  disabled={!jupyterSettings?.docker_available || !jupyterSettings?.jupyter_enabled}
                  className="px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-primary)',
                    color: 'var(--color-text-primary)',
                    cursor: (jupyterSettings?.docker_available && jupyterSettings?.jupyter_enabled) ? 'pointer' : 'not-allowed',
                  }}
                >
                  <option value="3.9">Python 3.9</option>
                  <option value="3.10">Python 3.10</option>
                  <option value="3.11">Python 3.11</option>
                  <option value="3.12">Python 3.12</option>
                  <option value="custom">Custom Image...</option>
                </select>
              </div>

              {/* Custom Image Input - only shown when 'custom' is selected */}
              {jupyterSettings?.jupyter_python_version === 'custom' && (
                <div 
                  className="p-3 rounded-lg"
                  style={{ 
                    backgroundColor: 'var(--color-bg-secondary)', 
                    border: '1px solid var(--color-border-primary)',
                  }}
                >
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Custom Docker Image
                  </label>
                  <input
                    type="text"
                    value={jupyterSettings?.jupyter_custom_image || ''}
                    onChange={(e) => handleJupyterCustomImageChange(e.target.value)}
                    placeholder="e.g., python:3.11.5-slim or jupyter/scipy-notebook"
                    className="w-full px-3 py-1.5 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      border: '1px solid var(--color-border-primary)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    Use any Docker image (e.g., python:3.11.5, jupyter/scipy-notebook)
                  </p>
                </div>
              )}
            </div>

            {/* Info Footer */}
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--color-border-primary)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                💡 Insert notebook cells in the editor using the <FileCode className="inline h-3 w-3" /> button.
                Code is executed in an isolated Docker container with Python {jupyterSettings?.jupyter_python_version === 'custom' ? (jupyterSettings?.jupyter_custom_image || 'custom image') : jupyterSettings?.jupyter_python_version || '3.11'}.
              </p>
            </div>
          </div>
        </section>

        {/* Theme Selection Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Palette className="h-5 w-5" />
            Theme
          </h2>
          <div className="p-5 rounded-lg" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 max-h-[500px] overflow-y-auto pr-2 pt-2 pb-2">
              {/* Create Custom Theme Button */}
              <button
                onClick={handleOpenThemeCreator}
                className="group relative p-3 rounded-xl border-2 border-dashed transition-all duration-300 hover:scale-110 hover:-translate-y-1 hover:shadow-xl flex flex-col items-center justify-center min-h-[120px]"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  borderColor: 'var(--color-border-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                }}
              >
                <Plus className="h-8 w-8 mb-2" style={{ color: 'var(--color-text-secondary)' }} />
                <div className="text-sm font-semibold text-center" style={{ color: 'var(--color-text-secondary)' }}>
                  Create Custom
                </div>
              </button>

              {availableThemes.map((theme) => {
                const isModified = isThemeModified(theme.id);
                
                return (
                  <div key={theme.id} className="relative">
                    <button
                      onClick={() => setTheme(theme.id)}
                      className={`w-full group relative p-3 rounded-xl border-2 transition-all duration-300 hover:scale-110 hover:-translate-y-1 ${
                        currentTheme === theme.id
                          ? 'shadow-2xl ring-4'
                          : 'hover:shadow-xl'
                      }`}
                      style={{
                        backgroundColor: theme.colors.cardBg,
                        borderColor: currentTheme === theme.id ? theme.colors.accent : theme.colors.borderPrimary,
                        boxShadow: currentTheme === theme.id 
                          ? `0 20px 25px -5px ${theme.colors.cardShadow}, 0 10px 10px -5px ${theme.colors.cardShadow}`
                          : `0 4px 6px -1px ${theme.colors.cardShadow}`,
                      }}
                      title={theme.description}
                    >
                      {/* Theme preview colors */}
                      <div className="flex flex-col gap-1.5 mb-2">
                        <div className="flex gap-1">
                          <div 
                            className="h-4 w-4 rounded-full shadow-md transform group-hover:scale-110 transition-transform"
                            style={{ 
                              backgroundColor: theme.colors.accent,
                              boxShadow: `0 0 6px ${theme.colors.accent}80`
                            }}
                          />
                          <div 
                            className="h-4 w-4 rounded-full shadow-md transform group-hover:scale-110 transition-transform"
                            style={{ 
                              backgroundColor: theme.colors.success,
                              boxShadow: `0 0 6px ${theme.colors.success}80`
                            }}
                          />
                          <div 
                            className="h-4 w-4 rounded-full shadow-md transform group-hover:scale-110 transition-transform"
                            style={{ 
                              backgroundColor: theme.colors.warning,
                              boxShadow: `0 0 6px ${theme.colors.warning}80`
                            }}
                          />
                        </div>
                        <div 
                          className="h-8 rounded-lg shadow-inner"
                          style={{ 
                            backgroundColor: theme.colors.bgSecondary,
                            border: `2px solid ${theme.colors.borderPrimary}`,
                            backgroundImage: `linear-gradient(135deg, ${theme.colors.bgSecondary} 0%, ${theme.colors.bgTertiary} 100%)`
                          }}
                        />
                      </div>
                      
                      {/* Theme name */}
                      <div className="text-sm font-semibold text-center" style={{ color: theme.colors.textPrimary }}>
                        {theme.name}
                        {isModified && <span className="text-xs ml-1" style={{ color: theme.colors.warning }}>*</span>}
                      </div>
                      
                      {/* Selected indicator */}
                      {currentTheme === theme.id && (
                        <div 
                          className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center animate-pulse shadow-lg" 
                          style={{ 
                            backgroundColor: theme.colors.accent,
                            boxShadow: `0 0 20px ${theme.colors.accent}, 0 0 40px ${theme.colors.accent}80`
                          }}
                        >
                          <svg className="w-5 h-5" style={{ color: theme.colors.accentText }} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>

                    {/* Action buttons - only show on current theme */}
                    {currentTheme === theme.id && (
                      <div className="absolute -top-2 -left-2 flex gap-1">
                        {/* Edit button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTheme(theme);
                          }}
                          className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all"
                          style={{
                            backgroundColor: 'var(--color-accent)',
                            color: 'var(--color-accent-text)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          title="Edit theme"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>

                        {/* Restore button - only for modified built-in themes */}
                        {isModified && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreTheme(theme.id);
                            }}
                            className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all"
                            style={{
                              backgroundColor: 'var(--color-accent)',
                              color: 'var(--color-accent-text)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            title="Restore to default"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
          </div>
        </section>


        {/* Custom Background Images Section */}
        <CustomBackgroundSettings 
          onUpload={handleCustomBgImageUpload}
          onDelete={handleDeleteCustomBgImage}
          isUploading={isUploadingCustomBgImage}
        />

        {/* UI Textures Section */}
        <TextureSettings />

        {/* Label Management Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Tag className="h-5 w-5" />
            Labels
            {labels.length > 0 && (
              <span className="text-sm font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                ({labels.length})
              </span>
            )}
          </h2>
          <div className="rounded-lg p-5" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {/* Transparent Labels Toggle */}
            <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)' }}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    Transparent Backgrounds
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Show labels with transparent backgrounds (text remains colored)
                  </p>
                </div>
                <button
                  onClick={toggleTransparentLabels}
                  className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2`}
                  style={{
                    backgroundColor: transparentLabels ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                    borderColor: 'var(--color-border-primary)',
                    borderWidth: '1px'
                  }}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full transition-transform`}
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      transform: transparentLabels ? 'translateX(1.5rem)' : 'translateX(0.25rem)'
                    }}
                  />
                </button>
              </div>
            </div>

            <p className="mb-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Manage your labels. Deleting removes from all notes and entries.
            </p>

            {labels.length === 0 ? (
              <p className="text-center py-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>No labels created yet</p>
            ) : (
              <>
                {/* Search and Filter Controls */}
                <div className="mb-3 flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search labels..."
                      value={labelSearchQuery}
                      onChange={(e) => setLabelSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border-primary)'
                      }}
                    />
                  </div>
                  <div className="sm:w-40">
                    <select
                      value={labelSortBy}
                      onChange={(e) => setLabelSortBy(e.target.value as 'name' | 'usage')}
                      className="w-full px-3 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border-primary)'
                      }}
                    >
                      <option value="name">Sort by Name</option>
                      <option value="usage">Sort by Usage</option>
                    </select>
                  </div>
                </div>

                  {/* Results Count */}
                  {labelSearchQuery && (
                    <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Showing {filteredLabels.length} of {labels.length} labels
                    </p>
                  )}

                  {/* Labels Grid */}
                  {filteredLabels.length === 0 ? (
                    <p className="text-center py-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>No labels match your search</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 max-h-80 overflow-y-auto pr-2">
                    {filteredLabels.map((label) => {
                  const isEmoji = isEmojiOnly(label.name);
                  return (
                      <div
                        key={label.id}
                        className="flex items-center justify-between p-2 rounded-lg transition-all duration-200"
                        style={{
                          backgroundColor: 'var(--color-bg-primary)',
                          border: '1px solid var(--color-border-primary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                        }}
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {isCustomEmojiUrl(label.name) ? (
                            <img 
                              src={label.name.startsWith('http') ? label.name : `${API_URL}${label.name}`} 
                              alt="emoji" 
                              className="inline-emoji"
                              style={{ width: '1.5rem', height: '1.5rem' }}
                            />
                          ) : isEmoji ? (
                            <span className="text-xl">{label.name}</span>
                          ) : (
                            <>
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: label.color }}
                              />
                              <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }} title={label.name}>
                                {label.name}
                              </span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteLabel(label.id, label.name)}
                          disabled={deletingLabelId === label.id}
                          className="p-1.5 rounded transition-colors disabled:opacity-50 flex-shrink-0"
                          style={{ color: 'var(--color-text-tertiary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-error)';
                            e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-error')}15`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-tertiary)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title={`Delete label "${label.name}"`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                  );
                })}
              </div>
            )}
              </>
            )}
          </div>
        </section>

        {/* Backup & Restore Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Download className="h-5 w-5" />
            Backup & Restore
          </h2>
          
          {/* Info Banner */}
          <div 
            className="mb-3 p-3 rounded-lg"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-primary)'
            }}
          >
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>📦 Complete Migration</h3>
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              For full restore: <strong>JSON backup</strong> (notes/labels) + <strong>ZIP</strong> (images/attachments)
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              💡 Use "Full Restore" or restore individually
            </p>
          </div>

          {/* Full Restore Section */}
          <div 
            className="mb-3 rounded-lg p-4"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '2px solid var(--color-border-secondary)'
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div 
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}20` }}
              >
                <Upload className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
              </div>
              <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Full Restore (Recommended)</h3>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Upload both files to restore workspace
            </p>
            
            <div className="space-y-2 mb-3">
              {/* JSON File Selector */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>1. JSON Backup:</label>
                <label 
                  className="flex items-center gap-2 px-3 py-1.5 border-2 rounded-lg transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  }}
                >
                  <Download className="h-3.5 w-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                  <span className="text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {jsonFile ? jsonFile.name : 'Choose JSON...'}
                  </span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setJsonFile(e.target.files?.[0] || null)}
                    data-testid="full-restore-json-input"
                    className="hidden"
                  />
                </label>
              </div>
              
              {/* ZIP File Selector */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>2. Files (ZIP):</label>
                <label 
                  className="flex items-center gap-2 px-3 py-1.5 border-2 rounded-lg transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  }}
                >
                  <Archive className="h-3.5 w-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                  <span className="text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {zipFile ? zipFile.name : 'Choose ZIP...'}
                  </span>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                    data-testid="full-restore-zip-input"
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            
            <button
              onClick={startFullRestore}
              disabled={isFullRestoring || !jsonFile || !zipFile}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors font-medium disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-accent-text)',
                opacity: (isFullRestoring || !jsonFile || !zipFile) ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!isFullRestoring && jsonFile && zipFile) {
                  e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isFullRestoring && jsonFile && zipFile) {
                  e.currentTarget.style.backgroundColor = 'var(--color-accent)';
                }
              }}
            >
              <Upload className="h-5 w-5" />
              {isFullRestoring ? 'Restoring Everything...' : 'Restore Everything'}
            </button>
          </div>

          {/* Individual Actions Grid */}
          <div className="grid md:grid-cols-2 gap-3">
            {/* Export Card */}
            <div 
              className="rounded-lg p-4 transition-all"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}20` }}
                >
                  <Download className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Export Data</h3>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                Download notes, entries, and labels
              </p>
              
              {/* Format Selector */}
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Format:</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportFormat('json')}
                    className="flex-1 px-2 py-1.5 text-xs rounded-lg border transition-colors"
                    style={{
                      backgroundColor: exportFormat === 'json' ? 'var(--color-accent)' : 'var(--color-bg-primary)',
                      color: exportFormat === 'json' ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                      borderColor: exportFormat === 'json' ? 'var(--color-accent)' : 'var(--color-border-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (exportFormat !== 'json') {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (exportFormat !== 'json') {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                      }
                    }}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => setExportFormat('markdown')}
                    className="flex-1 px-2 py-1.5 text-xs rounded-lg border transition-colors"
                    style={{
                      backgroundColor: exportFormat === 'markdown' ? 'var(--color-accent)' : 'var(--color-bg-primary)',
                      color: exportFormat === 'markdown' ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                      borderColor: exportFormat === 'markdown' ? 'var(--color-accent)' : 'var(--color-border-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (exportFormat !== 'markdown') {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (exportFormat !== 'markdown') {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                      }
                    }}
                  >
                    Markdown
                  </button>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  {exportFormat === 'json' 
                    ? 'Full backup for restore' 
                    : 'For LLM analysis'}
                </p>
              </div>
              
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors font-medium disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-accent-text)',
                  opacity: isExporting ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isExporting) e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isExporting) e.currentTarget.style.backgroundColor = 'var(--color-accent)';
                }}
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export Data'}
              </button>
            </div>

            {/* Restore Card */}
            <div 
              className="rounded-lg p-4 transition-all"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-success)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}20` }}
                >
                  <Upload className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Restore Data Only</h3>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                Import JSON backup (without files)
              </p>
              
              <div 
                className="mb-3 p-2 rounded-lg"
                style={{
                  backgroundColor: `${getComputedStyle(document.documentElement).getPropertyValue('--color-info')}15`,
                  border: '1px solid var(--color-info)'
                }}
              >
                <p className="text-xs" style={{ color: 'var(--color-info)' }}>
                  <strong>✓</strong> Compatible with all Track the Thing JSON backups
                </p>
              </div>
              
              <label 
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors font-medium cursor-pointer"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-accent-text)',
                  opacity: isImporting ? 0.5 : 1,
                  cursor: isImporting ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!isImporting) e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  if (!isImporting) e.currentTarget.style.opacity = '1';
                }}
              >
                <Upload className="h-4 w-4" />
                {isImporting ? 'Restoring...' : 'Choose JSON File'}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFileSelect}
                  disabled={isImporting}
                  ref={importInputRef}
                  data-testid="json-import-input"
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Files Export & Restore */}
          <div 
            className="mt-3 rounded-lg p-3"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-primary)'
            }}
          >
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Attachments</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDownloadFiles}
                disabled={isDownloadingFiles}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors font-medium disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-accent-text)',
                  opacity: isDownloadingFiles ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isDownloadingFiles) e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  if (!isDownloadingFiles) e.currentTarget.style.opacity = '1';
                }}
              >
                <Archive className="h-3.5 w-3.5" />
                {isDownloadingFiles ? 'Downloading...' : 'Export ZIP'}
              </button>
              
              <label 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors font-medium cursor-pointer"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-accent-text)',
                  opacity: isRestoringFiles ? 0.5 : 1,
                  cursor: isRestoringFiles ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!isRestoringFiles) e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  if (!isRestoringFiles) e.currentTarget.style.opacity = '1';
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                {isRestoringFiles ? 'Restoring...' : 'Restore ZIP'}
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleRestoreFiles}
                  disabled={isRestoringFiles}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
              Export all files • Restore skips duplicates
            </p>
          </div>
        </section>

        {/* Timezone Section */}
        <section>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Clock className="h-5 w-5" />
            Timezone
          </h2>
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {!isEditingTimezone ? (
              // Compact display when not editing
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Current timezone:</p>
                  <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{timezone}</p>
                </div>
                <button
                  onClick={() => setIsEditingTimezone(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors"
                  style={{ color: 'var(--color-accent)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}15`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Change
                </button>
              </div>
            ) : (
              // Full timezone selector when editing
              <div>
            <div className="max-w-md">
                  <label htmlFor="timezone" className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Select Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  showMessage('success', `Timezone updated to ${e.target.value}`);
                      setIsEditingTimezone(false);
                    }}
                    className="w-full px-3 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-primary)'
                    }}
              >
                <optgroup label="US Timezones">
                  <option value="America/New_York">Eastern (New York)</option>
                  <option value="America/Chicago">Central (Chicago)</option>
                  <option value="America/Denver">Mountain (Denver)</option>
                  <option value="America/Phoenix">Mountain - No DST (Phoenix)</option>
                  <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
                  <option value="America/Anchorage">Alaska (Anchorage)</option>
                  <option value="Pacific/Honolulu">Hawaii (Honolulu)</option>
                </optgroup>
                <optgroup label="Canada">
                  <option value="America/Toronto">Eastern (Toronto)</option>
                  <option value="America/Winnipeg">Central (Winnipeg)</option>
                  <option value="America/Edmonton">Mountain (Edmonton)</option>
                  <option value="America/Vancouver">Pacific (Vancouver)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Paris (CET/CEST)</option>
                  <option value="Europe/Berlin">Berlin (CET/CEST)</option>
                  <option value="Europe/Rome">Rome (CET/CEST)</option>
                  <option value="Europe/Madrid">Madrid (CET/CEST)</option>
                  <option value="Europe/Moscow">Moscow (MSK)</option>
                </optgroup>
                <optgroup label="Asia">
                  <option value="Asia/Dubai">Dubai (GST)</option>
                  <option value="Asia/Kolkata">India (IST)</option>
                  <option value="Asia/Shanghai">China (CST)</option>
                  <option value="Asia/Tokyo">Japan (JST)</option>
                  <option value="Asia/Seoul">South Korea (KST)</option>
                  <option value="Asia/Singapore">Singapore (SGT)</option>
                  <option value="Asia/Hong_Kong">Hong Kong (HKT)</option>
                </optgroup>
                <optgroup label="Australia">
                  <option value="Australia/Sydney">Sydney (AEDT/AEST)</option>
                  <option value="Australia/Melbourne">Melbourne (AEDT/AEST)</option>
                  <option value="Australia/Perth">Perth (AWST)</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="UTC">UTC</option>
                </optgroup>
              </select>
                  
                  <div className="mt-2 flex gap-2">
              <button
                      onClick={() => setIsEditingTimezone(false)}
                      className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Cancel
              </button>
            </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Archive Section */}
        <section
          className="rounded-xl p-6"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-primary)',
          }}
        >
          <h2
            className="text-xl font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Archive className="w-5 h-5" />
            Archive
          </h2>
          
          {archivedLists.length === 0 && archivedCards.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No archived items. Items you archive will appear here.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => navigate('/archive?tab=lists')}
                className="rounded-lg p-4 text-center cursor-pointer transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: 'var(--color-background)',
                  border: '1px solid var(--color-border-primary)',
                }}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Columns className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
                  {archivedLists.length}
                </div>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Archived Lists
                </div>
              </div>
              <div
                onClick={() => navigate('/archive?tab=cards')}
                className="rounded-lg p-4 text-center cursor-pointer transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: 'var(--color-background)',
                  border: '1px solid var(--color-border-primary)',
                }}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <BookOpen className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
                  {archivedCards.length}
                </div>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Archived Cards
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Version Footer */}
        <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: 'var(--color-border-primary)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Track the Thing v{__APP_VERSION__}
          </p>
        </div>
          </div>
        )}
      </div>

      {/* Custom Theme Creator Modal */}
      {showThemeCreator && (
        <CustomThemeCreator
          editingTheme={editingTheme}
          onClose={handleCloseThemeCreator}
        />
      )}

      {/* Custom Emoji Manager Modal */}
      <CustomEmojiManager
        isOpen={showEmojiManager}
        onClose={() => setShowEmojiManager(false)}
      />
      <ConfirmationDialog
        isOpen={showImportConfirm && !!pendingImportFile}
        title="Import JSON Backup?"
        message="This will merge the selected backup into your current workspace. Existing days with the same date may be updated if you chose replace mode previously. Continue?"
        confirmLabel="Yes, import backup"
        cancelLabel="Cancel"
        onConfirm={performJsonImport}
        onCancel={cancelImportConfirmation}
      />
      <ConfirmationDialog
        isOpen={showFullRestoreConfirm}
        title="Run Full Restore?"
        message="This uploads the JSON backup and files archive, replacing matching records and files in the current environment. Make sure you have a fresh export before continuing."
        confirmLabel="Restore everything"
        cancelLabel="Cancel"
        onConfirm={performFullRestore}
        onCancel={cancelFullRestore}
      />
    </div>
  );
};

export default Settings;
