import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive as ArchiveIcon, RotateCcw, Columns, BookOpen, Clock, List, LayoutGrid } from 'lucide-react';
import { listsApi, entriesApi } from '../api';
import { ListWithEntries, NoteEntry } from '../types';
import { useTimezone } from '../contexts/TimezoneContext';
import { formatTimestamp } from '../utils/timezone';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Check if a label name is a custom emoji URL
const isCustomEmojiUrl = (str: string): boolean => {
  return str.startsWith('/api/uploads/') || str.startsWith('http');
};

export default function Archive() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { timezone } = useTimezone();
  const [archivedLists, setArchivedLists] = useState<ListWithEntries[]>([]);
  const [archivedEntries, setArchivedEntries] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringListId, setRestoringListId] = useState<number | null>(null);
  const [restoringEntryId, setRestoringEntryId] = useState<number | null>(null);
  
  // Get active tab from URL, default to 'all'
  const activeTab = searchParams.get('tab') || 'all';
  
  // View mode: 'list' or 'preview'
  const [viewMode, setViewMode] = useState<'list' | 'preview'>(() => {
    return (localStorage.getItem('archive-view-mode') as 'list' | 'preview') || 'list';
  });
  
  const toggleViewMode = () => {
    const newMode = viewMode === 'list' ? 'preview' : 'list';
    setViewMode(newMode);
    localStorage.setItem('archive-view-mode', newMode);
  };
  
  const setActiveTab = (tab: string) => {
    if (tab === 'all') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams);
  };

  const loadArchived = useCallback(async () => {
    try {
      setLoading(true);
      const [lists, entries] = await Promise.all([
        listsApi.getArchived(),
        entriesApi.getArchived(),
      ]);
      setArchivedLists(lists);
      setArchivedEntries(entries);
      setError(null);
    } catch (err) {
      console.error('Error loading archived items:', err);
      setError('Failed to load archived items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchived();
  }, [loadArchived]);

  const handleRestoreList = async (listId: number) => {
    setRestoringListId(listId);
    // Optimistic update - remove from list immediately
    const previousLists = archivedLists;
    setArchivedLists(prev => prev.filter(l => l.id !== listId));
    
    try {
      await listsApi.update(listId, { is_archived: false });
    } catch (err) {
      console.error('Error restoring list:', err);
      // Revert on error
      setArchivedLists(previousLists);
    } finally {
      setRestoringListId(null);
    }
  };

  const handleRestoreEntry = async (entryId: number) => {
    setRestoringEntryId(entryId);
    // Optimistic update - remove from list immediately
    const previousEntries = archivedEntries;
    setArchivedEntries(prev => prev.filter(e => e.id !== entryId));
    
    try {
      await entriesApi.toggleArchive(entryId);
    } catch (err) {
      console.error('Error restoring entry:', err);
      // Revert on error
      setArchivedEntries(previousEntries);
    } finally {
      setRestoringEntryId(null);
    }
  };

  // Fix API URLs in HTML content
  const fixImageUrls = (html: string): string => {
    let fixed = html.replace(/http:\/\/localhost:8000/g, API_URL);
    fixed = fixed.replace(/http:\/\/[\d.]+:8000/g, API_URL);
    fixed = fixed.replace(/src="(\/api\/uploads\/[^"]*)"/g, `src="${API_URL}$1"`);
    fixed = fixed.replace(/src='(\/api\/uploads\/[^']*)'/g, `src='${API_URL}$1'`);
    return fixed;
  };

  // Strip HTML for preview
  const stripHtml = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <div className="animate-pulse" style={{ color: 'var(--color-text-secondary)' }}>
            Loading archive...
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
            onClick={() => loadArchived()}
            className="mt-4 px-4 py-2 rounded"
            style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isEmpty = archivedLists.length === 0 && archivedEntries.length === 0;

  return (
    <div className="min-h-screen page-fade-in" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <ArchiveIcon className="h-8 w-8" style={{ color: 'var(--color-text-secondary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Archive
          </h1>
        </div>

        {/* Tabs and View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'All', count: archivedLists.length + archivedEntries.length },
              { id: 'lists', label: 'Lists', count: archivedLists.length, icon: Columns },
              { id: 'cards', label: 'Cards', count: archivedEntries.length, icon: BookOpen },
            ].map(({ id, label, count, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
                style={{
                  backgroundColor: activeTab === id ? 'var(--color-accent)' : 'var(--color-background)',
                  color: activeTab === id ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
                  border: activeTab === id ? 'none' : '1px solid var(--color-border-primary)',
                }}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {label}
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: activeTab === id ? 'rgba(255,255,255,0.2)' : 'var(--color-bg-secondary)',
                  }}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
          
          {/* View Toggle */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--color-border-primary)' }}
          >
            <button
              onClick={() => { setViewMode('list'); localStorage.setItem('archive-view-mode', 'list'); }}
              className="p-2 transition-all"
              style={{
                backgroundColor: viewMode === 'list' ? 'var(--color-accent)' : 'var(--color-background)',
                color: viewMode === 'list' ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
              }}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setViewMode('preview'); localStorage.setItem('archive-view-mode', 'preview'); }}
              className="p-2 transition-all"
              style={{
                backgroundColor: viewMode === 'preview' ? 'var(--color-accent)' : 'var(--color-background)',
                color: viewMode === 'preview' ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
              }}
              title="Preview view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isEmpty ? (
          <div className="text-center py-16">
            <div
              className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'var(--color-accent)' + '20' }}
            >
              <ArchiveIcon className="w-12 h-12" style={{ color: 'var(--color-accent)' }} />
            </div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              No archived items
            </h2>
            <p className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>
              Items you archive will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Archived Lists Section */}
            {archivedLists.length > 0 && (activeTab === 'all' || activeTab === 'lists') && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                  <Columns className="h-5 w-5" />
                  Archived Lists
                  <span className="text-sm font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                    ({archivedLists.length})
                  </span>
                </h2>
                
                {viewMode === 'list' ? (
                  /* List View */
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {archivedLists.map((list) => (
                      <div
                        key={list.id}
                        className="rounded-xl p-5 transition-all"
                        style={{
                          backgroundColor: 'var(--color-card-bg)',
                          border: '2px solid var(--color-border-primary)',
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: list.color }}
                            />
                            <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                              {list.name}
                            </h3>
                          </div>
                          <button
                            onClick={() => handleRestoreList(list.id)}
                            disabled={restoringListId === list.id}
                            className="p-2 rounded-lg transition-all hover:scale-105"
                            style={{
                              backgroundColor: 'var(--color-accent)',
                              color: 'var(--color-accent-text)',
                              opacity: restoringListId === list.id ? 0.5 : 1,
                            }}
                            title="Restore list"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                        {list.description && (
                          <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            {list.description}
                          </p>
                        )}
                        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {list.entry_count || list.entries?.length || 0} cards
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Preview View - Shows list with cards inside */
                  <div className="space-y-6">
                    {archivedLists.map((list) => (
                      <div
                        key={list.id}
                        className="rounded-xl overflow-hidden relative"
                        style={{
                          backgroundColor: 'var(--color-card-bg)',
                          border: '2px solid var(--color-border-primary)',
                        }}
                      >
                        {/* Restore Button - Outside faded area */}
                        <div className="absolute top-4 right-5 z-10">
                          <button
                            onClick={() => handleRestoreList(list.id)}
                            disabled={restoringListId === list.id}
                            className="p-2 rounded-lg transition-all hover:scale-105 shadow-lg"
                            style={{
                              backgroundColor: 'var(--color-accent)',
                              color: 'var(--color-accent-text)',
                              opacity: restoringListId === list.id ? 0.5 : 1,
                            }}
                            title="Restore list"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Faded Content */}
                        <div style={{ opacity: 0.5, filter: 'saturate(0.4)' }}>
                          {/* List Header */}
                          <div
                            className="px-5 py-4 relative"
                            style={{
                              borderBottom: `3px solid ${list.color}`,
                              background: `linear-gradient(135deg, ${list.color}08 0%, ${list.color}15 100%)`,
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: list.color }}
                                />
                                <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                                  {list.name}
                                </h3>
                                <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                                  ({list.entries?.length || 0} cards)
                                </span>
                              </div>
                            </div>
                          {list.description && (
                            <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                              {list.description}
                            </p>
                          )}
                          {/* List Labels */}
                          {list.labels && list.labels.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {list.labels.map((label) => {
                                const isEmoji = isCustomEmojiUrl(label.name);
                                if (isEmoji) {
                                  const imageUrl = label.name.startsWith('http') ? label.name : `${API_URL}${label.name}`;
                                  return (
                                    <img
                                      key={label.id}
                                      src={imageUrl}
                                      alt="emoji"
                                      className="inline-block"
                                      style={{ width: '1.5rem', height: '1.5rem' }}
                                    />
                                  );
                                }
                                return (
                                  <span
                                    key={label.id}
                                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{
                                      backgroundColor: label.color + '20',
                                      color: label.color,
                                    }}
                                  >
                                    {label.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        {/* Cards Preview */}
                        {list.entries && list.entries.length > 0 && (
                          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {list.entries.slice(0, 6).map((entry) => (
                              <div
                                key={entry.id}
                                className="rounded-lg p-4"
                                style={{
                                  backgroundColor: 'var(--color-background)',
                                  border: '1px solid var(--color-border-primary)',
                                }}
                              >
                                {/* Card Title */}
                                {entry.title && (
                                  <h4 className="font-medium mb-2 truncate" style={{ color: 'var(--color-text-primary)' }}>
                                    {entry.title}
                                  </h4>
                                )}
                                
                                {/* Card Labels */}
                                {entry.labels && entry.labels.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {entry.labels.slice(0, 4).map((label) => {
                                      const isEmoji = isCustomEmojiUrl(label.name);
                                      if (isEmoji) {
                                        const imageUrl = label.name.startsWith('http') ? label.name : `${API_URL}${label.name}`;
                                        return (
                                          <img
                                            key={label.id}
                                            src={imageUrl}
                                            alt="emoji"
                                            className="inline-block"
                                            style={{ width: '1.25rem', height: '1.25rem' }}
                                          />
                                        );
                                      }
                                      return (
                                        <span
                                          key={label.id}
                                          className="px-1.5 py-0.5 rounded text-xs"
                                          style={{
                                            backgroundColor: label.color + '20',
                                            color: label.color,
                                          }}
                                        >
                                          {label.name}
                                        </span>
                                      );
                                    })}
                                    {entry.labels.length > 4 && (
                                      <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                                        +{entry.labels.length - 4}
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {/* Card Content */}
                                <p
                                  className="text-sm line-clamp-2"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                >
                                  {stripHtml(entry.content)}
                                </p>
                              </div>
                            ))}
                            {list.entries.length > 6 && (
                              <div
                                className="rounded-lg p-4 flex items-center justify-center"
                                style={{
                                  backgroundColor: 'var(--color-bg-secondary)',
                                  border: '1px dashed var(--color-border-primary)',
                                }}
                              >
                                <span style={{ color: 'var(--color-text-tertiary)' }}>
                                  +{list.entries.length - 6} more cards
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Archived Cards Section */}
            {archivedEntries.length > 0 && (activeTab === 'all' || activeTab === 'cards') && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                  <BookOpen className="h-5 w-5" />
                  Archived Cards
                  <span className="text-sm font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                    ({archivedEntries.length})
                  </span>
                </h2>
                
                {viewMode === 'list' ? (
                  /* List View - Compact cards */
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {archivedEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl p-5 transition-all"
                        style={{
                          backgroundColor: 'var(--color-card-bg)',
                          border: '2px solid var(--color-border-primary)',
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            {entry.title && (
                              <h3 className="font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                {entry.title}
                              </h3>
                            )}
                            <div className="flex items-center gap-2 text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                              <Clock className="h-3 w-3" />
                              <span>{formatTimestamp(entry.created_at, timezone, 'MMM d, yyyy')}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRestoreEntry(entry.id)}
                            disabled={restoringEntryId === entry.id}
                            className="p-2 rounded-lg transition-all hover:scale-105 ml-2"
                            style={{
                              backgroundColor: 'var(--color-accent)',
                              color: 'var(--color-accent-text)',
                              opacity: restoringEntryId === entry.id ? 0.5 : 1,
                            }}
                            title="Restore card"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Labels */}
                        {entry.labels && entry.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {entry.labels.slice(0, 3).map((label) => {
                              const isEmoji = isCustomEmojiUrl(label.name);
                              if (isEmoji) {
                                const imageUrl = label.name.startsWith('http') ? label.name : `${API_URL}${label.name}`;
                                return (
                                  <img
                                    key={label.id}
                                    src={imageUrl}
                                    alt="emoji"
                                    className="inline-block"
                                    style={{ width: '1.25rem', height: '1.25rem' }}
                                  />
                                );
                              }
                              return (
                                <span
                                  key={label.id}
                                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: label.color + '20',
                                    color: label.color,
                                  }}
                                >
                                  {label.name}
                                </span>
                              );
                            })}
                            {entry.labels.length > 3 && (
                              <span
                                className="px-2 py-0.5 rounded-full text-xs"
                                style={{ color: 'var(--color-text-tertiary)' }}
                              >
                                +{entry.labels.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Content Preview - Short */}
                        <p
                          className="text-sm line-clamp-2"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {stripHtml(fixImageUrls(entry.content))}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Preview View - Full card content */
                  <div className="grid gap-6 lg:grid-cols-2">
                    {archivedEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl shadow-lg overflow-hidden relative"
                        style={{
                          backgroundColor: 'var(--color-card-bg)',
                          border: '2px solid var(--color-border-primary)',
                        }}
                      >
                        {/* Restore Button - Outside faded area */}
                        <div className="absolute top-6 right-6 z-10">
                          <button
                            onClick={() => handleRestoreEntry(entry.id)}
                            disabled={restoringEntryId === entry.id}
                            className="p-2 rounded-lg transition-all hover:scale-105 shadow-lg"
                            style={{
                              backgroundColor: 'var(--color-accent)',
                              color: 'var(--color-accent-text)',
                              opacity: restoringEntryId === entry.id ? 0.5 : 1,
                            }}
                            title="Restore card"
                          >
                            <RotateCcw className="w-5 h-5" />
                          </button>
                        </div>
                        
                        {/* Faded Content */}
                        <div style={{ opacity: 0.5, filter: 'saturate(0.4)' }}>
                          <div className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1 min-w-0 pr-24">
                                {entry.title && (
                                  <h3 className="font-bold text-xl mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                    {entry.title}
                                  </h3>
                                )}
                                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                                  <Clock className="h-4 w-4" />
                                  <span>{formatTimestamp(entry.created_at, timezone, 'MMM d, yyyy \'at\' h:mm a')}</span>
                                </div>
                              </div>
                            </div>

                            {/* Labels */}
                            {entry.labels && entry.labels.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-4 pb-4" style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                {entry.labels.map((label) => {
                                  const isEmoji = isCustomEmojiUrl(label.name);
                                  if (isEmoji) {
                                    const imageUrl = label.name.startsWith('http') ? label.name : `${API_URL}${label.name}`;
                                    return (
                                      <img
                                        key={label.id}
                                        src={imageUrl}
                                        alt="emoji"
                                        className="inline-block"
                                        style={{ width: '1.75rem', height: '1.75rem' }}
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

                            {/* Full Content */}
                            <div
                              className="prose prose-sm max-w-none"
                              style={{ color: 'var(--color-text-primary)' }}
                              dangerouslySetInnerHTML={{ __html: fixImageUrls(entry.content) }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
