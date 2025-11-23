import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Theme, useTheme } from '../contexts/ThemeContext';
import { normalizeColorForInput } from '../utils/color';

interface CustomThemeCreatorProps {
  editingTheme?: Theme | null;
  onClose: () => void;
}

const CustomThemeCreator: React.FC<CustomThemeCreatorProps> = ({ editingTheme, onClose }) => {
  const { createCustomTheme, updateCustomTheme, isBuiltInTheme, isThemeModified } = useTheme();
  
  const [themeName, setThemeName] = useState(editingTheme?.name || '');
  const [themeDescription, setThemeDescription] = useState(editingTheme?.description || '');
  const [colors, setColors] = useState(editingTheme?.colors || {
    bgPrimary: '#ffffff',
    bgSecondary: '#f9fafb',
    bgTertiary: '#f3f4f6',
    bgHover: '#f3f4f6',
    textPrimary: '#111827',
    textSecondary: '#4b5563',
    textTertiary: '#9ca3af',
    borderPrimary: '#e5e7eb',
    borderSecondary: '#d1d5db',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    accentText: '#ffffff',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    cardBg: '#ffffff',
    cardBorder: '#e5e7eb',
    cardShadow: 'rgba(0, 0, 0, 0.1)',
  });

  // Reset form when editingTheme changes
  useEffect(() => {
    if (editingTheme) {
      setThemeName(editingTheme.name);
      setThemeDescription(editingTheme.description || '');
      setColors(editingTheme.colors);
    } else {
      // Reset to defaults for new theme
      setThemeName('');
      setThemeDescription('');
      setColors({
        bgPrimary: '#ffffff',
        bgSecondary: '#f9fafb',
        bgTertiary: '#f3f4f6',
        bgHover: '#f3f4f6',
        textPrimary: '#111827',
        textSecondary: '#4b5563',
        textTertiary: '#9ca3af',
        borderPrimary: '#e5e7eb',
        borderSecondary: '#d1d5db',
        accent: '#3b82f6',
        accentHover: '#2563eb',
        accentText: '#ffffff',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
        cardBg: '#ffffff',
        cardBorder: '#e5e7eb',
        cardShadow: 'rgba(0, 0, 0, 0.1)',
      });
    }
  }, [editingTheme]);

  const handleColorChange = (key: keyof typeof colors, value: string) => {
    setColors({ ...colors, [key]: value });
  };

  const handleSave = () => {
    if (!themeName.trim()) {
      alert('Please enter a theme name');
      return;
    }

    const themeId = editingTheme?.id || `custom-${Date.now()}`;
    const newTheme: Theme = {
      id: themeId,
      name: themeName.trim(),
      description: themeDescription.trim() || undefined,
      colors,
    };

    // If editing a theme
    if (editingTheme) {
      // Check if it's a built-in theme that hasn't been modified yet
      const isBuiltIn = isBuiltInTheme(editingTheme.id);
      const isModified = isThemeModified(editingTheme.id);
      
      if (isBuiltIn && !isModified) {
        // First time editing a built-in theme - create custom version
        createCustomTheme(newTheme);
      } else {
        // Updating an already-custom theme
        updateCustomTheme(newTheme);
      }
    } else {
      // Creating a brand new custom theme
      createCustomTheme(newTheme);
    }
    onClose();
  };

  const colorFields = [
    { key: 'bgPrimary' as const, label: 'Background Primary', category: 'Background' },
    { key: 'bgSecondary' as const, label: 'Background Secondary', category: 'Background' },
    { key: 'bgTertiary' as const, label: 'Background Tertiary', category: 'Background' },
    { key: 'bgHover' as const, label: 'Background Hover', category: 'Background' },
    { key: 'textPrimary' as const, label: 'Text Primary', category: 'Text' },
    { key: 'textSecondary' as const, label: 'Text Secondary', category: 'Text' },
    { key: 'textTertiary' as const, label: 'Text Tertiary', category: 'Text' },
    { key: 'borderPrimary' as const, label: 'Border Primary', category: 'Border' },
    { key: 'borderSecondary' as const, label: 'Border Secondary', category: 'Border' },
    { key: 'accent' as const, label: 'Accent', category: 'Accent' },
    { key: 'accentHover' as const, label: 'Accent Hover', category: 'Accent' },
    { key: 'accentText' as const, label: 'Accent Text', category: 'Accent' },
    { key: 'success' as const, label: 'Success', category: 'Semantic' },
    { key: 'error' as const, label: 'Error', category: 'Semantic' },
    { key: 'warning' as const, label: 'Warning', category: 'Semantic' },
    { key: 'info' as const, label: 'Info', category: 'Semantic' },
    { key: 'cardBg' as const, label: 'Card Background', category: 'Card' },
    { key: 'cardBorder' as const, label: 'Card Border', category: 'Card' },
    { key: 'cardShadow' as const, label: 'Card Shadow (rgba)', category: 'Card' },
  ];

  const categories = ['Background', 'Text', 'Border', 'Accent', 'Semantic', 'Card'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto min-h-full">
      <div 
        className="rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--color-card-bg)' }}
      >
        {/* Header */}
        <div 
          className="p-6 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--color-border-primary)' }}
        >
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {editingTheme ? 'Edit Custom Theme' : 'Create Custom Theme'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column: Form */}
            <div>
              {/* Theme Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Theme Name *
                </label>
                <input
                  type="text"
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  placeholder="My Custom Theme"
                  className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-primary)',
                  }}
                />
              </div>

              {/* Theme Description */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={themeDescription}
                  onChange={(e) => setThemeDescription(e.target.value)}
                  placeholder="A beautiful custom theme"
                  className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-primary)',
                  }}
                />
              </div>

              {/* Color Pickers by Category */}
              <div className="space-y-6">
                {categories.map((category) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                      {category} Colors
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {colorFields
                        .filter(field => field.category === category)
                        .map((field) => (
                          <div key={field.key}>
                            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                              {field.label}
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={normalizeColorForInput(colors[field.key], '#000000')}
                                onChange={(e) => handleColorChange(field.key, e.target.value)}
                                className="w-12 h-10 rounded cursor-pointer"
                                style={{ border: '1px solid var(--color-border-primary)' }}
                              />
                              <input
                                type="text"
                                value={colors[field.key]}
                                onChange={(e) => handleColorChange(field.key, e.target.value)}
                                className="flex-1 px-2 py-2 text-sm rounded focus:outline-none"
                                style={{
                                  backgroundColor: 'var(--color-bg-primary)',
                                  color: 'var(--color-text-primary)',
                                  border: '1px solid var(--color-border-primary)',
                                }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Live Preview */}
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                Live Preview
              </h3>
              <div 
                className="rounded-lg p-6 space-y-4"
                style={{ 
                  backgroundColor: colors.bgSecondary,
                  border: `1px solid ${colors.borderPrimary}`,
                }}
              >
                {/* Card Preview */}
                <div 
                  className="rounded-lg p-4"
                  style={{ 
                    backgroundColor: colors.cardBg,
                    border: `1px solid ${colors.cardBorder}`,
                    boxShadow: `0 4px 6px -1px ${colors.cardShadow}`,
                  }}
                >
                  <h4 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
                    Sample Card
                  </h4>
                  <p className="text-sm mb-3" style={{ color: colors.textSecondary }}>
                    This is what your content will look like with this theme.
                  </p>
                  <p className="text-xs" style={{ color: colors.textTertiary }}>
                    Secondary text example
                  </p>
                </div>

                {/* Buttons Preview */}
                <div className="space-y-2">
                  <button
                    className="w-full px-4 py-2 rounded-lg font-medium"
                    style={{
                      backgroundColor: colors.accent,
                      color: colors.accentText,
                    }}
                  >
                    Accent Button
                  </button>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium"
                      style={{
                        backgroundColor: colors.success,
                        color: colors.accentText,
                      }}
                    >
                      Success
                    </button>
                    <button
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium"
                      style={{
                        backgroundColor: colors.error,
                        color: colors.accentText,
                      }}
                    >
                      Error
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium"
                      style={{
                        backgroundColor: colors.warning,
                        color: colors.accentText,
                      }}
                    >
                      Warning
                    </button>
                    <button
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium"
                      style={{
                        backgroundColor: colors.info,
                        color: colors.accentText,
                      }}
                    >
                      Info
                    </button>
                  </div>
                </div>

                {/* Border Preview */}
                <div 
                  className="p-3 rounded-lg"
                  style={{ 
                    backgroundColor: colors.bgTertiary,
                    border: `2px solid ${colors.borderSecondary}`,
                  }}
                >
                  <p className="text-sm" style={{ color: colors.textPrimary }}>
                    Border and background preview
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="p-6 flex items-center justify-end gap-3"
          style={{ borderTop: '1px solid var(--color-border-primary)' }}
        >
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg transition-colors font-medium"
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
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 rounded-lg transition-colors font-medium"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-accent-text)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent)';
            }}
          >
            <Check className="h-5 w-5" />
            {editingTheme ? 'Update Theme' : 'Create Theme'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomThemeCreator;

