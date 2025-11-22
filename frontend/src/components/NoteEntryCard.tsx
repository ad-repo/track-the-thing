import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Clock, FileText, Star, Check, Copy, CheckCheck, ArrowRight, ArrowUp, FileDown, Pin, Trello, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import axios from 'axios';
import TurndownService from 'turndown';
import type { NoteEntry, List, Reminder } from '../types';
import RichTextEditor from './RichTextEditor';
import CodeEditor from './CodeEditor';
import LabelSelector from './LabelSelector';
import EntryListSelector from './EntryListSelector';
import ReminderModal from './ReminderModal';
import { useTimezone } from '../contexts/TimezoneContext';
import { formatTimestamp } from '../utils/timezone';
import { kanbanApi, listsApi, remindersApi } from '../api';
import { useTexture } from '../hooks/useTexture';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Jira Icon Component
const JiraIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0z"/>
  </svg>
);

interface NoteEntryCardProps {
  entry: NoteEntry;
  onUpdate: (id: number, content: string) => void;
  onDelete: (id: number) => void;
  onLabelsUpdate: (entryId: number, labels: any[]) => void;
  onListsUpdate?: () => void;
  onMoveToTop?: (id: number) => void;
  isSelected?: boolean;
  onSelectionChange?: (id: number, selected: boolean) => void;
  selectionMode?: boolean;
  currentDate?: string; // YYYY-MM-DD format
}

