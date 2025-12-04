import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, BookOpen, Clock, Columns, Trello, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NoteEntry, List } from '../types';
import { useTimezone } from '../contexts/TimezoneContext';
import { useTransparentLabels } from '../contexts/TransparentLabelsContext';
import { formatTimestamp } from '../utils/timezone';
import { entriesApi } from '../api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ListCardProps {
  entry: NoteEntry;
  onRemoveFromList?: (entryId: number) => void;
  onUpdate: () => void;
  onLabelsUpdate: (entryId: number, labels: any[]) => void;
  listId?: number;
  list?: List;
  isKanbanView?: boolean;
  onArchive?: () => void;
}

const ListCard = ({ entry, onRemoveFromList, listId, list, isKanbanView, onArchive }: ListCardProps) => {
  const navigate = useNavigate();
  const { timezone } = useTimezone();
  const { transparentLabels } = useTransparentLabels();
  const [isDragging, setIsDragging] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ entryId: number; entryTitle: string } | null>(null);

  // Check if a label name is a custom emoji URL
  const isCustomEmojiUrl = (str: string): boolean => {
    return str.startsWith('/api/uploads/') || str.startsWith('http');
  };

  // Fix all API URLs in HTML content to use the actual API_URL
  const fixImageUrls = (html: string): string => {
    // Replace localhost:8000
    let fixed = html.replace(/http:\/\/localhost:8000/g, API_URL);
    // Replace any IP:8000 patterns (like 192.168.0.186:8000)
    fixed = fixed.replace(/http:\/\/[\d.]+:8000/g, API_URL);
    // Fix relative URLs - replace src="/api/uploads/ with src="API_URL/api/uploads/
    fixed = fixed.replace(/src="(\/api\/uploads\/[^"]*)"/g, `src="${API_URL}$1"`);
    // Also fix in case of single quotes
    fixed = fixed.replace(/src='(\/api\/uploads\/[^']*)'/g, `src='${API_URL}$1'`);
    return fixed;
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    // Use text/x- prefix for custom types per HTML5 spec
    e.dataTransfer.setData('text/x-entryid', entry.id.toString());
    e.dataTransfer.setData('text/x-sourcelistid', listId?.toString() || '');
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemoveFromList && listId) {
      setDeleteConfirmation({ entryId: entry.id, entryTitle: entry.title || 'this card' });
    }
  };

  const confirmDelete = () => {
    if (deleteConfirmation && onRemoveFromList) {
      onRemoveFromList(deleteConfirmation.entryId);
      setDeleteConfirmation(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };

  const handleViewInDaily = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.daily_note_date) {
      navigate(`/day/${entry.daily_note_date}?highlight=${entry.id}`);
    }
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await entriesApi.toggleArchive(entry.id);
      if (onArchive) {
        onArchive();
      }
    } catch (err) {
      console.error('Error archiving entry:', err);
    }
  };

  return (
    <div
      className="entry-card-container relative group"
      data-entry-id={entry.id}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      {/* Action buttons - always visible */}
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        {entry.daily_note_date && (
          <button
            onClick={handleViewInDaily}
            className="p-2 rounded-lg transition-all hover:scale-105"
            style={{
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
            title="Edit"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleArchive}
          className="p-2 rounded-lg transition-all hover:scale-105"
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
          title="Archive card"
        >
          <Archive className="w-4 h-4" />
        </button>
        {onRemoveFromList && listId && (
          <button
            onClick={handleRemove}
            className="p-2 rounded-lg transition-all hover:scale-105"
            style={{
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
            title="Remove from list"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Read-only card preview */}
      <div 
        className="rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl"
        style={{
          backgroundColor: 'var(--color-card-bg)',
          border: '2px solid var(--color-border-primary)',
          maxHeight: '500px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="p-6 flex-shrink-0">
          {/* Timestamp */}
          <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
            <Clock className="h-4 w-4" />
            <span>
              {formatTimestamp(entry.created_at, timezone, 'h:mm a zzz')}
            </span>
          </div>

          {/* Kanban Status - only on Lists page */}
          {!isKanbanView && entry.lists && (() => {
            const kanbanLists = entry.lists.filter(entryList => entryList.is_kanban);
            if (kanbanLists.length === 0) return null;
            
            return (
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {kanbanLists.map(kanbanList => (
                  <div key={kanbanList.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium"
                    style={{
                      backgroundColor: transparentLabels ? 'transparent' : kanbanList.color,
                      color: transparentLabels ? kanbanList.color : 'white',
                      border: transparentLabels ? `2px solid ${kanbanList.color}` : 'none',
                    }}
                  >
                    <Trello className="w-3 h-3" />
                    {kanbanList.name}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Regular Lists - exclude current list */}
          {entry.lists && (() => {
            const regularLists = entry.lists.filter(entryList => 
              !entryList.is_kanban && entryList.id !== listId
            );
            if (regularLists.length === 0) return null;
            
            return (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {regularLists.map(regularList => (
                  <div key={regularList.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium"
                    style={{
                      backgroundColor: transparentLabels ? 'transparent' : regularList.color,
                      color: transparentLabels ? regularList.color : 'white',
                      border: transparentLabels ? `2px solid ${regularList.color}` : 'none',
                    }}
                  >
                    <Columns className="h-3 w-3" />
                    {regularList.name}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Title (read-only) */}
          {entry.title && (
            <div className="mb-3 text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {entry.title}
            </div>
          )}

          {/* Labels (read-only) */}
          {entry.labels && entry.labels.length > 0 && (
            <div className="mb-3 pb-3 flex flex-wrap gap-2" style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              {entry.labels.map((label) => {
                const isCustomEmoji = isCustomEmojiUrl(label.name);
                
                if (isCustomEmoji) {
                  const imageUrl = label.name.startsWith('http') ? label.name : `${API_URL}${label.name}`;
                  return (
                    <img 
                      key={label.id}
                      src={imageUrl} 
                      alt="emoji" 
                      className="inline-emoji"
                      style={{ width: '1.5rem', height: '1.5rem' }}
                    />
                  );
                }
                
                return (
                  <span
                    key={label.id}
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: label.color + '20',
                      color: label.color,
                      border: `1px solid ${label.color}40`,
                    }}
                  >
                    {label.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Content (read-only, HTML rendered, links clickable, scrollable) */}
        <div 
          className="px-6 pb-6 overflow-y-auto custom-scrollbar flex-1"
          style={{ 
            minHeight: 0,
          }}
        >
          <div 
            className="prose prose-sm max-w-none"
            style={{ 
              color: 'var(--color-text-primary)',
              pointerEvents: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: fixImageUrls(entry.content) }}
            onClick={(e) => {
              // Only allow link clicks, prevent other interactions
              const target = e.target as HTMLElement;
              if (target.tagName !== 'A') {
                e.preventDefault();
              }
            }}
          />
        </div>
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
              Remove Card?
            </h2>
            
            <p
              className="mb-6 text-base"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Are you sure you want to remove <strong style={{ color: 'var(--color-text-primary)' }}>"{deleteConfirmation.entryTitle}"</strong> from this list?
              <br />
              <br />
              The card will not be deleted and can still be accessed from daily notes.
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
                Remove Card
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
    </div>
  );
};

export default ListCard;
