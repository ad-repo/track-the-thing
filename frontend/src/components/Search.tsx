import { useState, useEffect } from 'react';
import { Search as SearchIcon, X, Star, CheckCircle, Columns, Trello, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import type { NoteEntry, Label, List } from '../types';
import { useTimezone } from '../contexts/TimezoneContext';
import { useTransparentLabels } from '../contexts/TransparentLabelsContext';
import { formatTimestamp } from '../utils/timezone';
import { useTexture } from '../hooks/useTexture';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface SearchHistoryItem {
  query: string;
  created_at: string;
}

const Search = () => {
  const textureStyles = useTexture('search');
  const { timezone } = useTimezone();
  const { transparentLabels } = useTransparentLabels();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [results, setResults] = useState<NoteEntry[]>([]);
  const [listResults, setListResults] = useState<List[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [filterStarred, setFilterStarred] = useState<boolean | null>(null);
  const [filterCompleted, setFilterCompleted] = useState<boolean | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadLabels();
    loadSearchHistory();
  }, []);

  const loadLabels = async () => {
    try {
      const response = await axios.get<Label[]>(`${API_URL}/api/labels/`);
      setAllLabels(response.data);
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  };


  const loadSearchHistory = async () => {
    try {
      const response = await axios.get<SearchHistoryItem[]>(`${API_URL}/api/search-history/`);
      setSearchHistory(response.data);
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  const saveToHistory = async (query: string) => {
    if (!query.trim()) return;

    try {
      await axios.post(`${API_URL}/api/search-history/`, null, {
        params: { query: query.trim() }
      });
      // Reload history to get updated list
      await loadSearchHistory();
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  };

  const performSearch = async (overrides?: {
    query?: string;
    labels?: number[];
    starred?: boolean | null;
    completed?: boolean | null;
    archived?: boolean;
  }) => {
    const query = overrides?.query !== undefined ? overrides.query : searchQuery;
    const labels = overrides?.labels !== undefined ? overrides.labels : selectedLabels;
    const starred = overrides?.starred !== undefined ? overrides.starred : filterStarred;
    const completed = overrides?.completed !== undefined ? overrides.completed : filterCompleted;
    const archived = overrides?.archived !== undefined ? overrides.archived : includeArchived;

    // Don't search if nothing is entered
    if (!query.trim() && labels.length === 0 && starred === null && completed === null) {
      setResults([]);
      setListResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    // Save to history if there's a text query
    if (query.trim()) {
      saveToHistory(query);
    }

    try {
      const params: any = {};
      if (query.trim()) {
        params.q = query.trim();
      }
      if (labels.length > 0) {
        params.label_ids = labels.join(',');
      }
      if (starred !== null) {
        params.is_important = starred;
      }
      if (completed !== null) {
        params.is_completed = completed;
      }
      if (archived) {
        params.include_archived = true;
      }

      const response = await axios.get<{entries: NoteEntry[], lists: List[]}>(`${API_URL}/api/search/all`, { params });
      setResults(response.data.entries);
      setListResults(response.data.lists);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setListResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setHasSearched(true);
    performSearch();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const toggleLabel = (labelId: number) => {
    const newLabels = selectedLabels.includes(labelId)
      ? selectedLabels.filter(id => id !== labelId)
      : [...selectedLabels, labelId];
    
    setSelectedLabels(newLabels);
    performSearch({ labels: newLabels });
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedLabels([]);
    setFilterStarred(null);
    setFilterCompleted(null);
    setIncludeArchived(false);
    setResults([]);
    setListResults([]);
    setHasSearched(false);
  };

  const goToEntry = (entry: NoteEntry, date: string) => {
    navigate(`/day/${date}#entry-${entry.id}`);
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const isCustomEmojiUrl = (name: string) => {
    return name.startsWith('/api/uploads/') || name.startsWith('http');
  };

  // Fix all absolute API URLs in HTML content to use the actual API_URL
  const fixImageUrls = (html: string): string => {
    // Replace localhost:8000
    let fixed = html.replace(/http:\/\/localhost:8000/g, API_URL);
    // Replace any IP:8000 patterns (like 192.168.0.186:8000)
    fixed = fixed.replace(/http:\/\/[\d.]+:8000/g, API_URL);
    return fixed;
  };

  return (
    <div className="max-w-5xl mx-auto page-fade-in" style={{ position: 'relative', zIndex: 1 }}>
      <div className="rounded-lg shadow-lg p-6 mb-6" style={{ backgroundColor: 'var(--color-bg-primary)', ...textureStyles }}>
        <div className="flex items-center gap-3 mb-6">
          <SearchIcon className="h-8 w-8" style={{ color: 'var(--color-text-secondary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Search</h1>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search by text (optional)..."
              className="flex-1 px-4 py-3 rounded-lg focus:outline-none"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-primary)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent)';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-accent)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading || (!searchQuery.trim() && selectedLabels.length === 0 && filterStarred === null && filterCompleted === null)}
              className="px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
              style={{
                backgroundColor: (loading || (!searchQuery.trim() && selectedLabels.length === 0 && filterStarred === null && filterCompleted === null)) 
                  ? 'var(--color-bg-tertiary)' 
                  : 'var(--color-accent)',
                color: (loading || (!searchQuery.trim() && selectedLabels.length === 0 && filterStarred === null && filterCompleted === null))
                  ? 'var(--color-text-tertiary)'
                  : 'var(--color-accent-text)',
                cursor: (loading || (!searchQuery.trim() && selectedLabels.length === 0 && filterStarred === null && filterCompleted === null)) ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!loading && (searchQuery.trim() || selectedLabels.length > 0 || filterStarred !== null || filterCompleted !== null)) {
                  e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && (searchQuery.trim() || selectedLabels.length > 0 || filterStarred !== null || filterCompleted !== null)) {
                  e.currentTarget.style.backgroundColor = 'var(--color-accent)';
                }
              }}
            >
              <SearchIcon className="h-5 w-5" />
              {loading ? 'Searching...' : 'Search'}
            </button>
            {hasSearched && (
              <button
                onClick={clearSearch}
                className="px-4 py-3 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--color-text-secondary)',
                  color: 'var(--color-bg-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-text-secondary)';
                }}
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Status Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Search by Status (optional):
          </label>
          <div className="flex flex-wrap gap-3">
            {/* Starred Filter */}
            <button
              onClick={() => {
                const newValue = filterStarred === true ? null : true;
                setFilterStarred(newValue);
                performSearch({ starred: newValue });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: filterStarred === true ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                color: filterStarred === true ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                border: `2px solid ${filterStarred === true ? 'var(--color-accent)' : 'var(--color-border-primary)'}`,
              }}
              onMouseEnter={(e) => {
                if (filterStarred !== true) {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}10`;
                }
              }}
              onMouseLeave={(e) => {
                if (filterStarred !== true) {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                }
              }}
            >
              <Star 
                className="h-4 w-4" 
                fill={filterStarred === true ? 'currentColor' : 'none'}
              />
              <span className="text-sm font-medium">Starred Only</span>
            </button>

            {/* Completed Filter */}
            <button
              onClick={() => {
                const newValue = filterCompleted === true ? null : true;
                setFilterCompleted(newValue);
                performSearch({ completed: newValue });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: filterCompleted === true ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                color: filterCompleted === true ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                border: `2px solid ${filterCompleted === true ? 'var(--color-accent)' : 'var(--color-border-primary)'}`,
              }}
              onMouseEnter={(e) => {
                if (filterCompleted !== true) {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}10`;
                }
              }}
              onMouseLeave={(e) => {
                if (filterCompleted !== true) {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                }
              }}
            >
              <CheckCircle 
                className="h-4 w-4" 
                fill={filterCompleted === true ? 'currentColor' : 'none'}
              />
              <span className="text-sm font-medium">Completed Only</span>
            </button>

            {/* Not Completed Filter */}
            <button
              onClick={() => {
                const newValue = filterCompleted === false ? null : false;
                setFilterCompleted(newValue);
                performSearch({ completed: newValue });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: filterCompleted === false ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                color: filterCompleted === false ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                border: `2px solid ${filterCompleted === false ? 'var(--color-accent)' : 'var(--color-border-primary)'}`,
              }}
              onMouseEnter={(e) => {
                if (filterCompleted !== false) {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}10`;
                }
              }}
              onMouseLeave={(e) => {
                if (filterCompleted !== false) {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                }
              }}
            >
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Not Completed</span>
            </button>

            {/* Include Archived Filter */}
            <button
              onClick={() => {
                const newValue = !includeArchived;
                setIncludeArchived(newValue);
                performSearch({ archived: newValue });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: includeArchived ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                color: includeArchived ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                border: `2px solid ${includeArchived ? 'var(--color-accent)' : 'var(--color-border-primary)'}`,
              }}
              onMouseEnter={(e) => {
                if (!includeArchived) {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}10`;
                }
              }}
              onMouseLeave={(e) => {
                if (!includeArchived) {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                }
              }}
            >
              <Archive className="h-4 w-4" />
              <span className="text-sm font-medium">Include Archived</span>
            </button>
          </div>
        </div>

        {/* Label Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Search by Labels (optional):
          </label>
          <div className="flex flex-wrap gap-2">
            {allLabels.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No labels available</p>
            ) : (
              allLabels.map((label) => {
                const isCustomEmoji = isCustomEmojiUrl(label.name);
                
                if (isCustomEmoji) {
                  const imageUrl = label.name.startsWith('http') ? label.name : `${API_URL}${label.name}`;
                  return (
                    <button
                      key={label.id}
                      onClick={() => toggleLabel(label.id)}
                      className={`p-1.5 rounded-lg transition-all ${
                        selectedLabels.includes(label.id)
                          ? 'ring-2 ring-offset-2 ring-blue-500'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                      }}
                    >
                      <img 
                        src={imageUrl} 
                        alt="emoji" 
                        className="inline-emoji"
                        style={{ width: '1.5rem', height: '1.5rem' }}
                      />
                    </button>
                  );
                }
                
                return (
                  <button
                    key={label.id}
                    onClick={() => toggleLabel(label.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      selectedLabels.includes(label.id)
                        ? 'ring-2 ring-offset-2 ring-blue-500'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: transparentLabels ? 'transparent' : label.color,
                      color: transparentLabels ? label.color : 'white',
                      border: transparentLabels ? `1px solid ${label.color}` : 'none'
                    }}
                  >
                    {label.name}
                  </button>
                );
              })
            )}
          </div>
        </div>


        {/* Search History */}
        {searchHistory.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Recent Searches:
            </label>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    // Perform search directly without updating the search input
                    performSearch({ query: item.query });
                  }}
                  className="px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-2"
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
                  <SearchIcon className="h-3 w-3" />
                  {item.query}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Info */}
        {hasSearched && !loading && (
          <div 
            className="text-sm mb-4 p-3 rounded-lg" 
            style={{ 
              color: 'var(--color-text-primary)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)'
            }}
          >
            <strong>Found {results.length} entr{results.length !== 1 ? 'ies' : 'y'} and {listResults.length} list{listResults.length !== 1 ? 's' : ''}</strong>
            <div className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Searching by:
              {searchQuery.trim() && <span className="ml-2 px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>Text: "{searchQuery}"</span>}
              {selectedLabels.length > 0 && <span className="ml-2 px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>{selectedLabels.length} label{selectedLabels.length !== 1 ? 's' : ''}</span>}
              {filterStarred === true && <span className="ml-2 px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>Starred</span>}
              {filterCompleted === true && <span className="ml-2 px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>Completed</span>}
              {filterCompleted === false && <span className="ml-2 px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>Not completed</span>}
              {includeArchived && <span className="ml-2 px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>Including archived</span>}
            </div>
          </div>
        )}
        
        {loading && (
          <div 
            className="text-sm mb-4 p-3 rounded-lg text-center" 
            style={{ 
              color: 'var(--color-text-secondary)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}
          >
            Searching...
          </div>
        )}
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="space-y-6 page-fade-in">
          {results.length === 0 && listResults.length === 0 ? (
            <div className="rounded-lg shadow-lg p-8 text-center page-fade-in" style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)' }}>
              No results found. Try a different search query or labels.
            </div>
          ) : (
            <>
              {/* List Results */}
              {listResults.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                    <Columns className="h-5 w-5" />
                    Lists ({listResults.length})
                  </h2>
                  <div className="space-y-4">
                    {listResults.map((list, index) => (
                      <div
                        key={`list-${list.id}`}
                        onClick={() => navigate(`/lists?list=${list.id}`)}
                        className="rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--color-card-bg)',
                          border: `2px solid ${list.color}`,
                          animation: `fadeIn 0.3s ease-in ${index * 0.05}s both`,
                          minHeight: '200px'
                        }}
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <div
                            className="w-2 h-16 rounded-full flex-shrink-0"
                            style={{ backgroundColor: list.color }}
                          />
                          <div className="flex-1">
                            <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                              {list.name}
                            </h3>
                            {list.description && (
                              <div 
                                className="prose max-w-none text-base leading-relaxed mb-4"
                                style={{ 
                                  color: 'var(--color-text-secondary)',
                                  maxHeight: '200px',
                                  overflowY: 'auto'
                                }}
                                dangerouslySetInnerHTML={{ __html: fixImageUrls(list.description) }}
                              />
                            )}
                            <div className="flex items-center gap-3">
                              <span
                                className="px-3 py-1 rounded-full text-sm font-semibold"
                                style={{
                                  backgroundColor: list.color,
                                  color: 'white',
                                }}
                              >
                                {list.entry_count || 0} {list.entry_count === 1 ? 'entry' : 'entries'}
                              </span>
                              {list.is_archived && (
                                <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                                  Archived
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {list.labels && list.labels.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {list.labels.map((label) => (
                              <span
                                key={label.id}
                                className="inline-block px-3 py-1 rounded-full text-sm font-medium"
                                style={{ 
                                  backgroundColor: transparentLabels ? 'transparent' : label.color,
                                  color: transparentLabels ? label.color : 'white',
                                  border: transparentLabels ? `2px solid ${label.color}` : 'none'
                                }}
                              >
                                {label.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entry Results */}
              {results.length > 0 && (
                <div>
                  {listResults.length > 0 && (
                    <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                      Entries ({results.length})
                    </h2>
                  )}
                  <div className="space-y-4">
                    {results.map((entry: any, index) => {
              // Extract date from the search result
              const date = entry.date || 'Unknown';

              return (
                <div
                  key={entry.id}
                  onClick={() => entry.is_archived ? navigate('/archive?tab=cards') : goToEntry(entry, date)}
                  className="rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--color-card-bg)',
                    border: entry.is_archived ? '2px solid var(--color-text-tertiary)' : '2px solid var(--color-border-primary)',
                    animation: `fadeIn 0.3s ease-in ${index * 0.05}s both`,
                    minHeight: '200px',
                    opacity: entry.is_archived ? 0.8 : 1,
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-lg font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}>
                          {date}
                        </span>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                          {formatTimestamp(entry.created_at, timezone, 'h:mm a zzz')}
                        </span>
                        {entry.content_type === 'code' && (
                          <span className="px-3 py-1 text-sm font-medium rounded-lg" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>
                            💻 Code
                          </span>
                        )}
                        {entry.is_important && (
                          <Star className="w-5 h-5" style={{ color: '#FFD700', fill: '#FFD700' }} />
                        )}
                        {entry.is_completed && (
                          <CheckCircle className="w-5 h-5" style={{ color: '#10B981', fill: '#10B981' }} />
                        )}
                        {entry.is_pinned && (
                          <span className="px-3 py-1 text-sm font-medium rounded-lg" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>
                            📌 Pinned
                          </span>
                        )}
                        {entry.is_archived && (
                          <span className="px-3 py-1 text-sm font-medium rounded-lg flex items-center gap-1" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                            <Archive className="w-3 h-3" />
                            Archived
                          </span>
                        )}
                      </div>
                      {entry.title && (
                        <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                          {entry.title}
                        </h3>
                      )}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {entry.labels.map((label) => {
                          // Check if it's a custom emoji URL
                          const isCustomEmoji = label.name.startsWith('/api/uploads/') || label.name.startsWith('http');
                          
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
                              className="inline-block px-3 py-1 rounded-full text-sm font-medium"
                              style={{ 
                                backgroundColor: transparentLabels ? 'transparent' : label.color,
                                color: transparentLabels ? label.color : 'white',
                                border: transparentLabels ? `2px solid ${label.color}` : 'none'
                              }}
                            >
                              {label.name}
                            </span>
                          );
                        })}
                        {/* Regular Lists */}
                        {(entry as any).regular_lists && (entry as any).regular_lists.map((list: any) => (
                          <span
                            key={list.id}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium"
                            style={{ 
                              backgroundColor: 'var(--color-bg-tertiary)',
                              color: 'var(--color-text-primary)',
                              border: '1px solid var(--color-border)'
                            }}
                          >
                            <Columns className="w-3 h-3" />
                            {list.name}
                          </span>
                        ))}
                        {/* Kanban Columns */}
                        {(entry as any).kanban_columns && (entry as any).kanban_columns.map((column: any) => (
                          <span
                            key={column.id}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium"
                            style={{ 
                              backgroundColor: 'var(--color-accent)',
                              color: 'white',
                              border: '1px solid var(--color-accent)'
                            }}
                          >
                            <Trello className="w-3 h-3" />
                            {column.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div 
                    className="prose max-w-none text-base leading-relaxed"
                    style={{ 
                      color: 'var(--color-text-primary)',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: entry.content_type === 'code' 
                        ? `<pre><code>${entry.content}</code></pre>` 
                        : fixImageUrls(entry.content)
                    }}
                  />
                </div>
              );
            })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;

