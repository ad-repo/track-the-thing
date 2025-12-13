import { useState, useEffect, useRef } from 'react';
import { X, Target, Plus, Calendar as CalendarIcon } from 'lucide-react';
import Calendar from 'react-calendar';
import { format } from 'date-fns';
import type { Goal, GoalCreate, GoalUpdate, GoalType } from '../types';
import { TIME_BASED_GOAL_TYPES, LIFESTYLE_GOAL_TYPES } from '../types';
import RichTextEditor from './RichTextEditor';
import 'react-calendar/dist/Calendar.css';

interface GoalFormProps {
  goal?: Goal | null;
  onSave: (goal: GoalCreate | GoalUpdate) => void;
  onClose: () => void;
  initialDate?: string;
  inline?: boolean;
}

// Date picker component
const DatePickerInput = ({
  value,
  onChange,
  label,
  required,
  error,
  minDate,
}: {
  value: string;
  onChange: (date: string) => void;
  label: string;
  required?: boolean;
  error?: string;
  minDate?: Date;
}) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDateChange = (date: Date | null) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
    } else {
      onChange('');
    }
    setShowCalendar(false);
  };

  const clearDate = () => {
    onChange('');
  };

  return (
    <div ref={containerRef} className="relative">
      <label
        className="block text-sm font-medium mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {label} {required && '*'}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowCalendar(!showCalendar)}
          className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 text-left flex items-center justify-between"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: error ? 'var(--color-error)' : 'var(--color-border-primary)',
            color: value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
          }}
        >
          <span>{value ? format(new Date(value + 'T00:00:00'), 'MMM d, yyyy') : 'Select date...'}</span>
          <div className="flex items-center gap-1">
            {value && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearDate();
                }}
                className="p-1 rounded hover:bg-black/10"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <CalendarIcon className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
          </div>
        </button>
        
        {showCalendar && (
          <div
            className="absolute z-50 mt-1 rounded-lg shadow-xl"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-primary)',
            }}
          >
            <Calendar
              onChange={(date) => handleDateChange(date as Date)}
              value={value ? new Date(value + 'T00:00:00') : null}
              minDate={minDate}
              className="goal-date-picker"
            />
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      )}
    </div>
  );
};

