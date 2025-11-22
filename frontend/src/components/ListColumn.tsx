import { useState } from 'react';
import { Trash2, Archive, Plus, PlusCircle } from 'lucide-react';
import type { List, NoteEntry } from '../types';
import ListCard from './ListCard';
import AddEntryToListModal from './AddEntryToListModal';
import CreateEntryModal from './CreateEntryModal';
import { listsApi } from '../api';
import LabelSelector from './LabelSelector';
import { useTexture } from '../hooks/useTexture';

interface ListColumnProps {
  list: List;
  entries: NoteEntry[];
  onUpdate: () => void;
  onDelete: (listId: number, listName: string) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isKanbanView?: boolean;
}

const ListColumn = ({ list, entries, onUpdate, onDelete, onDragStart, onDragEnd, isDragging, isKanbanView }: ListColumnProps) => {
  const textureStyles = useTexture(isKanbanView ? 'kanban' : 'lists');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleRemoveEntry = async (entryId: number) => {
    try {
      await listsApi.removeEntry(list.id, entryId);
      onUpdate();
    } catch (error: any) {
      alert(error?.response?.data?.detail || 'Failed to remove entry from list');
      console.error('Error removing entry:', error);
    }
  };

  const handleArchive = async () => {
    try {
      await listsApi.update(list.id, { is_archived: !list.is_archived });
      onUpdate();
    } catch (error: any) {
      alert(error?.response?.data?.detail || 'Failed to update list');
      console.error('Error updating list:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    // MUST call preventDefault to allow drop, regardless of type
    e.preventDefault();
    
    const types = Array.from(e.dataTransfer.types);
    
    // If dragging a list, allow drop but don't handle it here - let it bubble
    if (types.includes('text/x-listid')) {
      return; // Let parent handle list reordering
    }
    
    // Only handle entry card drags
    if (!types.includes('text/x-entryid')) {
      return;
    }
    
    e.stopPropagation(); // Stop propagation only for entry drags
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // If dragging a list, let it bubble
    if (e.dataTransfer.types.includes('text/x-listid')) return;
    
    // Only handle if we were showing drag-over state
    if (!isDragOver) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); // Always prevent default for drop events
    
    // If dragging a list, let it bubble for list reordering (parent will handle)
    if (e.dataTransfer.types.includes('text/x-listid')) {
      setIsDragOver(false);
      return; // Don't stopPropagation - let parent handle it
    }
    
    const entryId = parseInt(e.dataTransfer.getData('text/x-entryid'));
    
    // If no entryId, let it bubble
    if (!entryId) {
      setIsDragOver(false);
      return;
    }
    
    // Entry drop - handle here and stop propagation
    e.stopPropagation();
    setIsDragOver(false);

    const sourceListId = parseInt(e.dataTransfer.getData('text/x-sourcelistid'));

    // Don't do anything if dropped on the same list
    if (sourceListId === list.id) return;

    try {
      // Remove from source list if it was in one
      if (sourceListId) {
        await listsApi.removeEntry(sourceListId, entryId);
      }
      
      // Add to target list
      await listsApi.addEntry(list.id, entryId);
      
      // Refresh the lists
      onUpdate();
    } catch (error: any) {
      alert(error?.response?.data?.detail || 'Failed to move entry');
      console.error('Error moving entry:', error);
    }
  };

  return (
    <>
      <div
        data-testid={`list-column-${list.id}`}
        className="flex-shrink-0 w-96 rounded-xl shadow-lg flex flex-col transition-all"
        style={{
          ...textureStyles,
          backgroundColor: isDragOver ? `${list.color}15` : 'var(--color-card-bg)',
          border: isDragOver ? `3px dashed ${list.color}` : '1px solid var(--color-border)',
          boxShadow: isDragOver 
            ? `0 0 20px ${list.color}40` 
            : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* List Header - Draggable */}
        <div
          data-testid={`list-header-${list.id}`}
          className="px-5 py-4 relative"
          style={{
            borderBottom: `3px solid ${list.color}`,
            background: `linear-gradient(135deg, ${list.color}08 0%, ${list.color}15 100%)`,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            WebkitUserDrag: 'element',
          } as React.CSSProperties}
          draggable="true"
          onDragStart={(e) => {
            e.dataTransfer.setData('text/x-listid', list.id.toString());
            e.dataTransfer.effectAllowed = 'move';
            onDragStart?.();
          }}
          onDragEnd={() => {
            onDragEnd?.();
          }}
          onMouseDown={(e) => {
            // If clicking a button, don't start drag
            const target = e.target as HTMLElement;
            if (target.closest('button')) {
              e.stopPropagation();
            }
          }}
        >
          <div className="mb-3">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0" style={{ pointerEvents: 'none' }}>
                <div
                  className="w-1 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: list.color }}
                />
                <h2
                  className="text-xl font-bold truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                  title={list.name}
                >
                  {list.name}
                </h2>
              </div>
              <div className="flex gap-1.5 ml-2" style={{ pointerEvents: 'auto' }} onMouseDown={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-2 rounded-lg transition-all hover:scale-105"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-accent)',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                  title="Create new card"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="p-2 rounded-lg transition-all hover:scale-105"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-accent)',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                  title="Add cards via search"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={handleArchive}
                  className="p-2 rounded-lg transition-all hover:scale-105"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                  title={list.is_archived ? 'Unarchive list' : 'Archive list'}
                >
                  <Archive className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(list.id, list.name)}
                  className="p-2 rounded-lg transition-all hover:scale-105"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                  title="Delete list"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Labels on a separate line */}
            <div className="mt-3 px-3" style={{ pointerEvents: 'auto' }} onMouseDown={(e) => e.stopPropagation()}>
              <LabelSelector
                selectedLabels={list.labels || []}
                onLabelsChange={() => {}}
                onOptimisticUpdate={async (labels) => {
                  // Handle label changes
                  const currentLabelIds = (list.labels || []).map(l => l.id);
                  const newLabelIds = labels.map(l => l.id);
                  const added = newLabelIds.filter(id => !currentLabelIds.includes(id));
                  const removed = currentLabelIds.filter(id => !newLabelIds.includes(id));
                  
                  try {
                    for (const labelId of added) {
                      await listsApi.addLabel(list.id, labelId);
                    }
                    for (const labelId of removed) {
                      await listsApi.removeLabel(list.id, labelId);
                    }
                  } catch (error) {
                    console.error('Error updating list labels:', error);
                    // Revert on error
                    onUpdate();
                  }
                }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-3">
            <span
              className="text-sm"
              style={{
                color: 'var(--color-text-secondary)',
              }}
            >
              {entries.length} {entries.length === 1 ? 'card' : 'cards'}
            </span>
          </div>
        </div>

        {/* List Content - No internal scrolling, let page scroll */}
        <div className="flex-1" style={{ padding: '20px' }}>
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <div
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: list.color + '20' }}
              >
                <Plus className="w-8 h-8" style={{ color: list.color }} />
              </div>
              <p className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                No cards yet
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Drag cards here or add from daily notes
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <ListCard
                  key={entry.id}
                  entry={entry}
                  listId={list.id}
                  list={list}
                  onRemoveFromList={handleRemoveEntry}
                  onUpdate={onUpdate}
                  onLabelsUpdate={() => {
                    // Refresh the list to get updated entry data
                    onUpdate();
                  }}
                  isKanbanView={isKanbanView}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <AddEntryToListModal
          list={list}
          onClose={() => setShowAddModal(false)}
          onUpdate={onUpdate}
        />
      )}

      {/* Create Entry Modal */}
      {showCreateModal && (
        <CreateEntryModal
          list={list}
          onClose={() => setShowCreateModal(false)}
          onSuccess={onUpdate}
        />
      )}
    </>
  );
};

export default ListColumn;

