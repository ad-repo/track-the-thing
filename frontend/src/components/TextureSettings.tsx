import { useState, useCallback } from 'react';
import { 
  Sparkles, 
  Settings, 
  ChevronDown, 
  ChevronRight, 
  Download,
  Upload,
  RotateCcw,
  Shuffle,
  X,
} from 'lucide-react';
import { useTextures, ElementType } from '../contexts/TextureContext';
import { getAllPatterns, PatternName, TextureOptions, generateTexture } from '../services/textureGenerator';
import { TexturePatternGrid } from './TexturePatternPreview';

const ELEMENT_TYPES: { type: ElementType | 'all'; label: string; icon: string }[] = [
  { type: 'all', label: 'All Elements', icon: '🌐' },
  { type: 'cards', label: 'Cards', icon: '🃏' },
  { type: 'calendar', label: 'Calendar', icon: '📅' },
  { type: 'lists', label: 'Lists', icon: '📝' },
  { type: 'kanban', label: 'Kanban', icon: '📋' },
  { type: 'modals', label: 'Modals', icon: '💬' },
  { type: 'navigation', label: 'Navigation', icon: '🧭' },
  { type: 'panels', label: 'Panels', icon: '🔲' },
  { type: 'sidebar', label: 'Sidebar', icon: '📐' },
  { type: 'header', label: 'Header', icon: '📊' },
  { type: 'buttons', label: 'Buttons', icon: '🔘' },
  { type: 'settings', label: 'Settings', icon: '⚙️' },
  { type: 'reports', label: 'Reports', icon: '📈' },
];

const BLEND_MODES = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
];