const GoalForm = ({ goal, onSave, onClose, initialDate, inline = false }: GoalFormProps) => {
  const isEditing = !!goal;
  
  // Form state
  const [name, setName] = useState(goal?.name || '');
  const [goalType, setGoalType] = useState<GoalType>(goal?.goal_type || 'Personal');
  const [customTypeName, setCustomTypeName] = useState('');
  const [isCustomType, setIsCustomType] = useState(goal?.goal_type?.startsWith('Custom:') || false);
  const [text, setText] = useState(goal?.text || '');
  const [startDate, setStartDate] = useState(goal?.start_date || initialDate || '');
  const [endDate, setEndDate] = useState(goal?.end_date || '');
  const [endTime, setEndTime] = useState(goal?.end_time || '');
  const [statusText, setStatusText] = useState(goal?.status_text || '');
  const [showCountdown, setShowCountdown] = useState(goal?.show_countdown ?? true);
  const [isVisible, setIsVisible] = useState(goal?.is_visible ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Determine if time-based goal type
  const isTimeBased = TIME_BASED_GOAL_TYPES.includes(goalType as typeof TIME_BASED_GOAL_TYPES[number]);

  // Initialize custom type name if editing a custom type goal
  useEffect(() => {
    if (goal?.goal_type?.startsWith('Custom:')) {
      setCustomTypeName(goal.goal_type.replace('Custom:', ''));
      setIsCustomType(true);
    }
  }, [goal]);

  // Auto-calculate end date based on goal type
  useEffect(() => {
    if (!isEditing && startDate && goalType && isTimeBased) {
      const start = new Date(startDate);
      let suggestedEnd: Date | null = null;

      switch (goalType) {
        case 'Daily':
          suggestedEnd = start;
          break;
        case 'Weekly':
          suggestedEnd = new Date(start);
          suggestedEnd.setDate(start.getDate() + 6);
          break;
        case 'Sprint':
          suggestedEnd = new Date(start);
          suggestedEnd.setDate(start.getDate() + 13); // 2 weeks
          break;
        case 'Monthly':
          suggestedEnd = new Date(start);
          suggestedEnd.setMonth(start.getMonth() + 1);
          suggestedEnd.setDate(suggestedEnd.getDate() - 1);
          break;
        case 'Quarterly':
          suggestedEnd = new Date(start);
          suggestedEnd.setMonth(start.getMonth() + 3);
          suggestedEnd.setDate(suggestedEnd.getDate() - 1);
          break;
        case 'Yearly':
          suggestedEnd = new Date(start);
          suggestedEnd.setFullYear(start.getFullYear() + 1);
          suggestedEnd.setDate(suggestedEnd.getDate() - 1);
          break;
      }

      if (suggestedEnd && !endDate) {
        setEndDate(format(suggestedEnd, 'yyyy-MM-dd'));
      }
    }
  }, [startDate, goalType, isEditing, isTimeBased, endDate]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Goal name is required';
    }

    if (isCustomType && !customTypeName.trim()) {
      newErrors.customType = 'Custom type name is required';
    }

    // Dates are required for time-based goals, optional for lifestyle goals
    if (isTimeBased) {
      if (!startDate) {
        newErrors.startDate = 'Start date is required for time-based goals';
      }
      if (!endDate) {
        newErrors.endDate = 'End date is required for time-based goals';
      }
    }

    if (startDate && endDate && endDate < startDate) {
      newErrors.endDate = 'End date must be after or equal to start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const finalGoalType: GoalType = isCustomType ? `Custom:${customTypeName}` : goalType;

    const goalData: GoalCreate | GoalUpdate = {
      name: name.trim(),
      goal_type: finalGoalType,
      text,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      end_time: endTime || undefined,
      status_text: statusText,
      show_countdown: showCountdown,
      is_visible: isVisible,
    };

    onSave(goalData);
  };

  // Form content shared between inline and modal versions
  const formContent = (
    <>
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 border-b ${inline ? 'rounded-t-xl' : 'sticky top-0 z-10'}`}
        style={{
          borderColor: 'var(--color-border-primary)',
          backgroundColor: 'var(--color-bg-secondary)',
        }}
      >
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {isEditing ? 'Edit Goal' : 'New Goal'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Goal Name */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Goal Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What do you want to achieve?"
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: errors.name ? 'var(--color-error)' : 'var(--color-border-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
            {errors.name && (
              <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
                {errors.name}
              </p>
            )}
          </div>

          {/* Goal Type */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Goal Type *
            </label>
            <div className="space-y-2">
              {/* Preset types */}
              <div className="flex flex-wrap gap-1.5">
                {/* Time-based types */}
                <div className="w-full text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  Time-based:
                </div>
                {TIME_BASED_GOAL_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setGoalType(type);
                      setIsCustomType(false);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                      goalType === type && !isCustomType ? 'font-medium' : ''
                    }`}
                    style={{
                      backgroundColor:
                        goalType === type && !isCustomType
                          ? 'var(--color-info)'
                          : 'var(--color-bg-secondary)',
                      color:
                        goalType === type && !isCustomType
                          ? 'white'
                          : 'var(--color-text-primary)',
                      borderColor: 'var(--color-border-primary)',
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {/* Lifestyle types */}
                <div className="w-full text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  Lifestyle:
                </div>
                {LIFESTYLE_GOAL_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setGoalType(type);
                      setIsCustomType(false);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                      goalType === type && !isCustomType ? 'font-medium' : ''
                    }`}
                    style={{
                      backgroundColor:
                        goalType === type && !isCustomType
                          ? 'var(--color-success)'
                          : 'var(--color-bg-secondary)',
                      color:
                        goalType === type && !isCustomType
                          ? 'white'
                          : 'var(--color-text-primary)',
                      borderColor: 'var(--color-border-primary)',
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {/* Custom type */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsCustomType(true)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1 ${
                    isCustomType ? 'font-medium' : ''
                  }`}
                  style={{
                    backgroundColor: isCustomType
                      ? 'var(--color-accent)'
                      : 'var(--color-bg-secondary)',
                    color: isCustomType ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                    borderColor: 'var(--color-border-primary)',
                  }}
                >
                  <Plus className="w-3 h-3" />
                  Custom
                </button>
                {isCustomType && (
                  <input
                    type="text"
                    value={customTypeName}
                    onChange={(e) => setCustomTypeName(e.target.value)}
                    placeholder="Type name..."
                    className="flex-1 px-2 py-1 text-xs rounded-lg border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderColor: errors.customType
                        ? 'var(--color-error)'
                        : 'var(--color-border-primary)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                )}
              </div>
              {errors.customType && (
                <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {errors.customType}
                </p>
              )}
            </div>
          </div>

          {/* Date Range */}
          <div>
            {!isTimeBased && (
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                Dates are optional for lifestyle goals. Leave empty for ongoing goals.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <DatePickerInput
                value={startDate}
                onChange={setStartDate}
                label="Start Date"
                required={isTimeBased}
                error={errors.startDate}
              />
              <DatePickerInput
                value={endDate}
                onChange={setEndDate}
                label="End Date"
                required={isTimeBased}
                error={errors.endDate}
                minDate={startDate ? new Date(startDate + 'T00:00:00') : undefined}
              />
            </div>
          </div>

          {/* End Time (for Daily goals) */}
          {goalType === 'Daily' && (
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                End Time (for countdown)
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          )}

          {/* Status Text (for lifestyle goals) */}
          {!isTimeBased && (
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Status Text (badge)
              </label>
              <input
                type="text"
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="e.g., 3/10 workouts, In progress..."
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Description
            </label>
            <RichTextEditor
              content={text}
              onChange={setText}
              placeholder="Add details, milestones, or notes..."
            />
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCountdown}
                onChange={(e) => setShowCountdown(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Show countdown
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Show on Daily View
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-primary)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-accent-text)',
              }}
            >
              {isEditing ? 'Save Changes' : 'Create Goal'}
            </button>
          </div>
        </form>
    </>
  );

  // Inline version - renders directly without modal overlay
  if (inline) {
    return (
      <div
        className="rounded-xl shadow-lg"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-primary)',
        }}
      >
        {formContent}
      </div>
    );
  }

  // Modal version - renders with overlay
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="min-h-full px-4 py-8">
        <div
          className="w-full max-w-lg mx-auto rounded-2xl shadow-2xl"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-primary)',
          }}
        >
          {formContent}
        </div>
      </div>
    </div>
  );
};

export default GoalForm;