const NoteEntryCard = ({ entry, onUpdate, onDelete, onLabelsUpdate, onListsUpdate, onMoveToTop, isSelected = false, onSelectionChange, selectionMode = false, currentDate }: NoteEntryCardProps) => {
  const { timezone } = useTimezone();
  const navigate = useNavigate();
  const textureStyles = useTexture('cards');
  const [title, setTitle] = useState(entry.title || '');
  const [content, setContent] = useState(entry.content);
  const [isSaving, setIsSaving] = useState(false);
  const [includeInReport, setIncludeInReport] = useState(entry.include_in_report || false);
  const [isImportant, setIsImportant] = useState(entry.is_important || false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [isCompleted, setIsCompleted] = useState(entry.is_completed || false);
  const [isPinned, setIsPinned] = useState(entry.is_pinned || false);
  const [copied, setCopied] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [copiedJira, setCopiedJira] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [showKanbanModal, setShowKanbanModal] = useState(false);
  const [kanbanColumns, setKanbanColumns] = useState<List[]>([]);
  const [isChangingKanban, setIsChangingKanban] = useState(false);
  const [kanbanButtonRef, setKanbanButtonRef] = useState<HTMLButtonElement | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [entryReminder, setEntryReminder] = useState<Reminder | null>(entry.reminder || null);
  const isCodeEntry = entry.content_type === 'code';
  const today = format(new Date(), 'yyyy-MM-dd');
  const isFromPastDay = currentDate && currentDate !== today;

  // Sync state with entry prop changes
  useEffect(() => {
    setTitle(entry.title || '');
    setContent(entry.content);
    setIncludeInReport(entry.include_in_report || false);
    setIsImportant(entry.is_important || false);
    setIsCompleted(entry.is_completed || false);
    setIsPinned(entry.is_pinned || false);
    setEntryReminder(entry.reminder || null);
  }, [entry]);

  // Load Kanban columns when modal opens
  useEffect(() => {
    if (showKanbanModal) {
      loadKanbanColumns();
    }
  }, [showKanbanModal]);

  // Close modal when clicking outside
  useEffect(() => {
    if (!showKanbanModal) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.kanban-status-dropdown') && !target.closest('.kanban-status-button')) {
        setShowKanbanModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showKanbanModal]);

  const loadKanbanColumns = async () => {
    try {
      const boards = await kanbanApi.getBoards();
      setKanbanColumns(boards);
    } catch (error) {
      console.error('Failed to load Kanban columns:', error);
    }
  };

  const handleKanbanStatusClick = () => {
    setShowKanbanModal(true);
  };

  const handleChangeKanbanStatus = async (newColumnId: number) => {
    setIsChangingKanban(true);
    try {
      // Save scroll position BEFORE any state changes
      const scrollY = window.scrollY;
      
      // Get current Kanban columns this entry is in
      const currentKanbanLists = entry.lists?.filter(list => list.is_kanban) || [];
      
      // Remove from all current Kanban columns
      for (const kanbanList of currentKanbanLists) {
        await listsApi.removeEntry(kanbanList.id, entry.id);
      }
      
      // Add to new Kanban column
      await listsApi.addEntry(newColumnId, entry.id, 0);
      
      // Close dropdown
      setShowKanbanModal(false);
      
      // Trigger parent refresh if provided
      if (onListsUpdate) {
        onListsUpdate();
        // Restore scroll immediately after calling update
        window.scrollTo(0, scrollY);
        // And again after a brief delay to catch any async renders
        setTimeout(() => window.scrollTo(0, scrollY), 0);
        setTimeout(() => window.scrollTo(0, scrollY), 50);
        setTimeout(() => window.scrollTo(0, scrollY), 100);
      }
      
    } catch (error) {
      console.error('Failed to change Kanban status:', error);
      setShowKanbanModal(false);
    } finally {
      setIsChangingKanban(false);
    }
  };

  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    setIsSaving(true);

    // Debounce the save
    const timeoutId = setTimeout(async () => {
      try {
        await axios.patch(`${API_URL}/api/entries/${entry.id}`, {
          title: newTitle
        });
        setIsSaving(false);
      } catch (error) {
        console.error('Failed to update title:', error);
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  };

  const handleContentChange = async (newContent: string) => {
    setContent(newContent);
    setIsSaving(true);

    // Debounce the save
    const timeoutId = setTimeout(async () => {
      await onUpdate(entry.id, newContent);
      setIsSaving(false);
    }, 1000);

    return () => clearTimeout(timeoutId);
  };

  const handleDelete = () => {
    setDeleteConfirmation(true);
  };

  const confirmDelete = () => {
    onDelete(entry.id);
    setDeleteConfirmation(false);
  };

  const cancelDelete = () => {
    setDeleteConfirmation(false);
  };

  const handleReportToggle = async () => {
    const newValue = !includeInReport;
    setIncludeInReport(newValue);
    
    try {
      await axios.patch(`${API_URL}/api/entries/${entry.id}`, {
        include_in_report: newValue
      });
    } catch (error) {
      console.error('Failed to update report status:', error);
      setIncludeInReport(!newValue); // Revert on error
    }
  };

  const handleImportantToggle = async () => {
    const newValue = !isImportant;
    setIsImportant(newValue);
    
    try {
      await axios.patch(`${API_URL}/api/entries/${entry.id}`, {
        is_important: newValue
      });
    } catch (error) {
      console.error('Failed to update important status:', error);
      setIsImportant(!newValue); // Revert on error
    }
  };

  const handleCompletedToggle = async () => {
    const newValue = !isCompleted;
    setIsCompleted(newValue);
    
    try {
      await axios.patch(`${API_URL}/api/entries/${entry.id}`, {
        is_completed: newValue
      });
    } catch (error) {
      console.error('Failed to update completed status:', error);
      setIsCompleted(!newValue); // Revert on error
    }
  };

  const handlePinToggle = async () => {
    const newValue = !isPinned;
    setIsPinned(newValue);
    
    try {
      await axios.post(`${API_URL}/api/entries/${entry.id}/toggle-pin`);
      // Don't refresh - the local state update is sufficient
      // The change is persisted to the backend and will be reflected on next page load
    } catch (error) {
      console.error('Failed to toggle pin status:', error);
      setIsPinned(!newValue); // Revert on error
    }
  };

  const handleReminderClick = () => {
    setShowReminderModal(true);
  };

  const handleReminderSuccess = async () => {
    // Reload reminder after save/delete
    try {
      const reminder = await remindersApi.getForEntry(entry.id);
      setEntryReminder(reminder);
    } catch (error: any) {
      // If 404, reminder was deleted/dismissed - clear it
      if (error.response?.status === 404 || error.response?.status === 400) {
        setEntryReminder(null);
      } else {
        console.error('Failed to reload reminder:', error);
        setEntryReminder(null); // Clear on any error to be safe
      }
    }
  };

  const handleCopy = async () => {
    try {
      let textToCopy = content;
      let htmlToCopy = content;
      
      // For rich text entries, prepare both plain text and HTML versions
      if (!isCodeEntry) {
        const tmp = document.createElement('div');
        tmp.innerHTML = content;
        textToCopy = tmp.textContent || tmp.innerText || '';
        htmlToCopy = content;
      }
      
      // Use the modern clipboard API to write both text and HTML
      if (navigator.clipboard && window.ClipboardItem) {
        const blob = new Blob([htmlToCopy], { type: 'text/html' });
        const textBlob = new Blob([textToCopy], { type: 'text/plain' });
        const clipboardItem = new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob
        });
        await navigator.clipboard.write([clipboardItem]);
      } else {
        // Fallback to plain text only
        await navigator.clipboard.writeText(textToCopy);
      }
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      let markdownContent = '';
      
      // Add title if present
      if (title) {
        markdownContent += `# ${title}\n\n`;
      }
      
      // Convert content to markdown
      if (isCodeEntry) {
        // Code entries: wrap in code block
        markdownContent += '```\n' + content + '\n```';
      } else {
        // Rich text: use turndown for high-quality HTML to Markdown conversion
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          bulletListMarker: '-',
          emDelimiter: '*',
          strongDelimiter: '**',
        });
        markdownContent += turndownService.turndown(content);
      }
      
      await navigator.clipboard.writeText(markdownContent);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch (error) {
      console.error('Failed to copy markdown:', error);
      alert('Failed to copy markdown to clipboard');
    }
  };

  const convertHtmlToJira = (html: string): string => {
    // Convert various HTML elements to Jira markup
    let jira = html;
    
    // Headings: h1-h6 -> h1. to h6.
    jira = jira.replace(/<h1[^>]*>(.*?)<\/h1>/gi, 'h1. $1\n\n');
    jira = jira.replace(/<h2[^>]*>(.*?)<\/h2>/gi, 'h2. $1\n\n');
    jira = jira.replace(/<h3[^>]*>(.*?)<\/h3>/gi, 'h3. $1\n\n');
    jira = jira.replace(/<h4[^>]*>(.*?)<\/h4>/gi, 'h4. $1\n\n');
    jira = jira.replace(/<h5[^>]*>(.*?)<\/h5>/gi, 'h5. $1\n\n');
    jira = jira.replace(/<h6[^>]*>(.*?)<\/h6>/gi, 'h6. $1\n\n');
    
    // Bold: <strong> or <b> -> *text*
    jira = jira.replace(/<(?:strong|b)[^>]*>(.*?)<\/(?:strong|b)>/gi, '*$1*');
    
    // Italic: <em> or <i> -> _text_
    jira = jira.replace(/<(?:em|i)[^>]*>(.*?)<\/(?:em|i)>/gi, '_$1_');
    
    // Strikethrough: <s> or <del> -> -text-
    jira = jira.replace(/<(?:s|del|strike)[^>]*>(.*?)<\/(?:s|del|strike)>/gi, '-$1-');
    
    // Underline: <u> -> +text+
    jira = jira.replace(/<u[^>]*>(.*?)<\/u>/gi, '+$1+');
    
    // Code inline: <code> -> {{text}}
    jira = jira.replace(/<code[^>]*>(.*?)<\/code>/gi, '{{$1}}');
    
    // Pre/Code blocks: <pre> -> {code}text{code}
    jira = jira.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '{code}\n$1\n{code}\n\n');
    
    // Links: <a href="url">text</a> -> [text|url]
    jira = jira.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2|$1]');
    
    // Images: <img src="url" alt="text"> -> !url|alt=text!
    jira = jira.replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '!$1|alt=$2!');
    jira = jira.replace(/<img[^>]*src=["']([^"']*)["'][^>]*\/?>/gi, '!$1!');
    
    // Unordered lists: <ul><li> -> * item
    jira = jira.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '* $1\n');
    });
    
    // Ordered lists: <ol><li> -> # item
    jira = jira.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '# $1\n');
    });
    
    // Blockquotes: <blockquote> -> {quote}text{quote}
    jira = jira.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '{quote}\n$1\n{quote}\n\n');
    
    // Line breaks: <br> -> \n
    jira = jira.replace(/<br\s*\/?>/gi, '\n');
    
    // Paragraphs: <p> -> text\n\n
    jira = jira.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');
    
    // Remove remaining HTML tags
    jira = jira.replace(/<[^>]+>/g, '');
    
    // Decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = jira;
    jira = textarea.value;
    
    // Clean up excessive whitespace
    jira = jira.replace(/\n{3,}/g, '\n\n');
    jira = jira.trim();
    
    return jira;
  };

  const handleCopyJira = async () => {
    try {
      let jiraContent = '';
      
      // Add title if present
      if (title) {
        jiraContent += `h1. ${title}\n\n`;
      }
      
      // Convert content to Jira format
      if (isCodeEntry) {
        jiraContent += '{code}\n' + content + '\n{code}';
      } else {
        jiraContent += convertHtmlToJira(content);
      }
      
      await navigator.clipboard.writeText(jiraContent);
      setCopiedJira(true);
      setTimeout(() => setCopiedJira(false), 2000);
    } catch (error) {
      console.error('Failed to copy Jira format:', error);
      alert('Failed to copy Jira format to clipboard');
    }
  };

  const handleContinueToday = async () => {
    setIsContinuing(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Create new entry on today's date with same content and type
      const response = await axios.post(`${API_URL}/api/entries/note/${today}`, {
        title: title,
        content: content,
        content_type: entry.content_type,
        order_index: 0,
        include_in_report: false,
        is_important: false,
        is_completed: false
      });

      // Copy labels to the new entry if any exist
      if (entry.labels && entry.labels.length > 0) {
        for (const label of entry.labels) {
          await axios.post(`${API_URL}/api/labels/entry/${response.data.id}/label/${label.id}`);
        }
      }

      // Navigate to today
      navigate(`/day/${today}`);
    } catch (error) {
      console.error('Failed to continue entry to today:', error);
      alert('Failed to copy entry to today');
    } finally {
      setIsContinuing(false);
    }
  };

  const handleMoveToTop = async () => {
    setIsMoving(true);
    try {
      await axios.post(`${API_URL}/api/entries/${entry.id}/move-to-top`);
      
      // Call the parent's callback to refresh the list
      if (onMoveToTop) {
        onMoveToTop(entry.id);
      }
    } catch (error) {
      console.error('Failed to move entry to top:', error);
      alert('Failed to move entry to top');
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div 
      className={`rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl ${isSelected ? 'ring-2' : ''} relative`}
      style={{
        ...textureStyles,
        backgroundColor: 'var(--color-card-bg)',
        borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-card-border)',
        boxShadow: isSelected ? '0 0 0 2px var(--color-accent)' : undefined
      }}
    >
      {/* Saving Indicator - Fixed Position */}
      {isSaving && (
        <div className="absolute top-3 right-3 z-10 px-3 py-1 rounded-full text-xs font-medium shadow-md animate-pulse"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'white',
          }}
        >
          Saving...
        </div>
      )}
      
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {selectionMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelectionChange?.(entry.id, e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            )}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
                <Clock className="h-4 w-4" />
                <span>
                  {formatTimestamp(entry.created_at, timezone, 'h:mm a zzz')}
                </span>
              </div>
              
              {/* Kanban State Badge - show if entry is in any Kanban list */}
              {entry.lists && entry.lists.filter(list => list.is_kanban).map(kanbanList => (
                <div key={kanbanList.id} className="relative">
                  <button
                    ref={setKanbanButtonRef}
                    onClick={handleKanbanStatusClick}
                    className="kanban-status-button px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all hover:scale-105 hover:shadow-md cursor-pointer inline-flex items-center gap-1.5"
                    style={{
                      backgroundColor: kanbanList.color,
                      color: '#ffffff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }}
                    title="Click to change Kanban status"
                  >
                    <Trello className="w-3 h-3" />
                    {kanbanList.name}
                  </button>

                  {/* Kanban Status Dropdown */}
                  {showKanbanModal && (
                    <div
                      className="kanban-status-dropdown absolute top-full left-0 mt-1 z-50 rounded-lg shadow-xl border-2 min-w-[200px]"
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        borderColor: 'var(--color-border-primary)',
                      }}
                    >
                      <div className="p-2 max-h-80 overflow-y-auto">
                        {kanbanColumns.map((column) => (
                          <button
                            key={column.id}
                            onClick={() => handleChangeKanbanStatus(column.id)}
                            disabled={isChangingKanban}
                            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            style={{
                              backgroundColor: column.color + '20',
                              color: column.color,
                              border: `1px solid ${column.color}`,
                              marginBottom: '0.25rem',
                            }}
                          >
                            {isChangingKanban ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trello className="w-4 h-4" />
                            )}
                            {column.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReportToggle}
              className="p-2 rounded transition-colors"
              style={{ color: includeInReport ? 'var(--color-info)' : 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = includeInReport ? 'transparent' : 'rgba(59, 130, 246, 0.1)';
                if (!includeInReport) e.currentTarget.style.color = 'var(--color-info)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                if (!includeInReport) e.currentTarget.style.color = 'var(--color-text-tertiary)';
              }}
              title={includeInReport ? "Remove from report" : "Add to report"}
            >
              <FileText className="h-5 w-5" />
            </button>
            
            <button
              onClick={handleCompletedToggle}
              className={`p-2 rounded transition-colors ${isCompleted ? 'completed-active' : ''}`}
              style={{ 
                color: isCompleted ? 'var(--color-success)' : 'var(--color-text-tertiary)',
                backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
              }}
              title={isCompleted ? "Mark as not completed" : "Mark as completed"}
            >
              <Check className={`h-5 w-5 ${isCompleted ? 'stroke-[3]' : ''}`} />
            </button>
            
            <button
              onClick={handleImportantToggle}
              className="p-2 rounded transition-colors"
              style={{ color: isImportant ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isImportant ? 'transparent' : 'rgba(245, 158, 11, 0.1)';
                if (!isImportant) e.currentTarget.style.color = 'var(--color-warning)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                if (!isImportant) e.currentTarget.style.color = 'var(--color-text-tertiary)';
              }}
              title={isImportant ? "Mark as not important" : "Mark as important"}
            >
              <Star className={`h-5 w-5 ${isImportant ? 'fill-current' : ''}`} />
            </button>
            
            <button
              onClick={handlePinToggle}
              className="p-2 rounded transition-colors"
              style={{ 
                color: isPinned ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                backgroundColor: isPinned ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!isPinned) {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.color = 'var(--color-accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isPinned) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }
              }}
              title={isPinned ? "Unpin (stop copying to future days)" : "Pin (copy to future days)"}
            >
              <Pin className={`h-5 w-5 ${isPinned ? 'fill-current' : ''}`} />
            </button>
            
            <button
              onClick={handleReminderClick}
              className="p-2 rounded transition-colors"
              style={{ 
                color: entryReminder ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                backgroundColor: entryReminder ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!entryReminder) {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.color = 'var(--color-accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (!entryReminder) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }
              }}
              title={entryReminder ? "Edit reminder" : "Set reminder"}
            >
              <Bell className={`h-5 w-5 ${entryReminder ? 'fill-current' : ''}`} />
            </button>
            
            <button
              onClick={handleCopy}
              className="p-2 rounded transition-colors"
              style={{ color: copied ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                if (!copied) {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.color = 'var(--color-accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (!copied) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }
              }}
              title={copied ? "Copied!" : "Copy content"}
            >
              {copied ? (
                <CheckCheck className="h-5 w-5" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </button>
            
            <button
              onClick={handleCopyMarkdown}
              className="p-2 rounded transition-colors"
              style={{ color: copiedMarkdown ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                if (!copiedMarkdown) {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.color = 'var(--color-accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (!copiedMarkdown) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }
              }}
              title={copiedMarkdown ? "Copied as Markdown!" : "Copy as Markdown"}
            >
              {copiedMarkdown ? <CheckCheck className="h-5 w-5" /> : <FileDown className="h-5 w-5" />}
            </button>
            
            <button
              onClick={handleCopyJira}
              className="p-2 rounded transition-colors"
              style={{ color: copiedJira ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                if (!copiedJira) {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.color = 'var(--color-accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (!copiedJira) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }
              }}
              title={copiedJira ? "Copied as Jira!" : "Copy as Jira/Confluence"}
            >
              {copiedJira ? <CheckCheck className="h-5 w-5" /> : <JiraIcon className="h-5 w-5" />}
            </button>
            
            {isFromPastDay && (
              <button
                onClick={handleContinueToday}
                disabled={isContinuing}
                className="p-2 rounded transition-colors"
                style={{ color: isContinuing ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => {
                  if (!isContinuing) {
                    e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                    e.currentTarget.style.color = 'var(--color-success)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isContinuing) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-tertiary)';
                  }
                }}
                title={isContinuing ? "Copying to today..." : "Continue on today"}
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
            
            <button
              onClick={handleMoveToTop}
              disabled={isMoving}
              className="p-2 rounded transition-colors"
              style={{ color: isMoving ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                if (!isMoving) {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.color = 'var(--color-accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isMoving) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }
              }}
              title={isMoving ? "Moving to top..." : "Move to top"}
            >
              <ArrowUp className="h-5 w-5" />
            </button>
            
            <button
              onClick={handleDelete}
              className="p-2 rounded transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-error)';
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-tertiary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Delete entry"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Title Input */}
        <div className="mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Add a title to the thing"
            className="w-full text-xl font-semibold border-none focus:outline-none focus:ring-0 px-0"
            style={{ 
              backgroundColor: 'transparent',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Entry Labels */}
        <div className="mb-4 pb-4" style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
          <LabelSelector
            entryId={entry.id}
            selectedLabels={entry.labels || []}
            onLabelsChange={() => {}}
            onOptimisticUpdate={(labels) => onLabelsUpdate(entry.id, labels)}
          />
        </div>

        {/* Entry Lists */}
        <div className="mb-4 pb-4" style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
          <EntryListSelector
            entryId={entry.id}
            currentLists={(entry.lists || []).filter(list => !list.is_kanban)}
            onUpdate={() => {
              if (onListsUpdate) {
                onListsUpdate();
              }
            }}
          />
        </div>

        {isCodeEntry ? (
          <CodeEditor
            content={content}
            onChange={handleContentChange}
          />
        ) : (
          <RichTextEditor
            content={content}
            onChange={handleContentChange}
            placeholder="Add content..."
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
          onClick={cancelDelete}
        >
          <div
            className="rounded-xl shadow-2xl p-6 w-full max-w-md"
            style={{
              backgroundColor: 'var(--color-card-bg)',
              border: '1px solid var(--color-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="text-2xl font-bold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Delete Card?
            </h2>
            
            <p
              className="mb-6 text-base"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Are you sure you want to delete <strong style={{ color: 'var(--color-text-primary)' }}>"{title || 'this card'}"</strong>?
              <br />
              <br />
              This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg"
                style={{
                  backgroundColor: 'var(--color-error)',
                  color: 'white',
                }}
              >
                Delete Card
              </button>
              <button
                onClick={cancelDelete}
                className="px-6 py-3 rounded-lg font-semibold transition-all hover:bg-opacity-80 border-2"
                style={{
                  backgroundColor: 'var(--color-background)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <ReminderModal
          entry={entry}
          existingReminder={entryReminder}
          onClose={() => setShowReminderModal(false)}
          onSuccess={handleReminderSuccess}
        />
      )}
    </div>
  );
};

export default NoteEntryCard;

