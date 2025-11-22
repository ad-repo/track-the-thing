import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { format, parse, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, CheckSquare, Combine } from 'lucide-react';
import api, { notesApi, entriesApi, goalsApi, settingsApi } from '../api';
import type { DailyNote, NoteEntry, Goal } from '../types';
import NoteEntryCard from './NoteEntryCard';
import LabelSelector from './LabelSelector';
import EntryDropdown from './EntryDropdown';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import { useFullScreen } from '../contexts/FullScreenContext';
import { useDailyGoals } from '../contexts/DailyGoalsContext';
import { useSprintGoals } from '../contexts/SprintGoalsContext';
import { useSprintName } from '../contexts/SprintNameContext';
import { useQuarterlyGoals } from '../contexts/QuarterlyGoalsContext';
import { useDayLabels } from '../contexts/DayLabelsContext';
import { useTexture } from '../hooks/useTexture';

const DailyView = () => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isFullScreen } = useFullScreen();
  const textureStyles = useTexture('header');
  const { showDailyGoals } = useDailyGoals();
  const { showSprintGoals } = useSprintGoals();
  const { sprintName } = useSprintName();
  const { showQuarterlyGoals } = useQuarterlyGoals();
  const { showDayLabels } = useDayLabels();
  const [note, setNote] = useState<DailyNote | null>(null);
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dailyGoal, setDailyGoal] = useState('');
  const [dailyGoalEndTime, setDailyGoalEndTime] = useState('17:00');
  const [dailyGoalTimeRemaining, setDailyGoalTimeRemaining] = useState('');
  const [sprintGoal, setSprintGoal] = useState<Goal | null>(null);
  const [quarterlyGoal, setQuarterlyGoal] = useState<Goal | null>(null);
  const [editingDailyGoal, setEditingDailyGoal] = useState(false);
  const [editingSprintGoal, setEditingSprintGoal] = useState(false);
  const [editingQuarterlyGoal, setEditingQuarterlyGoal] = useState(false);
  const [creatingSprintGoal, setCreatingSprintGoal] = useState(false);
  const [creatingQuarterlyGoal, setCreatingQuarterlyGoal] = useState(false);
  const [newSprintText, setNewSprintText] = useState('');
  const [newSprintStartDate, setNewSprintStartDate] = useState('');
  const [newSprintEndDate, setNewSprintEndDate] = useState('');
  const [newQuarterlyText, setNewQuarterlyText] = useState('');
  const [newQuarterlyStartDate, setNewQuarterlyStartDate] = useState('');
  const [newQuarterlyEndDate, setNewQuarterlyEndDate] = useState('');
  const [editingSprintStartDate, setEditingSprintStartDate] = useState('');
  const [editingSprintEndDate, setEditingSprintEndDate] = useState('');
  const [editingQuarterlyStartDate, setEditingQuarterlyStartDate] = useState('');
  const [editingQuarterlyEndDate, setEditingQuarterlyEndDate] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [isMerging, setIsMerging] = useState(false);
  const dailyGoalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dailyGoalRef = useRef<string>(dailyGoal);

  // Keep ref in sync with state
  useEffect(() => {
    dailyGoalRef.current = dailyGoal;
  }, [dailyGoal]);

  // Load goals for the specific date being viewed
  useEffect(() => {
    if (date) {
      // Close any open date pickers when navigating to a different day
      setCreatingSprintGoal(false);
      setCreatingQuarterlyGoal(false);
      setEditingSprintGoal(false);
      setEditingQuarterlyGoal(false);
      
      // Scroll to top immediately when date changes
      window.scrollTo({ top: 0, behavior: 'instant' });
      loadDailyNote();
      loadGoalsForDate(date);
    }
  }, [date]);

  // Load daily goal end time from settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsApi.get();
        setDailyGoalEndTime(settings.daily_goal_end_time || '17:00');
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Update daily goal countdown every minute
  useEffect(() => {
    const updateCountdown = () => {
      if (!date || !dailyGoalEndTime) return;

      const now = new Date();
      const viewedDate = new Date(date + 'T00:00:00');
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Only show countdown if viewing today
      if (viewedDate.getTime() !== today.getTime()) {
        setDailyGoalTimeRemaining('');
        return;
      }

      const [hours, minutes] = dailyGoalEndTime.split(':').map(Number);
      const endTime = new Date(now);
      endTime.setHours(hours, minutes, 0, 0);

      const diff = endTime.getTime() - now.getTime();

      if (diff <= 0) {
        setDailyGoalTimeRemaining('Done for the day');
      } else {
        const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
        const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setDailyGoalTimeRemaining(`${hoursLeft}h ${minutesLeft}m remaining`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [date, dailyGoalEndTime]);

  const loadGoalsForDate = async (viewedDate: string) => {
    try {
      // Try to load sprint goal for this date
      try {
        const sprintGoalData = await goalsApi.getSprintForDate(viewedDate);
        setSprintGoal(sprintGoalData);
      } catch (error: any) {
        // 404 is expected when no goal exists for this date - don't log
        if (error.response?.status === 404) {
          setSprintGoal(null);
        } else {
          console.error('Failed to load sprint goal:', error);
        }
      }

      // Try to load quarterly goal for this date
      try {
        const quarterlyGoalData = await goalsApi.getQuarterlyForDate(viewedDate);
        setQuarterlyGoal(quarterlyGoalData);
      } catch (error: any) {
        // 404 is expected when no goal exists for this date - don't log
        if (error.response?.status === 404) {
          setQuarterlyGoal(null);
        } else {
          console.error('Failed to load quarterly goal:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load goals:', error);
    }
  };

  // Scroll to specific entry if hash or highlight param is present
  useEffect(() => {
    if (entries.length === 0) return;

    let entryId: string | null = null;

    // Check for hash (#entry-123)
    if (window.location.hash) {
      const hash = window.location.hash.slice(1); // Remove the #
      if (hash.startsWith('entry-')) {
        entryId = hash.replace('entry-', '');
      }
    }

    // Check for highlight query param (?highlight=123)
    const highlightParam = searchParams.get('highlight');
    if (highlightParam) {
      entryId = highlightParam;
    }

    if (entryId) {
      setTimeout(() => {
        const element = document.querySelector(`[data-entry-id="${entryId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add brief highlight animation
          element.classList.add('highlight-pulse');
          setTimeout(() => {
            element.classList.remove('highlight-pulse');
          }, 2000);

          // Clear the query param after scrolling
          searchParams.delete('highlight');
          setSearchParams(searchParams, { replace: true });
          
          // Clear the hash after scrolling
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      }, 300);
    }
  }, [entries, searchParams, setSearchParams]);

  const loadDailyNote = async (preserveScroll = false) => {
    if (!date) return;

    // Save current scroll position if we want to preserve it
    const scrollY = preserveScroll ? window.scrollY : 0;

    setLoading(true);
    try {
      const noteData = await notesApi.getByDate(date);
      setNote(noteData);
      // Keep entries in their original order (sorted by order_index from backend)
      setEntries(noteData.entries || []);
      setDailyGoal(noteData.daily_goal || '');
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Note doesn't exist yet
        setNote(null);
        setEntries([]);
        setDailyGoal('');
      } else {
        console.error('Failed to load note:', error);
      }
    } finally {
      setLoading(false);
      // Restore scroll position if preserving, otherwise scroll to top
      if (preserveScroll) {
        setTimeout(() => window.scrollTo({ top: scrollY, behavior: 'instant' }), 0);
      } else {
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0);
      }
    }
  };

  const handlePreviousDay = () => {
    if (!date) return;
    const currentDate = parse(date, 'yyyy-MM-dd', new Date());
    const prevDate = subDays(currentDate, 1);
    navigate(`/day/${format(prevDate, 'yyyy-MM-dd')}`);
  };

  const handleNextDay = () => {
    if (!date) return;
    const currentDate = parse(date, 'yyyy-MM-dd', new Date());
    const nextDate = addDays(currentDate, 1);
    navigate(`/day/${format(nextDate, 'yyyy-MM-dd')}`);
  };

  const handleAddEntry = async (contentType: 'rich_text' | 'code' = 'rich_text') => {
    if (!date) return;

    try {
      const newEntry = await entriesApi.create(date, {
        content: '',
        content_type: contentType,
        order_index: 0,
      });
      
      // Add new entry at the beginning with slide-in animation
      setEntries([newEntry, ...entries]);
    } catch (error) {
      console.error('Failed to create entry:', error);
    }
  };

  const handleEntryUpdate = async (entryId: number, content: string) => {
    try {
      await entriesApi.update(entryId, { content });
      setEntries(entries.map(e => e.id === entryId ? { ...e, content } : e));
    } catch (error) {
      console.error('Failed to update entry:', error);
    }
  };

  const handleMoveToTop = async (entryId: number) => {
    // Optimistically move the entry to the top in the UI
    const entryIndex = entries.findIndex(e => e.id === entryId);
    if (entryIndex > 0) {
      const entry = entries[entryIndex];
      const newEntries = [entry, ...entries.filter(e => e.id !== entryId)];
      setEntries(newEntries);
    }
    // No need to reload - the optimistic update is enough
    // The server has already updated the order_index in the background
  };

  const handleEntryLabelsUpdate = (entryId: number, newLabels: any[]) => {
    // Optimistically update the entry's labels in the entries list
    setEntries(prevEntries => 
      prevEntries.map(entry => 
        entry.id === entryId 
          ? { ...entry, labels: newLabels }
          : entry
      )
    );
  };

  const handleEntryDelete = async (entryId: number) => {
    try {
      // Optimistically remove from UI with fade out effect
      const entryElement = document.querySelector(`[data-entry-id="${entryId}"]`);
      if (entryElement) {
        entryElement.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      await entriesApi.delete(entryId);
      setEntries(entries.filter(e => e.id !== entryId));
    } catch (error) {
      console.error('Failed to delete entry:', error);
      // Restore opacity on error
      const entryElement = document.querySelector(`[data-entry-id="${entryId}"]`);
      if (entryElement) {
        entryElement.classList.remove('opacity-0');
      }
    }
  };

  const handleDailyGoalChange = async (newGoal: string) => {
    if (!date) return;
    setDailyGoal(newGoal);
    dailyGoalRef.current = newGoal; // Update ref immediately for onBlur
    
    // Clear any existing timeout
    if (dailyGoalTimeoutRef.current) {
      clearTimeout(dailyGoalTimeoutRef.current);
    }
    
    // Debounce the save
    dailyGoalTimeoutRef.current = setTimeout(async () => {
      try {
        if (note) {
          await notesApi.update(date, { daily_goal: newGoal });
        } else {
          await notesApi.create({ date, daily_goal: newGoal, fire_rating: 0 });
          loadDailyNote();
        }
      } catch (error) {
        console.error('Failed to update daily goal:', error);
      }
    }, 1000);
  };

  const handleSprintGoalUpdate = async (updates: { text?: string; start_date?: string; end_date?: string }) => {
    if (!sprintGoal || !date) return;
    
    try {
      const updated = await goalsApi.updateSprint(sprintGoal.id, updates);
      setSprintGoal(updated);
    } catch (error: any) {
      console.error('Failed to update sprint goal:', error);
      const message = error?.response?.data?.detail || 'Failed to update sprint goal';
      alert(message);
    }
  };

  const handleQuarterlyGoalUpdate = async (updates: { text?: string; start_date?: string; end_date?: string }) => {
    if (!quarterlyGoal || !date) return;
    
    try {
      const updated = await goalsApi.updateQuarterly(quarterlyGoal.id, updates);
      setQuarterlyGoal(updated);
    } catch (error: any) {
      console.error('Failed to update quarterly goal:', error);
      const message = error?.response?.data?.detail || 'Failed to update quarterly goal';
      alert(message);
    }
  };

  const getDaysUntilStart = (startDate: string, fromDate: string): number => {
    try {
      const start = new Date(startDate);
      const from = new Date(fromDate);
      const diffTime = start.getTime() - from.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (error) {
      return 0;
    }
  };

  const isGoalNotStarted = (goal: Goal | null, viewedDate: string): boolean => {
    if (!goal || !viewedDate) return false;
    return goal.start_date > viewedDate;
  };

  // Helper to check if goal text is actually empty (accounting for HTML tags and whitespace)
  const hasGoalContent = (goalText: string | undefined | null): boolean => {
    if (!goalText) return false;
    // Strip HTML tags and check if there's any actual text content
    const textOnly = goalText.replace(/<[^>]*>/g, '').trim();
    return textOnly.length > 0;
  };

  const handleCreateSprintGoal = async () => {
    if (!date || !newSprintText || !newSprintStartDate || !newSprintEndDate) {
      alert('Please provide goal text, start date, and end date');
      return;
    }

    try {
      const newGoal = await goalsApi.createSprint({
        text: newSprintText,
        start_date: newSprintStartDate,
        end_date: newSprintEndDate
      });
      setSprintGoal(newGoal);
      setCreatingSprintGoal(false);
      setNewSprintText('');
      setNewSprintStartDate('');
      setNewSprintEndDate('');
    } catch (error: any) {
      console.error('Failed to create sprint goal:', error);
      if (error.response?.status === 400) {
        alert(error.response?.data?.detail || 'Failed to create goal. Check for overlapping dates.');
      } else {
        alert('Failed to create sprint goal');
      }
    }
  };

  const handleCreateQuarterlyGoal = async () => {
    if (!date || !newQuarterlyText || !newQuarterlyStartDate || !newQuarterlyEndDate) {
      alert('Please provide goal text, start date, and end date');
      return;
    }

    try {
      const newGoal = await goalsApi.createQuarterly({
        text: newQuarterlyText,
        start_date: newQuarterlyStartDate,
        end_date: newQuarterlyEndDate
      });
      setQuarterlyGoal(newGoal);
      setCreatingQuarterlyGoal(false);
      setNewQuarterlyText('');
      setNewQuarterlyStartDate('');
      setNewQuarterlyEndDate('');
    } catch (error: any) {
      console.error('Failed to create quarterly goal:', error);
      if (error.response?.status === 400) {
        alert(error.response?.data?.detail || 'Failed to create goal. Check for overlapping dates.');
      } else {
        alert('Failed to create quarterly goal');
      }
    }
  };


  const handleSelectionChange = (entryId: number, selected: boolean) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(entryId);
      } else {
        newSet.delete(entryId);
      }
      return newSet;
    });
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedEntries(new Set()); // Clear selection when toggling
  };

  const handleMergeEntries = async () => {
    if (selectedEntries.size < 2) {
      alert('Please select at least 2 entries to merge');
      return;
    }

    if (!window.confirm(`Merge ${selectedEntries.size} selected entries? The original entries will be deleted.`)) {
      return;
    }

    setIsMerging(true);
    try {
      await api.post('/api/entries/merge', {
        entry_ids: Array.from(selectedEntries),
        separator: '\n\n',
        delete_originals: true
      });

      // Reload the daily note to get the updated entries
      await loadDailyNote();
      
      // Reset selection state
      setSelectedEntries(new Set());
      setSelectionMode(false);
    } catch (error: any) {
      console.error('Failed to merge entries:', error);
      alert(error.response?.data?.detail || 'Failed to merge entries');
    } finally {
      setIsMerging(false);
    }
  };

  if (!date) return null;

  const currentDate = parse(date, 'yyyy-MM-dd', new Date());
  const isToday = format(new Date(), 'yyyy-MM-dd') === date;

  return (
    <div className="w-full max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto page-fade-in" style={{ position: 'relative', zIndex: 1 }}>
      <div className={`${isFullScreen ? 'max-w-full' : 'w-full max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl'} mx-auto`} style={{ position: 'relative', zIndex: 20 }}>
      {/* Header */}
      <div 
        className="rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8"
        style={{ ...textureStyles, backgroundColor: 'var(--color-card-bg)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePreviousDay}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <div className="text-center flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </h1>
            {isToday && (
              <span 
                className="inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-accent-text)'
                }}
              >
                Today
              </span>
            )}
          </div>

          <button
            onClick={handleNextDay}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Next day"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Jump to Entry - centered below date */}
        {entries.length > 0 && (
          <div className="flex justify-center mt-4 pb-4 mb-4 border-b" style={{ borderColor: 'var(--color-border-primary)' }}>
            <EntryDropdown entries={entries} />
          </div>
        )}

          {(showDailyGoals || showSprintGoals || showQuarterlyGoals || showDayLabels) && (
            <div className="flex flex-col items-center gap-6 w-full">
              {/* Day Labels Section - only show if enabled */}
              {showDayLabels && (
                <div className="w-full">
                  <label className="block text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>🏷️ Day Labels:</label>
                  <LabelSelector
                    date={date}
                    selectedLabels={note?.labels || []}
                    onLabelsChange={() => loadDailyNote(true)}
                  />
                </div>
              )}
              
              {/* Daily Goals Section - only show if enabled */}
              {showDailyGoals && (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>🎯 Daily Goals</label>
                    {hasGoalContent(dailyGoal) && dailyGoalTimeRemaining && (
                      <div 
                        className="flex items-center gap-2 px-3 py-1 rounded-full"
                        style={{ 
                          backgroundColor: 'var(--color-bg-secondary)',
                          color: 'var(--color-accent)',
                          border: '1px solid var(--color-accent)'
                        }}
                      >
                        <span className="text-sm font-bold">
                          {dailyGoalTimeRemaining}
                        </span>
                      </div>
                    )}
                  </div>
              {editingDailyGoal ? (
                <div 
                  onBlur={(e) => {
                    // Only exit edit mode if clicking completely outside the editor
                    // Check if the new focus target is within this container
                    const relatedTarget = e.relatedTarget as Node | null;
                    
                    // If relatedTarget is null or not within the editor container, exit edit mode
                    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
                      setEditingDailyGoal(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <SimpleRichTextEditor
                    content={dailyGoal}
                    onChange={handleDailyGoalChange}
                    placeholder="What are your main goals for today?"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingDailyGoal(false);
                        // Flush any pending debounced save
                        if (dailyGoalTimeoutRef.current) {
                          clearTimeout(dailyGoalTimeoutRef.current);
                          dailyGoalTimeoutRef.current = null;
                        }
                        // Immediately save
                        if (date && dailyGoalRef.current) {
                          if (note) {
                            notesApi.update(date, { daily_goal: dailyGoalRef.current });
                          } else {
                            notesApi.create({ date, daily_goal: dailyGoalRef.current, fire_rating: 0 });
                            loadDailyNote();
                          }
                        }
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: 'var(--color-accent)',
                        color: 'white',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingDailyGoal(false);
                        // Clear any pending debounced save
                        if (dailyGoalTimeoutRef.current) {
                          clearTimeout(dailyGoalTimeoutRef.current);
                          dailyGoalTimeoutRef.current = null;
                        }
                        // Reset to original value
                        setDailyGoal(note?.daily_goal || '');
                        dailyGoalRef.current = note?.daily_goal || '';
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border-primary)',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                    <div
                      onClick={() => setEditingDailyGoal(true)}
                      className="w-full px-4 py-3 rounded-lg cursor-pointer transition-colors"
                      style={{
                        color: hasGoalContent(dailyGoal) ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                        backgroundColor: 'transparent',
                        minHeight: hasGoalContent(dailyGoal) ? '80px' : '40px',
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <style>{`
                        .goal-content h2 {
                          font-size: 1.5em;
                          font-weight: bold;
                          margin-top: 0.75em;
                          margin-bottom: 0.5em;
                        }
                        .goal-content h3 {
                          font-size: 1.25em;
                          font-weight: bold;
                          margin-top: 0.75em;
                          margin-bottom: 0.5em;
                        }
                        .goal-content strong, .goal-content b {
                          font-weight: bold;
                        }
                        .goal-content em, .goal-content i {
                          font-style: italic;
                        }
                        .goal-content ul {
                          list-style-type: disc;
                          padding-left: 1.5em;
                          margin: 0.5em 0;
                        }
                        .goal-content ol {
                          list-style-type: decimal;
                          padding-left: 1.5em;
                          margin: 0.5em 0;
                        }
                        .goal-content a {
                          color: #3b82f6;
                          text-decoration: underline;
                        }
                      `}</style>
                      <div 
                        className="goal-content"
                        dangerouslySetInnerHTML={{ __html: dailyGoal || 'Click to add daily goals...' }}
                      />
                    </div>
                  )}
                </div>
              )}
              
              {/* Sprint Goals Section - only show if enabled */}
              {showSprintGoals && (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <label className="text-lg font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>🚀 {sprintName} Goals</label>
                    {sprintGoal && hasGoalContent(sprintGoal.text) && date && (
                      <div 
                        className="flex items-center gap-2 px-3 py-1 rounded-full flex-shrink-0"
                        style={{ 
                          backgroundColor: 'var(--color-bg-secondary)',
                          color: 'var(--color-accent)',
                          border: '1px solid var(--color-accent)'
                        }}
                        title={`${sprintGoal.start_date} to ${sprintGoal.end_date}`}
                      >
                        <span className="text-sm font-bold whitespace-nowrap">
                          {isGoalNotStarted(sprintGoal, date) ? (
                            `${getDaysUntilStart(sprintGoal.start_date, date)} days until start`
                          ) : sprintGoal.days_remaining !== undefined ? (
                            sprintGoal.days_remaining > 0 ? `${sprintGoal.days_remaining} days left` : 
                            sprintGoal.days_remaining === 0 ? 'Today!' : 
                            `${Math.abs(sprintGoal.days_remaining)} days overdue`
                          ) : null}
                        </span>
                      </div>
                    )}
                  </div>

                  {sprintGoal ? (
                    // Existing goal - always editable
                    <>
                      {editingSprintGoal ? (
                        <div
                          onBlur={(e) => {
                            // Only save if we're leaving the entire edit container
                            const relatedTarget = e.relatedTarget as Node | null;
                            
                            if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
                              setEditingSprintGoal(false);
                              const updates: { text?: string; start_date?: string; end_date?: string } = {};
                              // Always include text as it may have been updated via onChange
                              updates.text = sprintGoal.text;
                              if (editingSprintStartDate && editingSprintStartDate !== sprintGoal.start_date) {
                                updates.start_date = editingSprintStartDate;
                              }
                              if (editingSprintEndDate && editingSprintEndDate !== sprintGoal.end_date) {
                                updates.end_date = editingSprintEndDate;
                              }
                              handleSprintGoalUpdate(updates);
                            }
                          }}
                          className="space-y-3"
                        >
                          <SimpleRichTextEditor
                            content={sprintGoal.text}
                            onChange={(newText) => {
                              setSprintGoal({ ...sprintGoal, text: newText });
                            }}
                            placeholder="What are your sprint goals?"
                          />
                          <div className="flex gap-2 items-center">
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Start:</span>
                            <input
                              type="date"
                              value={editingSprintStartDate}
                              onChange={(e) => setEditingSprintStartDate(e.target.value)}
                              className="px-3 py-1.5 rounded-lg text-sm flex-1"
                              style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                borderColor: 'var(--color-border-primary)',
                                border: '1px solid'
                              }}
                            />
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>End:</span>
                            <input
                              type="date"
                              value={editingSprintEndDate}
                              onChange={(e) => setEditingSprintEndDate(e.target.value)}
                              className="px-3 py-1.5 rounded-lg text-sm flex-1"
                              style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                borderColor: 'var(--color-border-primary)',
                                border: '1px solid'
                              }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingSprintGoal(false);
                                const updates: { text?: string; start_date?: string; end_date?: string } = {};
                                updates.text = sprintGoal.text;
                                if (editingSprintStartDate && editingSprintStartDate !== sprintGoal.start_date) {
                                  updates.start_date = editingSprintStartDate;
                                }
                                if (editingSprintEndDate && editingSprintEndDate !== sprintGoal.end_date) {
                                  updates.end_date = editingSprintEndDate;
                                }
                                handleSprintGoalUpdate(updates);
                              }}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                              style={{
                                backgroundColor: 'var(--color-accent)',
                                color: 'white',
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingSprintGoal(false);
                                // Reset to original values
                                setEditingSprintStartDate(sprintGoal.start_date);
                                setEditingSprintEndDate(sprintGoal.end_date);
                                // Reload the sprint goal to discard changes
                                if (date) loadGoalsForDate(date);
                              }}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                              style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                border: '1px solid var(--color-border-primary)',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingSprintGoal(true);
                            setEditingSprintStartDate(sprintGoal.start_date);
                            setEditingSprintEndDate(sprintGoal.end_date);
                          }}
                          className="w-full px-4 py-3 rounded-lg transition-colors cursor-pointer"
                          style={{
                            color: hasGoalContent(sprintGoal.text) ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                            backgroundColor: 'transparent',
                            minHeight: hasGoalContent(sprintGoal.text) ? '80px' : '40px',
                            maxHeight: '400px',
                            overflowY: 'auto'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div 
                            className="goal-content"
                            dangerouslySetInnerHTML={{ __html: sprintGoal.text || 'Click to edit sprint goals...' }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    // No goal exists - show creation interface
                    <>
                      {creatingSprintGoal ? (
                        <div className="space-y-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          <SimpleRichTextEditor
                            content={newSprintText}
                            onChange={setNewSprintText}
                            placeholder="What are your sprint goals?"
                          />
                          <div className="flex gap-2 items-center">
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Start:</span>
                            <input
                              type="date"
                              value={newSprintStartDate}
                              onChange={(e) => setNewSprintStartDate(e.target.value)}
                              className="px-2 py-1 border rounded text-xs"
                              style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                borderColor: 'var(--color-border-primary)'
                              }}
                            />
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>→ End:</span>
                            <input
                              type="date"
                              value={newSprintEndDate}
                              onChange={(e) => setNewSprintEndDate(e.target.value)}
                              min={newSprintStartDate || date}
                              className="px-2 py-1 border rounded text-xs"
                              style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                borderColor: 'var(--color-border-primary)'
                              }}
                            />
                            <button
                              onClick={handleCreateSprintGoal}
                              className="px-3 py-1 text-xs rounded hover:opacity-80"
                              style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
                            >
                              Create
                            </button>
                            <button
                              onClick={() => {
                                setCreatingSprintGoal(false);
                                setNewSprintText('');
                                setNewSprintStartDate('');
                                setNewSprintEndDate('');
                              }}
                              className="px-3 py-1 text-xs rounded hover:opacity-80"
                              style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setCreatingSprintGoal(true);
                            // Set default start date to current viewed date
                            setNewSprintStartDate(date || '');
                          }}
                          className="text-xs px-3 py-2 rounded hover:opacity-80"
                          style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' }}
                        >
                          + Create Sprint Goal
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* Quarterly Goals Section - only show if enabled */}
              {showQuarterlyGoals && (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-2 gap-4">
                    <label className="text-lg font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>🌟 Quarterly Goals</label>
                    {quarterlyGoal && hasGoalContent(quarterlyGoal.text) && date && (
                      <div 
                        className="flex items-center gap-2 px-3 py-1 rounded-full flex-shrink-0 ml-2"
                        style={{ 
                          backgroundColor: 'var(--color-bg-secondary)',
                          color: 'var(--color-accent)',
                          border: '1px solid var(--color-accent)'
                        }}
                        title={`${quarterlyGoal.start_date} to ${quarterlyGoal.end_date}`}
                      >
                        <span className="text-sm font-bold whitespace-nowrap">
                          {isGoalNotStarted(quarterlyGoal, date) ? (
                            `${getDaysUntilStart(quarterlyGoal.start_date, date)} days until start`
                          ) : quarterlyGoal.days_remaining !== undefined ? (
                            quarterlyGoal.days_remaining > 0 ? `${quarterlyGoal.days_remaining} days left` : 
                            quarterlyGoal.days_remaining === 0 ? 'Today!' : 
                            `${Math.abs(quarterlyGoal.days_remaining)} days overdue`
                          ) : null}
                        </span>
                      </div>
                    )}
                  </div>

                  {quarterlyGoal ? (
                    // Existing goal - always editable
                    <>
                      {editingQuarterlyGoal ? (
                        <div
                          onBlur={(e) => {
                            // Only save if we're leaving the entire edit container
                            const relatedTarget = e.relatedTarget as Node | null;
                            
                            if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
                              setEditingQuarterlyGoal(false);
                              const updates: { text?: string; start_date?: string; end_date?: string } = {};
                              // Always include text as it may have been updated via onChange
                              updates.text = quarterlyGoal.text;
                              if (editingQuarterlyStartDate && editingQuarterlyStartDate !== quarterlyGoal.start_date) {
                                updates.start_date = editingQuarterlyStartDate;
                              }
                              if (editingQuarterlyEndDate && editingQuarterlyEndDate !== quarterlyGoal.end_date) {
                                updates.end_date = editingQuarterlyEndDate;
                              }
                              handleQuarterlyGoalUpdate(updates);
                            }
                          }}
                          className="space-y-3"
                        >
                          <SimpleRichTextEditor
                            content={quarterlyGoal.text}
                            onChange={(newText) => {
                              setQuarterlyGoal({ ...quarterlyGoal, text: newText });
                            }}
                            placeholder="What are your quarterly goals?"
                          />
                          <div className="flex gap-2 items-center">
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Start:</span>
                            <input
                              type="date"
                              value={editingQuarterlyStartDate}
                              onChange={(e) => setEditingQuarterlyStartDate(e.target.value)}
                              className="px-3 py-1.5 rounded-lg text-sm flex-1"
                              style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                borderColor: 'var(--color-border-primary)',
                                border: '1px solid'
                              }}
                            />
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>End:</span>
                            <input
                              type="date"
                              value={editingQuarterlyEndDate}
                              onChange={(e) => setEditingQuarterlyEndDate(e.target.value)}
                              className="px-3 py-1.5 rounded-lg text-sm flex-1"
                              style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                borderColor: 'var(--color-border-primary)',
                                border: '1px solid'
                              }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingQuarterlyGoal(false);
                                const updates: { text?: string; start_date?: string; end_date?: string } = {};
                                updates.text = quarterlyGoal.text;
                                if (editingQuarterlyStartDate && editingQuarterlyStartDate !== quarterlyGoal.start_date) {
                                  updates.start_date = editingQuarterlyStartDate;
                                }
                                if (editingQuarterlyEndDate && editingQuarterlyEndDate !== quarterlyGoal.end_date) {
                                  updates.end_date = editingQuarterlyEndDate;
                                }
                                handleQuarterlyGoalUpdate(updates);
                              }}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                              style={{
                                backgroundColor: 'var(--color-accent)',
                                color: 'white',
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingQuarterlyGoal(false);
                                // Reset to original values
                                setEditingQuarterlyStartDate(quarterlyGoal.start_date);
                                setEditingQuarterlyEndDate(quarterlyGoal.end_date);
                                // Reload the quarterly goal to discard changes
                                if (date) loadGoalsForDate(date);
                              }}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                              style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                border: '1px solid var(--color-border-primary)',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingQuarterlyGoal(true);
                            setEditingQuarterlyStartDate(quarterlyGoal.start_date);
                            setEditingQuarterlyEndDate(quarterlyGoal.end_date);
                          }}
                          className="w-full px-4 py-3 rounded-lg transition-colors cursor-pointer"
                          style={{
                            color: hasGoalContent(quarterlyGoal.text) ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                            backgroundColor: 'transparent',
                            minHeight: hasGoalContent(quarterlyGoal.text) ? '80px' : '40px',
                            maxHeight: '400px',
                            overflowY: 'auto'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div 
                            className="goal-content"
                            dangerouslySetInnerHTML={{ __html: quarterlyGoal.text || 'Click to edit quarterly goals...' }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    // No goal exists - show creation interface
                    <>
                      {creatingQuarterlyGoal ? (
                        <div className="space-y-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          <SimpleRichTextEditor
                            content={newQuarterlyText}
                            onChange={setNewQuarterlyText}
                            placeholder="What are your quarterly goals?"
                          />
                          <div className="flex gap-2 items-center">
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Start:</span>
                            <input
                              type="date"
                              value={newQuarterlyStartDate}
                              onChange={(e) => setNewQuarterlyStartDate(e.target.value)}
                              className="px-2 py-1 border rounded text-xs"
                              style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                borderColor: 'var(--color-border-primary)'
                              }}
                            />
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>→ End:</span>
                            <input
                              type="date"
                              value={newQuarterlyEndDate}
                              onChange={(e) => setNewQuarterlyEndDate(e.target.value)}
                              min={newQuarterlyStartDate || date}
                              className="px-2 py-1 border rounded text-xs"
                              style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-primary)',
                                borderColor: 'var(--color-border-primary)'
                              }}
                            />
                            <button
                              onClick={handleCreateQuarterlyGoal}
                              className="px-3 py-1 text-xs rounded hover:opacity-80"
                              style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
                            >
                              Create
                            </button>
                            <button
                              onClick={() => {
                                setCreatingQuarterlyGoal(false);
                                setNewQuarterlyText('');
                                setNewQuarterlyStartDate('');
                                setNewQuarterlyEndDate('');
                              }}
                              className="px-3 py-1 text-xs rounded hover:opacity-80"
                              style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setCreatingQuarterlyGoal(true);
                            // Set default start date to current viewed date
                            setNewQuarterlyStartDate(date || '');
                          }}
                          className="text-xs px-3 py-2 rounded hover:opacity-80"
                          style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' }}
                        >
                          + Create Quarterly Goal
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
      </div>

      {/* Entries */}
      <div className="space-y-6">
        {loading ? (
          <div 
            className="rounded-2xl shadow-lg p-8 text-center"
            style={{ 
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-secondary)'
            }}
          >
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div 
            className="rounded-2xl shadow-lg p-8"
            style={{ backgroundColor: 'var(--color-bg-primary)' }}
          >
            <p className="mb-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>No entries for this day yet.</p>
            <button
              onClick={() => handleAddEntry('rich_text')}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition-all font-medium shadow-sm"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-accent-text)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-accent)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
              }}
            >
              <Plus className="h-5 w-5" />
              New Card
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-3 items-center" style={{ minHeight: '52px' }}>
              {!selectionMode ? (
                <>
                  <button
                    onClick={() => handleAddEntry('rich_text')}
                    className="flex-1 px-6 py-3 rounded-lg transition-all font-medium shadow-sm flex items-center justify-center gap-2"
                    style={{
                      animation: 'fadeIn 0.2s ease-out',
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-accent-text)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-accent)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <Plus className="h-5 w-5" />
                    New Card
                  </button>
                  <button
                    onClick={toggleSelectionMode}
                    className="px-4 py-3 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                    style={{
                      animation: 'fadeIn 0.2s ease-out',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-primary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                      e.currentTarget.style.color = 'var(--color-accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                      e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                    title="Select entries to merge"
                  >
                    <CheckSquare className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleSelectionMode}
                    className="px-6 py-3 rounded-lg transition-all font-medium shadow-sm"
                    style={{
                      animation: 'fadeIn 0.2s ease-out',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-primary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                      e.currentTarget.style.borderColor = 'var(--color-text-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                      e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMergeEntries}
                    disabled={selectedEntries.size < 2 || isMerging}
                    className="flex-1 px-6 py-3 rounded-lg transition-all font-medium shadow-sm flex items-center justify-center gap-2"
                    style={{
                      animation: 'fadeIn 0.2s ease-out',
                      backgroundColor: selectedEntries.size >= 2 && !isMerging ? 'var(--color-success)' : 'var(--color-bg-tertiary)',
                      color: selectedEntries.size >= 2 && !isMerging ? '#ffffff' : 'var(--color-text-tertiary)',
                      cursor: selectedEntries.size >= 2 && !isMerging ? 'pointer' : 'not-allowed',
                      opacity: selectedEntries.size >= 2 && !isMerging ? '1' : '0.6'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedEntries.size >= 2 && !isMerging) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedEntries.size >= 2 && !isMerging) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                      }
                    }}
                  >
                    <Combine className="h-5 w-5" />
                    {isMerging ? 'Merging...' : `Merge ${selectedEntries.size} Entries`}
                  </button>
                </>
              )}
            </div>
            {entries.map((entry, index) => (
              <div 
                key={entry.id} 
                data-entry-id={entry.id}
                className="entry-card-container relative group"
                style={{
                  animation: index === 0 ? 'slideDown 0.3s ease-out' : 'none',
                }}
              >
                <NoteEntryCard
                  entry={entry}
                  onUpdate={handleEntryUpdate}
                  onDelete={handleEntryDelete}
                  onLabelsUpdate={handleEntryLabelsUpdate}
                  onListsUpdate={loadDailyNote}
                  onMoveToTop={handleMoveToTop}
                  selectionMode={selectionMode}
                  isSelected={selectedEntries.has(entry.id)}
                  onSelectionChange={handleSelectionChange}
                  currentDate={date}
                />
              </div>
            ))}
          </>
        )}
      </div>

    </div>
    </div>
  );
};

export default DailyView;

