import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CalendarView from './components/CalendarView';
import DailyView from './components/DailyView';
import Lists from './components/Lists';
import Kanban from './components/Kanban';
import Navigation from './components/Navigation';
import Settings from './components/Settings';
import Reports from './components/Reports';
import Search from './components/Search';
import Archive from './components/Archive';
import { SplashScreen } from './components/SplashScreen';
import ReminderAlert from './components/ReminderAlert';
import { format, addDays } from 'date-fns';
import { TimezoneProvider } from './contexts/TimezoneContext';
import { useReminderPolling } from './hooks/useReminderPolling';
import { remindersApi } from './api';
import { ThemeProvider } from './contexts/ThemeContext';
import { TextureProvider } from './contexts/TextureContext';
import { CustomBackgroundProvider } from './contexts/CustomBackgroundContext';
import { TransparentLabelsProvider } from './contexts/TransparentLabelsContext';
import { FullScreenProvider, useFullScreen } from './contexts/FullScreenContext';
import { DailyGoalsProvider } from './contexts/DailyGoalsContext';
import { SprintGoalsProvider } from './contexts/SprintGoalsContext';
import { SprintNameProvider } from './contexts/SprintNameContext';
import { QuarterlyGoalsProvider } from './contexts/QuarterlyGoalsContext';
import { DayLabelsProvider } from './contexts/DayLabelsContext';
import { EmojiLibraryProvider } from './contexts/EmojiLibraryContext';
import CustomBackground from './components/CustomBackground';

const AppContent = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const today = format(new Date(), 'yyyy-MM-dd');
  const { isFullScreen } = useFullScreen();
  const dueReminders = useReminderPolling();
  const [currentReminderIndex, setCurrentReminderIndex] = useState(0);

  // Reset index when due reminders change
  useEffect(() => {
    if (dueReminders.length === 0) {
      setCurrentReminderIndex(0);
    }
  }, [dueReminders.length]);

  // Show first due reminder if any exist
  const currentReminder = dueReminders.length > 0 && currentReminderIndex < dueReminders.length
    ? dueReminders[currentReminderIndex]
    : null;

  const handleSnooze = async () => {
    if (!currentReminder) return;

    try {
      // Snooze for 1 day
      const newDateTime = addDays(new Date(currentReminder.reminder_datetime), 1).toISOString();
      await remindersApi.update(currentReminder.id, {
        reminder_datetime: newDateTime,
      });
      // Move to next reminder
      setCurrentReminderIndex(prev => prev + 1);
    } catch (error) {
      console.error('Failed to snooze reminder:', error);
      alert('Failed to snooze reminder. Please try again.');
    }
  };

  const handleDismiss = async () => {
    if (!currentReminder) return;

    try {
      // Mark as dismissed
      await remindersApi.update(currentReminder.id, {
        is_dismissed: true,
      });
      // Move to next reminder
      setCurrentReminderIndex(prev => prev + 1);
    } catch (error) {
      console.error('Failed to dismiss reminder:', error);
      alert('Failed to dismiss reminder. Please try again.');
    }
  };

  const handleCloseAlert = () => {
    // Just move to next reminder without updating the current one
    setCurrentReminderIndex(prev => prev + 1);
  };

  return (
    <Router>
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-secondary)', position: 'relative' }}>
        <CustomBackground />
        <Navigation />
        <div 
          className={`mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 ${isFullScreen ? 'max-w-full' : 'container max-w-7xl'}`}
          style={{ transition: 'max-width 0.3s ease' }}
        >
          <Routes>
            <Route
              path="/"
              element={<Navigate to={`/day/${today}`} replace />}
            />
            <Route
              path="/calendar"
              element={
                <CalendarView
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                />
              }
            />
            <Route
              path="/day/:date"
              element={<DailyView />}
            />
            <Route
              path="/lists"
              element={<Lists />}
            />
            <Route
              path="/kanban"
              element={<Kanban />}
            />
            <Route
              path="/reports"
              element={<Reports />}
            />
            <Route
              path="/search"
              element={<Search />}
            />
            <Route
              path="/settings"
              element={<Settings />}
            />
            <Route
              path="/archive"
              element={<Archive />}
            />
          </Routes>
        </div>

        {/* Reminder Alert */}
        {currentReminder && (
          <ReminderAlert
            reminder={currentReminder}
            onSnooze={handleSnooze}
            onDismiss={handleDismiss}
            onClose={handleCloseAlert}
          />
        )}
      </div>
    </Router>
  );
};

function App() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <ThemeProvider>
      <TextureProvider>
        <TimezoneProvider>
          <CustomBackgroundProvider>
            <TransparentLabelsProvider>
              <EmojiLibraryProvider>
                <DailyGoalsProvider>
                  <SprintGoalsProvider>
                    <SprintNameProvider>
                      <QuarterlyGoalsProvider>
                        <DayLabelsProvider>
                          <FullScreenProvider>
                            {showSplash ? (
                              <SplashScreen onComplete={handleSplashComplete} />
                            ) : (
                              <AppContent />
                            )}
                          </FullScreenProvider>
                        </DayLabelsProvider>
                      </QuarterlyGoalsProvider>
                    </SprintNameProvider>
                  </SprintGoalsProvider>
                </DailyGoalsProvider>
              </EmojiLibraryProvider>
            </TransparentLabelsProvider>
          </CustomBackgroundProvider>
        </TimezoneProvider>
      </TextureProvider>
    </ThemeProvider>
  );
}

export default App;

