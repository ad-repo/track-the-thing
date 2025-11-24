import { useState, useEffect, useRef } from 'react';
import { X, Plus, Columns } from 'lucide-react';
import type { List } from '../types';
import { listsApi } from '../api';
import { normalizeColorForInput } from '../utils/color';

interface EntryListSelectorProps {
  entryId: number;
  currentLists: List[];
  onUpdate: () => void;
  onOptimisticUpdate?: (lists: List[]) => void;
}

const EntryListSelector = ({ entryId, currentLists, onOptimisticUpdate }: EntryListSelectorProps) => {
  const [allLists, setAllLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [localLists, setLocalLists] = useState<List[]>(currentLists);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListColor, setNewListColor] = useState('#3b82f6');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLists();
  }, []);

  useEffect(() => {
    setLocalLists(currentLists);
  }, [currentLists]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setShowCreateForm(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const loadLists = async () => {
    try {
      setLoading(true);
      const lists = await listsApi.getAll(false);
      setAllLists(lists);
    } catch (error) {
      console.error('Error loading lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const isInList = (listId: number) => {
    return localLists.some((list) => list.id === listId);
  };

  const handleToggleList = async (listId: number) => {
    const list = allLists.find(l => l.id === listId);
    if (!list) return;

    const inList = isInList(listId);
    
    // Optimistic update
    const newLists = inList 
      ? localLists.filter(l => l.id !== listId)
      : [...localLists, list];
    
    setLocalLists(newLists);
    if (onOptimisticUpdate) {
      onOptimisticUpdate(newLists);
    }

    try {
      setProcessing(true);
      if (inList) {
        await listsApi.removeEntry(listId, entryId);
      } else {
        await listsApi.addEntry(listId, entryId);
      }
    } catch (error: any) {
      console.error('Error toggling list membership:', error);
      // Revert on error
      setLocalLists(currentLists);
      if (onOptimisticUpdate) {
        onOptimisticUpdate(currentLists);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveFromList = async (listId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Optimistic update
    const newLists = localLists.filter(l => l.id !== listId);
    setLocalLists(newLists);
    if (onOptimisticUpdate) {
      onOptimisticUpdate(newLists);
    }

    try {
      setProcessing(true);
      await listsApi.removeEntry(listId, entryId);
    } catch (error: any) {
      console.error('Error removing from list:', error);
      // Revert on error
      setLocalLists(currentLists);
      if (onOptimisticUpdate) {
        onOptimisticUpdate(currentLists);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    try {
      setProcessing(true);
      const newList = await listsApi.create({
        name: newListName.trim(),
        description: newListDescription.trim(),
        color: newListColor,
        is_archived: false,
      });
      
      // Add the new list to allLists
      setAllLists([...allLists, newList]);
      
      // Optimistically update UI first
      const newLists = [...localLists, newList];
      setLocalLists(newLists);
      if (onOptimisticUpdate) {
        onOptimisticUpdate(newLists);
      }
      
      // Add entry to the new list
      await listsApi.addEntry(newList.id, entryId);
      
      // Reset form
      setNewListName('');
      setNewListDescription('');
      setNewListColor('#3b82f6');
      setShowCreateForm(false);
      
      // Don't call onUpdate() to avoid refresh
    } catch (error: any) {
      console.error('Error creating list:', error);
      // Revert on error
      setLocalLists(currentLists);
      if (onOptimisticUpdate) {
        onOptimisticUpdate(currentLists);
      }
      alert('Failed to create list');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Lists Display and Add Button */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        {/* Left: List Pills */}
        <div className="flex flex-wrap gap-2 items-center">
          {localLists.map((list) => (
            <button
              key={list.id}
              onClick={(e) => handleRemoveFromList(list.id, e)}
              disabled={processing}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium transition-all duration-200 hover:opacity-80 disabled:opacity-50"
              style={{ 
                backgroundColor: list.color,
                color: 'white',
              }}
              title="Click to remove"
            >
              <Columns className="h-3 w-3" />
              {list.name}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>

        {/* Right: Add to List Button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1 px-4 py-2 rounded-lg transition-colors ml-auto"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-accent-text)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent)'}
        >
          <Plus className="h-4 w-4" />
          Add to list
        </button>
      </div>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div
          className="absolute top-full right-0 mt-2 rounded-lg shadow-xl z-[100] max-h-96 overflow-y-auto"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-primary)',
            minWidth: '280px',
            maxWidth: '400px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          }}
        >
          {showCreateForm ? (
            /* Create New List Form */
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  Create New List
                </h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-1 rounded hover:bg-opacity-80"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="List name"
                    className="w-full px-3 py-2 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-primary)',
                    }}
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-primary)',
                    }}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Color
                  </label>
                  <input
                    type="color"
                    value={normalizeColorForInput(newListColor, '#3b82f6')}
                    onChange={(e) => setNewListColor(e.target.value)}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
                
                <button
                  onClick={handleCreateList}
                  disabled={!newListName.trim() || processing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-text)',
                  }}
                  onMouseEnter={(e) => {
                    if (newListName.trim() && !processing) {
                      e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-accent)';
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Create and Add
                </button>
              </div>
            </div>
          ) : (
            /* List Selection */
            <>
              {loading ? (
                <div className="p-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Loading lists...
                </div>
              ) : (
                <>
                  <div className="p-2">
                    {allLists.length === 0 ? (
                      <div className="p-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <p>No lists available</p>
                      </div>
                    ) : (
                      allLists.map((list) => {
                        const inList = isInList(list.id);
                        return (
                          <button
                            key={list.id}
                            onClick={() => handleToggleList(list.id)}
                            disabled={processing}
                            className="w-full p-2 rounded flex items-center gap-2 text-left transition-colors"
                            style={{
                              backgroundColor: inList ? list.color + '15' : 'transparent',
                              opacity: processing ? 0.6 : 1,
                              cursor: processing ? 'not-allowed' : 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              if (!processing) {
                                e.currentTarget.style.backgroundColor = inList ? list.color + '25' : 'var(--color-bg-hover)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!processing) {
                                e.currentTarget.style.backgroundColor = inList ? list.color + '15' : 'transparent';
                              }
                            }}
                          >
                            <div
                              className="w-3 h-3 rounded flex-shrink-0"
                              style={{ backgroundColor: list.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                                {list.name}
                              </div>
                              {list.description && (
                                <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                  {list.description}
                                </div>
                              )}
                            </div>
                            {inList && (
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: list.color }}
                              >
                                <span className="text-white text-xs">✓</span>
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  
                  {/* Create New List Button */}
                  <div 
                    className="p-2 border-t"
                    style={{ borderColor: 'var(--color-border-primary)' }}
                  >
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-primary)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      Create New List
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EntryListSelector;
