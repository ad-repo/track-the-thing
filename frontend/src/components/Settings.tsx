import { useState, useEffect, useMemo, useRef } from 'react';
import { Download, Upload, Settings as SettingsIcon, Clock, Archive, Tag, Trash2, Edit2, Palette, Plus, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { useTimezone } from '../contexts/TimezoneContext';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { useCustomBackground } from '../contexts/CustomBackgroundContext';
import { useTransparentLabels } from '../contexts/TransparentLabelsContext';
import { useDailyGoals } from '../contexts/DailyGoalsContext';
import { useSprintGoals } from '../contexts/SprintGoalsContext';
import { useQuarterlyGoals } from '../contexts/QuarterlyGoalsContext';
import { useDayLabels } from '../contexts/DayLabelsContext';
import { useEmojiLibrary } from '../contexts/EmojiLibraryContext';
import { useSprintName } from '../contexts/SprintNameContext';
import CustomThemeCreator from './CustomThemeCreator';
import CustomBackgroundSettings from './CustomBackgroundSettings';
import CustomEmojiManager from './CustomEmojiManager';
import TextureSettings from './TextureSettings';
import { useTexture } from '../hooks/useTexture';

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

const Settings = () => {
  const textureStyles = useTexture('settings');
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
  const { showSprintGoals, setShowSprintGoals } = useSprintGoals();
  const { showQuarterlyGoals, setShowQuarterlyGoals } = useQuarterlyGoals();
  const { showDayLabels, setShowDayLabels } = useDayLabels();
  const { emojiLibrary, setEmojiLibrary } = useEmojiLibrary();
  const { setSprintName: setSprintNameContext } = useSprintName();
  
  const [labels, setLabels] = useState<Label[]>([]);
  const [showEmojiManager, setShowEmojiManager] = useState(false);
  const [deletingLabelId, setDeletingLabelId] = useState<number | null>(null);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');
  const [sprintName, setSprintName] = useState('Sprint');
  const [savingSprintName, setSavingSprintName] = useState(false);
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

  useEffect(() => {
    loadLabels();
    loadSprintName();
  }, []);

  const loadSprintName = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings`);
      setSprintName(response.data.sprint_name || 'Sprint');
      setDailyGoalEndTime(response.data.daily_goal_end_time || '17:00');
    } catch (error) {
      console.error('Error loading sprint name:', error);
    }
  };

  const handleSprintNameChange = async (newName: string) => {
    setSprintName(newName);
    setSprintNameContext(newName); // Update context immediately for other components
    setSavingSprintName(true);
    try {
      await axios.patch(`${API_URL}/api/settings`, { sprint_name: newName });
    } catch (error) {
      console.error('Error saving sprint name:', error);
    } finally {
      setSavingSprintName(false);
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


  console.log('[Settings] Rendering. textureStyles:', textureStyles);
  
  return (
    <div className="max-w-5xl mx-auto page-fade-in" style={{ position: 'relative', zIndex: 1 }}>
      <div 
        className="rounded-lg shadow-lg p-5" 
        style={{ backgroundColor: 'var(--color-bg-primary)', ...textureStyles }}
        ref={(el) => {
          if (el) {
            console.log('[Settings] Actual DOM styles:', {
              backgroundImage: el.style.backgroundImage,
              backgroundSize: el.style.backgroundSize,
              backgroundRepeat: el.style.backgroundRepeat,
              backgroundBlendMode: el.style.backgroundBlendMode,
            });
          }
        }}
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

        {/* General Settings Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <SettingsIcon className="h-5 w-5" />
            General
          </h2>
          <div className="rounded-lg p-5" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {/* Display Toggles - Compact Grid */}
            <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)' }}>
              <h3 className="font-medium mb-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>Display Options</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {/* Show Daily Goals */}
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Daily Goals</span>
                  <button
                    onClick={() => setShowDailyGoals(!showDailyGoals)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                    style={{
                      backgroundColor: showDailyGoals ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                      borderColor: 'var(--color-border-primary)',
                      borderWidth: '1px'
                    }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-transform`}
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        transform: showDailyGoals ? 'translateX(1.5rem)' : 'translateX(0.25rem)'
                      }}
                    />
                  </button>
                </div>

                {/* Show Sprint Goals */}
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Sprint Goals</span>
                  <button
                    onClick={() => setShowSprintGoals(!showSprintGoals)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                    style={{
                      backgroundColor: showSprintGoals ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                      borderColor: 'var(--color-border-primary)',
                      borderWidth: '1px'
                    }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-transform`}
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        transform: showSprintGoals ? 'translateX(1.5rem)' : 'translateX(0.25rem)'
                      }}
                    />
                  </button>
                </div>

                {/* Show Quarterly Goals */}
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Quarterly Goals</span>
                  <button
                    onClick={() => setShowQuarterlyGoals(!showQuarterlyGoals)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                    style={{
                      backgroundColor: showQuarterlyGoals ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                      borderColor: 'var(--color-border-primary)',
                      borderWidth: '1px'
                    }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-transform`}
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        transform: showQuarterlyGoals ? 'translateX(1.5rem)' : 'translateX(0.25rem)'
                      }}
                    />
                  </button>
                </div>

                {/* Show Day Labels */}
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Day Labels</span>
                  <button
                    onClick={() => setShowDayLabels(!showDayLabels)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                    style={{
                      backgroundColor: showDayLabels ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                      borderColor: 'var(--color-border-primary)',
                      borderWidth: '1px'
                    }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-transform`}
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        transform: showDayLabels ? 'translateX(1.5rem)' : 'translateX(0.25rem)'
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Customization - Compact */}
            <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)' }}>
              <h3 className="font-medium mb-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>Customization</h3>
              <div className="space-y-2">
                {/* Sprint Name */}
                <div className="flex items-center gap-2">
                  <label className="text-sm w-24 flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>Sprint Name</label>
                  <input
                    type="text"
                    value={sprintName}
                    onChange={(e) => handleSprintNameChange(e.target.value)}
                    placeholder="Sprint"
                    className="flex-1 px-2 py-1 rounded-md border text-sm"
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      borderColor: 'var(--color-border-primary)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                  {savingSprintName && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Saving...</span>}
                </div>

                {/* Daily Goal End Time */}
                <div className="flex items-center gap-2">
                  <label className="text-sm w-24 flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>Goal End</label>
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
                  <strong>✓</strong> v1.0-v4.0 backups
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
