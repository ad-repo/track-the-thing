import { useEffect, useState, useRef } from 'react';
import { Check } from 'lucide-react';
import { PatternName, getPatternDisplayName, generateTexture, TextureOptions } from '../services/textureGenerator';

interface TexturePatternPreviewProps {
  pattern: PatternName;
  isSelected: boolean;
  onSelect: (pattern: PatternName) => void;
  previewOptions?: Partial<TextureOptions>;
}

export function TexturePatternPreview({
  pattern,
  isSelected,
  onSelect,
  previewOptions,
}: TexturePatternPreviewProps) {
  const [textureDataURL, setTextureDataURL] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Generate texture for preview
    const options: Partial<TextureOptions> = {
      scale: 0.8,
      opacity: 0.3,
      density: 0.5,
      angle: 0,
      ...previewOptions,
    };

    const dataURL = generateTexture(pattern, options);
    setTextureDataURL(dataURL);
  }, [pattern, previewOptions]);

  return (
    <button
      onClick={() => onSelect(pattern)}
      className="relative group rounded-xl overflow-hidden transition-all duration-300"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border-primary)'}`,
        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
        boxShadow: isSelected
          ? '0 8px 16px rgba(0,0,0,0.2)'
          : '0 2px 4px rgba(0,0,0,0.1)',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }
      }}
    >
      {/* Preview Canvas */}
      <div
        className="relative w-full h-24"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          backgroundImage: textureDataURL ? `url(${textureDataURL})` : undefined,
          backgroundSize: 'auto',
          backgroundRepeat: 'repeat',
        }}
      >
        {/* Selection Indicator */}
        {isSelected && (
          <div
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center animate-scale-in"
            style={{
              backgroundColor: 'var(--color-accent)',
              animation: 'scale-in 0.2s ease-out',
            }}
          >
            <Check className="w-4 h-4" style={{ color: 'var(--color-accent-text)' }} />
          </div>
        )}
      </div>

      {/* Pattern Name */}
      <div
        className="px-2 py-2 text-xs font-medium text-center truncate"
        style={{
          backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
          color: isSelected ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
          transition: 'all 0.2s ease',
        }}
      >
        {getPatternDisplayName(pattern)}
      </div>

      {/* Hover Overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${isSelected ? 'transparent' : 'rgba(var(--color-accent-rgb), 0.1)'} 0%, transparent 100%)`,
        }}
      />
    </button>
  );
}

interface TexturePatternGridProps {
  patterns: PatternName[];
  selectedPattern: PatternName;
  onSelectPattern: (pattern: PatternName) => void;
  previewOptions?: Partial<TextureOptions>;
}

export function TexturePatternGrid({
  patterns,
  selectedPattern,
  onSelectPattern,
  previewOptions,
}: TexturePatternGridProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {patterns.map((pattern) => (
        <TexturePatternPreview
          key={pattern}
          pattern={pattern}
          isSelected={selectedPattern === pattern}
          onSelect={onSelectPattern}
          previewOptions={previewOptions}
        />
      ))}
    </div>
  );
}

