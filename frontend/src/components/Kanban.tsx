import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ListWithEntries } from '../types';
import { kanbanApi, listsApi } from '../api';
import ListColumn from './ListColumn';
import { Plus } from 'lucide-react';
import { normalizeColorForInput } from '../utils/color';

export default function Kanban() {
  const [boards, setBoards] = useState<ListWithEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnDescription, setNewColumnDescription] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('#3b82f6');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [draggedListId, setDraggedListId] = useState<number | null>(null);
  const [dragOverListId, setDragOverListId] = useState<number | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ listId: number; listName: string } | null>(null);

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const kanbanBoards = await kanbanApi.getBoards();
      setBoards(kanbanBoards);
      setError(null);
    } catch (err) {
      setError('Failed to load Kanban board');
      console.error('Error loading Kanban board:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleInitializeKanban = async () => {
    try {
      await kanbanApi.initialize();
      loadBoards(true);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to initialize Kanban board');
      console.error('Error initializing Kanban:', err);
    }
  };

  const handleCreateColumn = async () => {
    if (!newColumnName.trim()) {
      alert('Column name is required');
      return;
    }

    try {
      await listsApi.create({
        name: newColumnName,
        description: newColumnDescription,
        color: newColumnColor,
        is_kanban: true,
        kanban_order: boards.length,
      });
      setNewColumnName('');
      setNewColumnDescription('');
      setNewColumnColor('#3b82f6');
      setShowCreateModal(false);
      loadBoards(true);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to create column');
      console.error('Error creating column:', err);
    }
  };

  const handleDeleteColumn = (listId: number, listName: string) => {
    setDeleteConfirmation({ listId, listName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;

    try {
      await listsApi.delete(deleteConfirmation.listId);
      loadBoards(true);
      setDeleteConfirmation(null);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to delete column');
      console.error('Error deleting column:', err);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || boards.length === 0) return;

    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth - container.clientWidth;
    const progress = scrollWidth > 0 ? scrollLeft / scrollWidth : 0;
    setScrollProgress(progress);
  }, [boards.length]);

  const handleListDragStart = (listId: number) => {
    setDraggedListId(listId);
  };

  const handleListDragOver = (e: React.DragEvent, listId: number) => {
    e.preventDefault();
    if (draggedListId === null || draggedListId === listId) return;
    setDragOverListId(listId);
  };

  const handleListDragLeave = () => {
    setDragOverListId(null);
  };

  const handleListDrop = async (e: React.DragEvent, targetListId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedListId === null || draggedListId === targetListId) {
      setDraggedListId(null);
      setDragOverListId(null);
      return;
    }

    try {
      const draggedIndex = boards.findIndex((b) => b.id === draggedListId);
      const targetIndex = boards.findIndex((b) => b.id === targetListId);

      if (draggedIndex === -1 || targetIndex === -1) {
        return;
      }

      const newBoards = [...boards];
      const [removed] = newBoards.splice(draggedIndex, 1);
      newBoards.splice(targetIndex, 0, removed);

      const reorderedBoards = newBoards.map((board, index) => ({
        id: board.id,
        order_index: index,
      }));

      setBoards(newBoards);
      setDraggedListId(null);
      setDragOverListId(null);

      await kanbanApi.reorderColumns(reorderedBoards);
    } catch (err: any) {
      console.error('Error reordering columns:', err);
      await loadBoards(true);
    }
  };

  const handleListDragEnd = () => {
    setDraggedListId(null);
    setDragOverListId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <div className="animate-pulse" style={{ color: 'var(--color-text-secondary)' }}>
            Loading Kanban board...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <div className="text-red-500 text-lg">{error}</div>
          <button
            onClick={() => loadBoards()}
            className="mt-4 px-4 py-2 rounded"
            style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex flex-col page-fade-in" style={{ backgroundColor: 'var(--color-background)' }}>
        {/* Kanban Board Container */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-x-auto py-6 pb-20" 
          style={{ position: 'relative' }}
        >
        {isRefreshing && (
          <div className="absolute top-2 right-2 z-10 px-3 py-1 rounded-full text-xs" style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}>
            Updating...
          </div>
        )}
        {boards.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-full sm:max-w-md p-4 sm:p-8">
              <div className="mb-6">
                <div
                  className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'var(--color-accent)' + '20' }}
                >
                  <Plus className="w-12 h-12" style={{ color: 'var(--color-accent)' }} />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                No Kanban board yet
              </h2>
              <p className="mb-6 text-lg" style={{ color: 'var(--color-text-secondary)' }}>
                Initialize your Kanban board with default columns or create custom ones
              </p>
              <button
                onClick={handleInitializeKanban}
                className="px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'white',
                }}
              >
                Initialize Kanban Board
              </button>
            </div>
          </div>
        ) : (
          <div 
            className="flex gap-6 py-6 items-start justify-start"
            style={{
              paddingLeft: '3rem',
              paddingRight: '3rem',
            }}
          >
            {boards.map((board) => (
              <div
                key={board.id}
                onDragOver={(e) => handleListDragOver(e, board.id)}
                onDragLeave={handleListDragLeave}
                onDrop={(e) => handleListDrop(e, board.id)}
                style={{
                  opacity: draggedListId === board.id ? 0.5 : 1,
                  ...(dragOverListId === board.id && draggedListId !== board.id && { transform: 'scale(1.02)' }),
                  transition: 'transform 0.2s ease, opacity 0.2s ease',
                }}
              >
                <ListColumn
                  list={board}
                  entries={board.entries}
                  onUpdate={() => loadBoards(true)}
                  onDelete={handleDeleteColumn}
                  onDragStart={() => handleListDragStart(board.id)}
                  isKanbanView={true}
                  onDragEnd={handleListDragEnd}
                  isDragging={draggedListId === board.id}
                />
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Floating Action Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="fixed top-4 left-4 w-12 h-12 rounded-full shadow-lg transition-all hover:scale-110 hover:shadow-xl flex items-center justify-center z-40"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'white',
            boxShadow: '0 6px 16px -5px rgba(0, 0, 0, 0.3), 0 4px 6px -6px rgba(0, 0, 0, 0.3)',
          }}
          title="Create New Column"
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </button>

        {/* Create Column Modal */}
        {showCreateModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="rounded-xl shadow-2xl p-4 sm:p-6 w-full max-w-full sm:max-w-md mx-4"
              style={{
                backgroundColor: 'var(--color-card-bg)',
                border: '1px solid var(--color-border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                className="text-2xl font-bold mb-6"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Create New Column
              </h2>

              <div className="space-y-5">
                <div>
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Column Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateColumn()}
                    className="w-full px-4 py-2.5 rounded-lg border-2 focus:outline-none focus:ring-2 transition-all"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                    placeholder="e.g., Blocked, Review, Testing"
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Description
                  </label>
                  <textarea
                    value={newColumnDescription}
                    onChange={(e) => setNewColumnDescription(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border-2 focus:outline-none focus:ring-2 transition-all resize-none"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                    placeholder="Add a description (optional)"
                    rows={3}
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Color Theme
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={normalizeColorForInput(newColumnColor, '#3b82f6')}
                      onChange={(e) => setNewColumnColor(e.target.value)}
                      className="w-16 h-12 rounded-lg border-2 cursor-pointer"
                      style={{
                        borderColor: 'var(--color-border)',
                      }}
                    />
                    <div
                      className="flex-1 px-4 py-2.5 rounded-lg border-2 font-mono text-sm"
                      style={{
                        backgroundColor: 'var(--color-background)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {newColumnColor.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={handleCreateColumn}
                  className="flex-1 px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'white',
                  }}
                >
                  Create Column
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewColumnName('');
                    setNewColumnDescription('');
                    setNewColumnColor('#3b82f6');
                  }}
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
          </div>
        )}

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
              className="rounded-xl shadow-2xl p-4 sm:p-6 w-full max-w-full sm:max-w-md mx-4"
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
                Delete Column?
              </h2>
              
              <p
                className="mb-6 text-base"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Are you sure you want to delete <strong style={{ color: 'var(--color-text-primary)' }}>"{deleteConfirmation.listName}"</strong>?
                <br />
                <br />
                Cards will not be deleted and can still be accessed from daily notes.
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
                  Delete Column
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

      {/* Scroll Indicator - Outside page-fade-in container */}
      {boards.length > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
          <div 
            className="flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl backdrop-blur-sm"
            style={{
              backgroundColor: 'var(--color-card-bg)' + 'f0',
              border: '2px solid var(--color-border)',
            }}
          >
            <span 
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {boards.length} {boards.length === 1 ? 'column' : 'columns'}
            </span>
            {boards.length > 1 && (
              <>
                <div 
                  className="w-px h-4" 
                  style={{ backgroundColor: 'var(--color-border)' }}
                />
                <div className="flex gap-2">
                  {boards.map((board, index) => {
                    const boardProgress = index / Math.max(boards.length - 1, 1);
                    const isActive = Math.abs(scrollProgress - boardProgress) < 0.35;
                    
                    return (
                      <div
                        key={board.id}
                        className="w-2.5 h-2.5 rounded-full transition-all duration-200"
                        style={{
                          backgroundColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
                          transform: isActive ? 'scale(1.4)' : 'scale(1)',
                          boxShadow: isActive ? `0 0 8px ${board.color}` : 'none',
                        }}
                        title={board.name}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
