import { useState, useEffect } from 'react';
import { Check, Eye, EyeOff, Pencil, Trash2, Clock, Target, ChevronDown, ChevronUp } from 'lucide-react';
import type { Goal } from '../types';
import { TIME_BASED_GOAL_TYPES } from '../types';
import SimpleRichTextEditor from './SimpleRichTextEditor';

interface GoalCardProps {
  goal: Goal;
  viewedDate?: string;
  onUpdate?: (goalId: number, updates: Partial<Goal>) => void;
  onToggleComplete?: (goalId: number) => void;
  onToggleVisibility?: (goalId: number) => void;
  onDelete?: (goalId: number) => void;
  onEdit?: (goal: Goal) => void;
  editable?: boolean;
  showVisibilityToggle?: boolean;
  showDeleteButton?: boolean;
  compact?: boolean;
}

const GoalCard = ({
  goal,
  viewedDate,
  onUpdate,
  onToggleComplete,
  onToggleVisibility,
  onDelete,
  onEdit,
  editable = false,
  showVisibilityToggle = false,
  showDeleteButton = false,
  compact = false,
}: GoalCardProps) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(goal.text);

  // Determine if this is a time-based goal type
  const isTimeBased = TIME_BASED_GOAL_TYPES.includes(goal.goal_type as typeof TIME_BASED_GOAL_TYPES[number]);

  // Calculate days remaining display
  const getDaysRemainingText = () => {
    if (goal.days_remaining === undefined || goal.days_remaining === null) return null;
    if (goal.days_remaining > 0) return `${goal.days_remaining} days left`;
    if (goal.days_remaining === 0) return 'Today!';
    return `${Math.abs(goal.days_remaining)} days overdue`;
  };

  // Calculate if goal hasn't started yet
  const isNotStarted = viewedDate && goal.start_date > viewedDate;
  const getDaysUntilStart = () => {
    if (!viewedDate || !isNotStarted) return null;
    const start = new Date(goal.start_date);
    const from = new Date(viewedDate);
    const diffDays = Math.ceil((start.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return `${diffDays} days until start`;
  };

  // Get badge text (status_text takes priority for lifestyle goals, countdown for time-based)
  const getBadgeText = () => {
    if (isNotStarted) return getDaysUntilStart();
    if (!isTimeBased && goal.status_text) return goal.status_text;
    if (goal.show_countdown) return getDaysRemainingText();
    if (goal.status_text) return goal.status_text;
    return null;
  };

  const handleToggleComplete = async () => {
    if (!onToggleComplete) return;
    setIsCompleting(true);
    await onToggleComplete(goal.id);
    setTimeout(() => setIsCompleting(false), 400);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(goal.id, { text: editedText });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedText(goal.text);
    setIsEditing(false);
  };

  // Check if goal has actual content
  const hasContent = goal.text && goal.text.replace(/<[^>]*>/g, '').trim().length > 0;

  // Goal type badge styling
  const getTypeBadgeStyle = () => {
    if (goal.goal_type.startsWith('Custom:')) {
      return {
        backgroundColor: 'var(--color-accent)',
        color: 'var(--color-accent-text)',
      };
    }
    if (isTimeBased) {
      return {
        backgroundColor: `var(--color-info)`,
        color: 'white',
      };
    }
    return {
      backgroundColor: 'var(--color-success)',
      color: 'white',
    };
  };

  // Get display type name
  const getDisplayTypeName = () => {
    if (goal.goal_type.startsWith('Custom:')) {
      return goal.goal_type.replace('Custom:', '');
    }
    return goal.goal_type;
  };

  const badgeText = getBadgeText();

  return (
    <div
      className={`rounded-lg transition-all duration-200 ${
        goal.is_completed ? 'opacity-75' : ''
      } ${!goal.is_visible ? 'opacity-60' : ''}`}
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: `1px solid ${goal.is_completed ? 'var(--color-success)' : 'var(--color-border-primary)'}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 gap-3">
        {/* Complete button */}
        {onToggleComplete && (
          <button
            onClick={handleToggleComplete}
            className={`relative flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              isCompleting ? 'scale-110' : ''
            }`}
            style={{
              borderColor: goal.is_completed ? 'var(--color-success)' : 'var(--color-border-secondary)',
              backgroundColor: goal.is_completed ? 'var(--color-success)' : 'transparent',
            }}
            title={goal.is_completed ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {goal.is_completed && <Check className="w-4 h-4 text-white" />}
            {isCompleting && (
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: 'var(--color-success)', opacity: 0.4 }}
              />
            )}
          </button>
        )}

        {/* Title and type */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className={`font-semibold truncate ${goal.is_completed ? 'line-through' : ''}`}
              style={{ color: 'var(--color-text-primary)' }}
            >
              {goal.name}
            </h3>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={getTypeBadgeStyle()}
            >
              {getDisplayTypeName()}
            </span>
          </div>
          {!compact && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
              {goal.start_date} → {goal.end_date}
            </p>
          )}
        </div>

        {/* Badge (countdown or status) */}
        {badgeText && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              color: isNotStarted ? 'var(--color-text-secondary)' : 'var(--color-accent)',
              border: `1px solid ${isNotStarted ? 'var(--color-border-secondary)' : 'var(--color-accent)'}`,
            }}
          >
            {goal.show_countdown && !goal.status_text && <Clock className="w-3.5 h-3.5" />}
            <span className="text-xs font-bold whitespace-nowrap">{badgeText}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {showVisibilityToggle && onToggleVisibility && (
            <button
              onClick={() => onToggleVisibility(goal.id)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title={goal.is_visible ? 'Hide from Daily View' : 'Show on Daily View'}
            >
              {goal.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          )}
          {editable && onEdit && (
            <button
              onClick={() => onEdit(goal)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Edit goal"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {showDeleteButton && onDelete && (
            <button
              onClick={() => {
                if (window.confirm(`Delete goal "${goal.name}"?`)) {
                  onDelete(goal.id);
                }
              }}
              className="p-1.5 rounded-lg transition-colors hover:text-red-500"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Delete goal"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {hasContent && !compact && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Content (expandable) */}
      {hasContent && isExpanded && (
        <div
          className="px-3 pb-3 border-t"
          style={{ borderColor: 'var(--color-border-primary)' }}
        >
          {isEditing ? (
            <div className="pt-3">
              <SimpleRichTextEditor
                content={editedText}
                onChange={setEditedText}
                placeholder="Goal description..."
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-text)',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className="pt-3 prose prose-sm max-w-none cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
              onClick={() => editable && setIsEditing(true)}
            >
              <style>{`
                .goal-content h2 { font-size: 1.25em; font-weight: bold; margin-top: 0.5em; margin-bottom: 0.25em; }
                .goal-content h3 { font-size: 1.1em; font-weight: bold; margin-top: 0.5em; margin-bottom: 0.25em; }
                .goal-content ul { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
                .goal-content ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
                .goal-content a { color: var(--color-accent); text-decoration: underline; }
              `}</style>
              <div
                className="goal-content"
                dangerouslySetInnerHTML={{ __html: goal.text }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GoalCard;


