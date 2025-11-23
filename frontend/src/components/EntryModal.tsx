import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { notesApi, entriesApi } from '../api';
import type { NoteEntry, Label } from '../types';
import NoteEntryCard from './NoteEntryCard';

interface EntryModalProps {
  entryId: number;
  onClose: () => void;
  onUpdate?: () => void; // Callback to refresh parent component
}

const EntryModal = ({ entryId, onClose, onUpdate }: EntryModalProps) => {
  const [entry, setEntry] = useState<NoteEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEntry();
  }, [entryId]);

  const loadEntry = async () => {
    try {
      setLoading(true);
      // First fetch all notes to find which date contains this entry
      const allNotes = await notesApi.getAll();
      let foundEntry: NoteEntry | null = null;
      
      for (const note of allNotes) {
        const matchingEntry = note.entries.find((e) => e.id === entryId);
        if (matchingEntry) {
          foundEntry = matchingEntry;
          break;
        }
      }
      
      if (foundEntry) {
        setEntry(foundEntry);
      } else {
        setError('Entry not found');
      }
    } catch (err) {
      console.error('Error loading entry:', err);
      setError('Failed to load entry');
    } finally {
      setLoading(false);
    }
  };

  const handleEntryUpdate = async (id: number, content: string) => {
    try {
      // Update the entry
      if (entry) {
        setEntry({ ...entry, content });
      }
      onUpdate?.();
    } catch (err) {
      console.error('Error updating entry:', err);
    }
  };

  const handleEntryDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
      return;
    }
    
    try {
      await entriesApi.delete(id);
      onUpdate?.();
      onClose();
    } catch (err) {
      console.error('Error deleting entry:', err);
      alert('Failed to delete entry. Please try again.');
    }
  };

  const handleLabelsUpdate = (entryId: number, labels: Label[]) => {
    if (entry) {
      setEntry({ ...entry, labels });
    }
    onUpdate?.();
  };

  const handleTitleUpdate = (entryId: number, title: string) => {
    if (entry) {
      setEntry({ ...entry, title });
    }
    onUpdate?.();
  };

  const handleMoveToTop = async () => {
    // Not applicable in modal view
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close modal when clicking outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar relative"
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-opacity-80 z-10"
          style={{
            backgroundColor: 'var(--color-card-bg)',
            color: 'var(--color-text-primary)',
          }}
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
              Loading entry...
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
              onTitleUpdate={handleTitleUpdate}
              onMoveToTop={handleMoveToTop}
              selectionMode={false}
              isSelected={false}
              onSelectionChange={() => {}}
            />
          ) : (
            <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
              Entry not found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntryModal;

