import { useState, useEffect } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { customEmojisApi } from '../api';
import type { CustomEmoji } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface CustomEmojiManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiAdded?: () => void;
}

const CustomEmojiManager = ({ isOpen, onClose, onEmojiAdded }: CustomEmojiManagerProps) => {
  const [emojis, setEmojis] = useState<CustomEmoji[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Custom');
  const [keywords, setKeywords] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadEmojis();
    }
  }, [isOpen]);

  const loadEmojis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await customEmojisApi.getAll(false);
      setEmojis(data);
    } catch (err) {
      setError('Failed to load custom emojis');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (500KB)
    if (file.size > 500 * 1024) {
      setError('File size must be less than 500KB');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !name) {
      setError('Please provide a name and select an image');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', name);
      formData.append('category', category);
      formData.append('keywords', keywords);

      const newEmoji = await customEmojisApi.create(formData);

      // Reset form
      setName('');
      setCategory('Custom');
      setKeywords('');
      setSelectedFile(null);
      setPreviewUrl(null);

      // Optimistic update - add to list without reloading
      setEmojis(prev => [...prev, newEmoji]);

      if (onEmojiAdded) {
        onEmojiAdded();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload emoji');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this custom emoji? (It will be soft-deleted for backward compatibility)')) {
      return;
    }

    // Optimistic update - remove from list immediately
    const previousEmojis = emojis;
    setEmojis(prev => prev.filter(e => e.id !== id));

    try {
      await customEmojisApi.delete(id, false);
      if (onEmojiAdded) {
        onEmojiAdded();
      }
    } catch (err) {
      // Revert on error
      setEmojis(previousEmojis);
      setError('Failed to delete emoji');
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto min-h-full"
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Manage Custom Emojis
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-opacity-80 transition-colors"
            style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          >
            <X className="h-5 w-5" style={{ color: 'var(--color-text-primary)' }} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="mb-4 p-3 rounded-lg"
            style={{ backgroundColor: 'var(--color-error)', color: '#ffffff' }}
          >
            {error}
          </div>
        )}

        {/* Upload Form */}
        <form onSubmit={handleUpload} className="mb-8 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Upload New Emoji
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Emoji Name (e.g., "custom_smile")
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="custom_smile"
                  required
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Custom"
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="smile, happy, face"
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Right Column: File Upload & Preview */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Image File (PNG, GIF, WEBP, max 500KB)
                </label>
                <input
                  type="file"
                  accept="image/png,image/gif,image/webp,image/jpeg"
                  onChange={handleFileChange}
                  required
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              {previewUrl && (
                <div className="flex justify-center">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-w-32 max-h-32 object-contain rounded-lg border"
                    style={{ borderColor: 'var(--color-border-primary)' }}
                  />
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isUploading || !selectedFile || !name}
            className="mt-4 px-4 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-accent-text)',
            }}
          >
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload Emoji'}
          </button>
        </form>

        {/* Existing Emojis Grid */}
        <div>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Your Custom Emojis ({emojis.length})
          </h3>

          {isLoading ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
              Loading...
            </div>
          ) : emojis.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
              No custom emojis yet. Upload one above!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {emojis.map((emoji) => (
                <div
                  key={emoji.id}
                  className="p-3 rounded-lg border relative group"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderColor: 'var(--color-border-primary)',
                  }}
                >
                  <img
                    src={`${API_URL}${emoji.image_url}`}
                    alt={emoji.name}
                    className="w-16 h-16 mx-auto object-contain mb-2"
                  />
                  <div className="text-center text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                    :{emoji.name}:
                  </div>
                  <button
                    onClick={() => handleDelete(emoji.id)}
                    className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'var(--color-error)', color: '#ffffff' }}
                    title="Delete emoji"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomEmojiManager;

