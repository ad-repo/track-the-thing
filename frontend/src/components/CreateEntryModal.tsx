import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { notesApi, entriesApi, listsApi } from '../api';
import type { List, NoteEntry } from '../types';
import NoteEntryCard from './NoteEntryCard';

interface CreateEntryModalProps {
  list?: List;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateEntryModal = ({ list, onClose, onSuccess }: CreateEntryModalProps) => {
  const [entry, setEntry] = useState<NoteEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const entryRef = useRef<NoteEntry | null>(null);

  const setEntryState = (value: NoteEntry | null) => {
    entryRef.current = value;
    setEntry(value);
  };

  // Create entry on mount
  useEffect(() => {
    createInitialEntry();
  }, []);

  // Add Escape key support
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [entry]);

  const createInitialEntry = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get today's date
      const today = format(new Date(), 'yyyy-MM-dd');

      // Get or create today's note
      try {
        await notesApi.getByDate(today);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          await notesApi.create({ date: today });
        } else {
          throw err;
        }
      }

      // Create the entry with minimal content
      const newEntry = await entriesApi.create(today, {
        title: '',
        content: '',
        content_type: 'rich_text',
        order_index: 0,
      });

      // Add to list if provided
      if (list) {
        await listsApi.addEntry(list.id, newEntry.id);
      }

      setEntryState(newEntry);
    } catch (err: any) {
      console.error('Error creating entry:', err);
      setError(err?.response?.data?.detail || 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // If entry exists and is empty, delete it
    const currentEntry = entryRef.current;
    if (currentEntry) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = currentEntry.content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      
      if (!textContent.trim() && !currentEntry.title?.trim()) {
        // Delete empty entry
        entriesApi.delete(currentEntry.id).catch(err => {
          console.error('Error deleting empty entry:', err);
        });
      }
    }
    onClose();
  };

  const handleEntryUpdate = async (id: number, content: string) => {
    if (entryRef.current) {
      setEntryState({ ...entryRef.current, content });
    }
  };

  const handleEntryDelete = async (id: number) => {
    onClose();
  };

  const handleLabelsUpdate = (entryId: number, labels: any[]) => {
    if (entryRef.current) {
      setEntryState({ ...entryRef.current, labels });
    }
  };

  const handleListsOptimisticUpdate = (entryId: number, lists: any[]) => {
    if (entryRef.current) {
      setEntryState({ ...entryRef.current, lists });
    }
  };

  const handleTitleUpdate = (entryId: number, title: string) => {
    if (entryRef.current) {
      setEntryState({ ...entryRef.current, title });
    }
  };

  const handleListsUpdate = () => {
    onSuccess();
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        zIndex: 10000,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleClose}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-4xl flex flex-col"
        style={{
          backgroundColor: 'var(--color-card-bg)',
          border: '1px solid var(--color-border)',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex justify-between items-center flex-shrink-0"
          style={{
            borderColor: 'var(--color-border)',
            borderBottom: list ? `3px solid ${list.color}` : '3px solid var(--color-accent)',
          }}
        >
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Create New Card
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {list ? `Card will be added to "${list.name}" and today's notes` : "Card will be added to today's notes"}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="p-2 rounded-lg transition-all hover:scale-110"
            style={{
              color: 'var(--color-text-secondary)',
              backgroundColor: 'var(--color-background)',
            }}
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
              Creating entry...
            </div>
          ) : error ? (
            <div className="text-center py-8" style={{ color: 'var(--color-danger, red)' }}>
              {error}
            </div>
          ) : entry ? (
            <NoteEntryCard
              entry={entry}
              onUpdate={handleEntryUpdate}
              onDelete={handleEntryDelete}
              onLabelsUpdate={handleLabelsUpdate}
              onListsOptimisticUpdate={handleListsOptimisticUpdate}
              onTitleUpdate={handleTitleUpdate}
              onListsUpdate={handleListsUpdate}
              selectionMode={false}
              isSelected={false}
              onSelectionChange={() => {}}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateEntryModal;