export default function TextureSettings() {
  const {
    textureEnabled,
    toggleTexture,
    globalPattern,
    setGlobalPattern,
    globalSettings,
    updateGlobalSettings,
    elementPatterns,
    setElementPattern,
    randomEnabled,
    setRandomEnabled,
    randomInterval,
    setRandomInterval,
    nextRandomPattern,
    resetToDefaults,
    exportConfiguration,
    importConfiguration,
  } = useTextures();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRandomSettings, setShowRandomSettings] = useState(false);
  const [selectedElements, setSelectedElements] = useState<Set<ElementType | 'all'>>(new Set());

  const allPatterns = getAllPatterns();

  const handleExport = useCallback(() => {
    const config = exportConfiguration();
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `texture-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportConfiguration]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        importConfiguration(content);
        alert('Texture configuration imported successfully!');
      } catch (error) {
        alert('Failed to import configuration. Please check the file format.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, [importConfiguration]);

  const handleReset = useCallback(() => {
    if (confirm('Are you sure you want to reset all texture settings to defaults?')) {
      resetToDefaults();
    }
  }, [resetToDefaults]);

  return (
    <section className="mb-6">
      <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
        <Sparkles className="h-5 w-5" />
        UI Textures
      </h2>

      <div className="rounded-lg p-5 space-y-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '2px solid var(--color-border-primary)' }}>
          <div>
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Enable UI Textures
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Add subtle texture patterns to UI elements
            </p>
          </div>
          <button
            onClick={toggleTexture}
            className="relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300"
            style={{
              backgroundColor: textureEnabled ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border-primary)',
              borderWidth: '2px',
              boxShadow: textureEnabled ? '0 0 20px rgba(var(--color-accent-rgb), 0.4)' : 'none',
            }}
          >
            <span
              className="inline-block h-6 w-6 transform rounded-full transition-transform duration-300"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                transform: textureEnabled ? 'translateX(2rem)' : 'translateX(0.25rem)',
              }}
            />
          </button>
        </div>

        {textureEnabled && (
          <>
            {/* Pattern Assignment */}
            <div className="space-y-3 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <h3 className="text-md font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                <Settings className="h-4 w-4" />
                Select Elements & Patterns
              </h3>
              
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Click an element to set its texture pattern. Use "All Elements" to set a default for everything.
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {ELEMENT_TYPES.map(({ type, label, icon }) => {
                  const isAll = type === 'all';
                  const hasCustom = !isAll && elementPatterns[type as ElementType] !== null;
                  const currentPattern = isAll ? globalPattern : (elementPatterns[type as ElementType] || globalPattern);
                  
                  const isSelected = selectedElements.has(type);
                  
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        const newSelection = new Set(selectedElements);
                        if (type === 'all') {
                          // Clicking "All Elements" clears other selections and selects only "all"
                          if (isSelected) {
                            newSelection.delete('all');
                          } else {
                            newSelection.clear();
                            newSelection.add('all');
                          }
                        } else {
                          // Clicking individual element: remove "all" if present, toggle this element
                          newSelection.delete('all');
                          if (isSelected) {
                            newSelection.delete(type);
                          } else {
                            newSelection.add(type);
                          }
                        }
                        setSelectedElements(newSelection);
                      }}
                      className="p-3 rounded-lg text-center transition-all relative"
                      style={{
                        backgroundColor: isSelected ? 'var(--color-accent)' + '60' : hasCustom ? 'var(--color-accent)' + '40' : 'var(--color-bg-primary)',
                        color: 'var(--color-text-primary)',
                        border: `2px solid ${isSelected ? 'var(--color-accent)' : hasCustom ? 'var(--color-accent)' : 'var(--color-border-primary)'}`,
                      }}
                    >
                      <div className="text-2xl mb-1">{icon}</div>
                      <div className="text-xs font-medium">{label}</div>
                      <div className="text-xs mt-1" style={{ color: hasCustom || isAll ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                        {currentPattern}
                      </div>
                      {hasCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setElementPattern(type as ElementType, null);
                          }}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'var(--color-error)', color: 'white' }}
                          title="Remove custom pattern (use default)"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedElements.size > 0 && (
                <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-primary)', border: '2px solid var(--color-accent)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {selectedElements.has('all') 
                        ? 'All Elements Pattern'
                        : `Pattern for ${selectedElements.size} Element${selectedElements.size > 1 ? 's' : ''}`
                      }
                    </h4>
                    <button
                      onClick={() => setSelectedElements(new Set())}
                      className="text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                    >
                      Done
                    </button>
                  </div>
                  
                  <TexturePatternGrid
                    patterns={allPatterns}
                    selectedPattern={
                      selectedElements.has('all') 
                        ? globalPattern 
                        : (Array.from(selectedElements)[0] !== 'all' ? elementPatterns[Array.from(selectedElements)[0] as ElementType] || globalPattern : globalPattern)
                    }
                    onSelectPattern={(pattern) => {
                      if (selectedElements.has('all')) {
                        setGlobalPattern(pattern);
                      } else {
                        // Apply to all selected elements
                        selectedElements.forEach(element => {
                          if (element !== 'all') {
                            setElementPattern(element, pattern);
                          }
                        });
                      }
                    }}
                    previewOptions={globalSettings}
                  />

                  {/* Live Preview */}
                  <div className="mt-4">
                    <div
                      className="h-24 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        backgroundImage: `url(${generateTexture(
                          selectedElements.has('all') 
                            ? globalPattern 
                            : (Array.from(selectedElements)[0] !== 'all' ? elementPatterns[Array.from(selectedElements)[0] as ElementType] || globalPattern : globalPattern),
                          globalSettings
                        )})`,
                        backgroundSize: 'auto',
                        backgroundRepeat: 'repeat',
                        border: '1px solid var(--color-border-primary)',
                      }}
                    >
                      <p className="text-sm font-medium px-3 py-1 rounded" style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
                        Preview
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Global Settings Controls */}
            <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Settings
                </h3>
                <button
                  onClick={() => {
                    updateGlobalSettings({ opacity: 0.5, scale: 1.0, density: 0.7, angle: 0, blendMode: 'overlay' });
                  }}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                  title="Reset to high-visibility defaults"
                >
                  Reset Settings
                </button>
              </div>

              {/* Opacity */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    Opacity
                    {globalSettings.opacity < 0.3 && (
                      <span className="ml-2 text-xs px-1 rounded" style={{ backgroundColor: 'var(--color-warning)', color: 'black' }}>
                        Too low!
                      </span>
                    )}
                  </label>
                  <span className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {Math.round(globalSettings.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={globalSettings.opacity}
                  onChange={(e) => updateGlobalSettings({ opacity: parseFloat(e.target.value) })}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--color-accent) ${globalSettings.opacity * 100}%, var(--color-border-primary) ${globalSettings.opacity * 100}%)`,
                  }}
                />
              </div>

              {/* Scale */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    Scale
                  </label>
                  <span className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {globalSettings.scale.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={globalSettings.scale}
                  onChange={(e) => updateGlobalSettings({ scale: parseFloat(e.target.value) })}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--color-accent) ${((globalSettings.scale - 0.5) / 1.5) * 100}%, var(--color-border-primary) ${((globalSettings.scale - 0.5) / 1.5) * 100}%)`,
                  }}
                />
              </div>

              {/* Density */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    Density
                  </label>
                  <span className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {Math.round(globalSettings.density * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={globalSettings.density}
                  onChange={(e) => updateGlobalSettings({ density: parseFloat(e.target.value) })}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--color-accent) ${globalSettings.density * 100}%, var(--color-border-primary) ${globalSettings.density * 100}%)`,
                  }}
                />
              </div>

              {/* Blend Mode */}
              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Blend Mode
                </label>
                <select
                  value={globalSettings.blendMode}
                  onChange={(e) => updateGlobalSettings({ blendMode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-primary)',
                  }}
                >
                  {BLEND_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Random Pattern Rotation */}
            <div className="space-y-3">
              <button
                onClick={() => setShowRandomSettings(!showRandomSettings)}
                className="w-full flex items-center justify-between p-4 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                <div className="flex items-center gap-2">
                  <Shuffle className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Random Pattern Rotation
                  </span>
                </div>
                {showRandomSettings ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>

              {showRandomSettings && (
                <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Enable Auto-Rotation
                    </span>
                    <button
                      onClick={() => setRandomEnabled(!randomEnabled)}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-all"
                      style={{
                        backgroundColor: randomEnabled ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                        borderColor: 'var(--color-border-primary)',
                        borderWidth: '1px',
                      }}
                    >
                      <span
                        className="inline-block h-4 w-4 transform rounded-full transition-transform"
                        style={{
                          backgroundColor: 'var(--color-bg-primary)',
                          transform: randomEnabled ? 'translateX(1.5rem)' : 'translateX(0.25rem)',
                        }}
                      />
                    </button>
                  </div>

                  {randomEnabled && (
                    <>
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            Rotation Interval
                          </label>
                          <span className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                            {randomInterval} min
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="60"
                          step="1"
                          value={randomInterval}
                          onChange={(e) => setRandomInterval(parseInt(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, var(--color-accent) ${(randomInterval / 60) * 100}%, var(--color-border-primary) ${(randomInterval / 60) * 100}%)`,
                          }}
                        />
                      </div>

                      <button
                        onClick={nextRandomPattern}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: 'var(--color-accent)',
                          color: 'var(--color-accent-text)',
                        }}
                      >
                        <Shuffle className="h-4 w-4" />
                        Next Pattern Now
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Advanced Options */}
            <div className="space-y-3">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between p-4 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Advanced Options
                  </span>
                </div>
                {showAdvanced ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>

              {showAdvanced && (
                <div className="flex flex-wrap gap-2 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-accent-text)',
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Export Config
                  </button>

                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-accent-text)',
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    Import Config
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: 'var(--color-error)',
                      color: 'white',
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset to Defaults
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
