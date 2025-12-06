import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { Star, Check, Bell, X, Clock } from 'lucide-react';
import { notesApi, goalsApi, remindersApi } from '../api';
import type { DailyNote, Goal, Reminder } from '../types';
import { useTexture } from '../hooks/useTexture';
import 'react-calendar/dist/Calendar.css';

interface CalendarViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const CalendarView = ({ selectedDate, onDateSelect }: CalendarViewProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const textureStyles = useTexture('calendar');
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarKey, setCalendarKey] = useState(0);

  useEffect(() => {
    loadMonthData();
  }, [currentMonth]);

  // Force Calendar remount when navigating back to this page
  useEffect(() => {
    setCalendarKey(prev => prev + 1);
    
    // Clean up any stale active classes
    setTimeout(() => {
      const activeTiles = document.querySelectorAll('.react-calendar__tile--active');
      activeTiles.forEach(tile => {
        tile.classList.remove('react-calendar__tile--active');
      });
    }, 100);
  }, [location.key]);

  // Single cleanup on navigation - no continuous interval
  useEffect(() => {
    const timer = setTimeout(() => {
      const allTiles = document.querySelectorAll('.react-calendar__tile--active, .react-calendar__tile--hasActive');
      allTiles.forEach(tile => {
        tile.classList.remove('react-calendar__tile--active');
        tile.classList.remove('react-calendar__tile--hasActive');
        tile.classList.remove('react-calendar__tile--range');
        tile.classList.remove('react-calendar__tile--rangeStart');
        tile.classList.remove('react-calendar__tile--rangeEnd');
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [location.key, selectedDate]);

  // Add tooltips to calendar tiles after notes and goals are loaded
  useEffect(() => {
    if (loading || (notes.length === 0 && goals.length === 0 && reminders.length === 0)) return;

    // Use requestAnimationFrame for smoother DOM updates
    requestAnimationFrame(() => {
      const tiles = document.querySelectorAll('.react-calendar__tile');
      tiles.forEach((tile) => {
        const abbr = tile.querySelector('abbr');
        if (abbr && abbr.getAttribute('aria-label')) {
          const dateStr = format(new Date(abbr.getAttribute('aria-label')!), 'yyyy-MM-dd');
          const note = notes.find(n => n.date === dateStr);
          const activeGoals = getGoalsForDate(dateStr, goals);
          
          // Count reminders on this date
          const reminderCount = reminders.filter(reminder => {
            try {
              if (!reminder.reminder_datetime) return false;
              const reminderDate = format(new Date(reminder.reminder_datetime), 'yyyy-MM-dd');
              return reminderDate === dateStr;
            } catch {
              return false;
            }
          }).length;
          
          const tooltipParts: string[] = [];
          
          // Add daily goal if exists
          if (note?.daily_goal && note.daily_goal.trim() !== '') {
            tooltipParts.push(`Daily: ${note.daily_goal}`);
          }
          
          // Add goals info
          activeGoals.forEach(goal => {
            const preview = goal.text ? goal.text.replace(/<[^>]*>/g, '').substring(0, 50) : goal.name;
            tooltipParts.push(`🎯 ${goal.name}: ${preview}${preview.length >= 50 ? '...' : ''}`);
          });
          
          // Add entry count if exists
          if (note && note.entries.length > 0) {
            tooltipParts.push(`${note.entries.length} ${note.entries.length === 1 ? 'entry' : 'entries'}`);
          }
          
          // Add reminder count if exists
          if (reminderCount > 0) {
            tooltipParts.push(`🔔 ${reminderCount} ${reminderCount === 1 ? 'reminder' : 'reminders'}`);
          }
          
          if (tooltipParts.length > 0) {
            (tile as HTMLElement).title = tooltipParts.join(' | ');
          }
        }
      });
    });
  }, [notes, goals, reminders, loading]);

  const loadMonthData = async () => {
    setLoading(true);
    
    try {
      const curYear = currentMonth.getFullYear();
      const curMonth = currentMonth.getMonth() + 1;

      // Also load adjacent months so trailing/leading days in the grid show markers
      const prevDate = new Date(curYear, currentMonth.getMonth() - 1, 1);
      const nextDate = new Date(curYear, currentMonth.getMonth() + 1, 1);

      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth() + 1;
      const nextYear = nextDate.getFullYear();
      const nextMonth = nextDate.getMonth() + 1;

      // Load all data in parallel
      const [prevData, curData, nextData, allGoals, allReminders] = await Promise.all([
        notesApi.getByMonth(prevYear, prevMonth),
        notesApi.getByMonth(curYear, curMonth),
        notesApi.getByMonth(nextYear, nextMonth),
        goalsApi.getAll(true), // Include hidden to show all on calendar
        remindersApi.getAll().catch(err => {
          console.error('Failed to load reminders:', err);
          return [];
        }),
      ]);

      // Merge notes by unique date
      const byDate = new Map<string, DailyNote>();
      for (const n of [...prevData, ...curData, ...nextData]) {
        byDate.set(n.date, n);
      }
      
      // Update all state at once, then wait a frame for smooth transition
      setNotes(Array.from(byDate.values()));
      setGoals(allGoals);
      setReminders(Array.isArray(allReminders) ? allReminders : []);
      
      // Wait for next frame before removing loading state
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (date: Date) => {
    onDateSelect(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/day/${dateStr}`);
  };

  const getTileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null;
    
    // Only add active class to the currently selected date
    const dateStr = format(date, 'yyyy-MM-dd');
    const selectedStr = format(selectedDate, 'yyyy-MM-dd');
    
    if (dateStr === selectedStr) {
      return 'calendar-tile-selected';
    }
    
    return null;
  };

  const handleActiveStartDateChange = ({ activeStartDate, action }: { activeStartDate: Date | null; action: string }) => {
    if (activeStartDate) {
      setCurrentMonth(activeStartDate);
    }
  };

  const getGoalsForDate = (dateStr: string, allGoals: Goal[]): Goal[] => {
    // Return all goals that are active on this date
    return allGoals.filter(goal => 
      dateStr >= goal.start_date && dateStr <= goal.end_date && goal.is_visible
    );
  };

  const getTileContent = ({ date }: { date: Date }) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const note = notes.find(n => n.date === dateStr);
    const activeGoals = getGoalsForDate(dateStr, goals);
    
    // Check if there are reminders on this date
    const hasReminders = reminders.some(reminder => {
      try {
        if (!reminder.reminder_datetime) return false;
        const reminderDate = format(new Date(reminder.reminder_datetime), 'yyyy-MM-dd');
        return reminderDate === dateStr;
      } catch (error) {
        console.error('Error parsing reminder datetime:', error, reminder);
        return false;
      }
    });

    // Check if there are entries or goals to display
    const hasEntries = note && (note.entries.length > 0 || (note.daily_goal && note.daily_goal.trim() !== ''));
    const hasGoals = activeGoals.length > 0;

    if (!hasEntries && !hasGoals && !hasReminders) {
      return null;
    }

    const hasImportantEntries = note?.entries.some(entry => entry.is_important);
    const hasCompletedEntries = note?.entries.some(entry => entry.is_completed);
    
    return (
      <div className="flex flex-col items-center justify-center mt-1 gap-0.5">
        {/* Entry indicators - show all that apply */}
        {hasEntries && (
          <div className="flex items-center gap-0.5">
            {hasImportantEntries && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 star-rays spin-rays" />
            )}
            {hasCompletedEntries && (
              <Check className="h-4 w-4 text-green-500 stroke-[3] animate-bounce" />
            )}
            {!hasImportantEntries && !hasCompletedEntries && (
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
            )}
          </div>
        )}
        
        {/* Reminder indicator */}
        {hasReminders && (
          <div className="flex items-center">
            <Bell className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
          </div>
        )}
        
        {/* Goal indicators */}
        {hasGoals && (
          <div className="flex items-center gap-0.5 text-xs">
            <span title={`${activeGoals.length} goal(s)`}>🎯</span>
            {activeGoals.length > 1 && (
              <span className="text-[10px] font-bold" style={{ color: 'var(--color-accent)' }}>
                {activeGoals.length}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto page-fade-in px-4" style={{ position: 'relative', zIndex: 1 }}>
      <div className="rounded-xl shadow-xl p-6" style={{ backgroundColor: 'var(--color-bg-primary)', ...textureStyles }}>
        <h1 className="text-3xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>🗓️ Calendar View</h1>
        
        <div style={{ minHeight: '400px' }}>
          {loading ? (
            <div 
              className="text-center py-12" 
              style={{ 
                color: 'var(--color-text-secondary)',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.6
              }}
            >
              <div className="animate-pulse text-2xl">🗓️</div>
            </div>
          ) : (
            <div 
              style={{ 
                animation: 'fadeIn 0.3s ease-in',
                opacity: 1
              }}
            >
              <Calendar
                key={`calendar-${calendarKey}`}
                activeStartDate={currentMonth}
                onClickDay={handleDateClick}
                onActiveStartDateChange={handleActiveStartDateChange}
                tileContent={getTileContent}
                tileClassName={getTileClassName}
                className="w-full"
              />
            </div>
          )}
        </div>

        <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)' }}>
          <h3 className="text-base font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>📋 Legend</h3>
          
          {/* Entry indicators */}
          <div className="mb-3">
            <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Entry Status</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-card-bg)' }}>
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 star-rays spin-rays flex-shrink-0" />
                <span className="text-xs font-medium">Has important</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-card-bg)' }}>
                <Check className="h-4 w-4 text-green-500 stroke-[3] animate-bounce flex-shrink-0" />
                <span className="text-xs font-medium">Has completed</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-card-bg)' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-accent)' }} />
                <span className="text-xs font-medium">Has notes</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-card-bg)' }}>
                <Bell className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                <span className="text-xs font-medium">Has reminder</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-card-bg)' }}>
                <span className="text-base flex-shrink-0">🎯</span>
                <span className="text-xs font-medium">Has active goal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reminders Section */}
        <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)' }}>
          <h3 className="text-base font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>🔔 Upcoming Reminders</h3>
          
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Loading reminders...
            </p>
          ) : reminders.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No reminders set
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {reminders
                .filter(reminder => reminder.reminder_datetime) // Filter out invalid reminders
                .sort((a, b) => {
                  try {
                    return new Date(a.reminder_datetime).getTime() - new Date(b.reminder_datetime).getTime();
                  } catch {
                    return 0;
                  }
                })
                .map((reminder) => {
                  let reminderDate: Date;
                  let dateLabel: string;
                  let timeLabel: string;
                  
                  try {
                    reminderDate = new Date(reminder.reminder_datetime);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    
                    dateLabel = format(reminderDate, 'MMM d, yyyy');
                    const reminderDateStr = format(reminderDate, 'yyyy-MM-dd');
                    const todayStr = format(today, 'yyyy-MM-dd');
                    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
                    
                    if (reminderDateStr === todayStr) {
                      dateLabel = 'Today';
                    } else if (reminderDateStr === tomorrowStr) {
                      dateLabel = 'Tomorrow';
                    }
                    
                    timeLabel = format(reminderDate, 'h:mm a');
                  } catch (error) {
                    console.error('Error parsing reminder date:', error, reminder);
                    dateLabel = 'Unknown date';
                    timeLabel = '';
                  }
                  
                  const contentPreview = reminder.entry?.content
                    ? reminder.entry.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 100)
                    : '';
                  
                  const handleReminderClick = () => {
                    if (reminder.entry?.daily_note_date) {
                      navigate(`/day/${reminder.entry.daily_note_date}`);
                    }
                  };
                  
                  const handleDeleteReminder = async (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (!confirm('Are you sure you want to cancel this reminder?')) {
                      return;
                    }
                    
                    try {
                      await remindersApi.delete(reminder.id);
                      // Reload reminders
                      const updatedReminders = await remindersApi.getAll();
                      setReminders(updatedReminders);
                    } catch (error) {
                      console.error('Failed to delete reminder:', error);
                      alert('Failed to cancel reminder. Please try again.');
                    }
                  };
                  
                  return (
                    <div
                      key={reminder.id}
                      onClick={handleReminderClick}
                      className="p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.02]"
                      style={{
                        backgroundColor: 'var(--color-card-bg)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Bell className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                              {reminder.entry?.title || 'Untitled Entry'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            <Clock className="h-3 w-3" />
                            <span>{dateLabel} at {timeLabel}</span>
                          </div>
                          {contentPreview && (
                            <p className="text-xs line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                              {contentPreview}...
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleDeleteReminder}
                          className="p-1.5 rounded transition-colors hover:bg-red-500 hover:bg-opacity-10"
                          style={{ color: 'var(--color-text-tertiary)' }}
                          title="Cancel reminder"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;

