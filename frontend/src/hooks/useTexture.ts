import { useMemo, CSSProperties } from 'react';
import { useTextures, ElementType } from '../contexts/TextureContext';
import { generateTexture, PatternName } from '../services/textureGenerator';


interface TextureStyles {
  background?: string;
  backgroundImage?: string;
  backgroundBlendMode?: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
  position?: 'relative';
}

/**
 * Hook to apply textures to UI elements
 * @param elementType - The type of element (cards, calendar, etc.)
 * @returns CSS styles to apply texture overlay
 */
export function useTexture(elementType: ElementType): CSSProperties {
  const {
    textureEnabled,
    globalPattern,
    globalSettings,
    elementPatterns,
    elementSettings,
  } = useTextures();

  const textureStyles = useMemo(() => {
    if (!textureEnabled) {
      return {};
    }

    // Check if any individual elements have custom patterns
    const hasIndividualPatterns = Object.values(elementPatterns).some(p => p !== null);
    
    // If individual patterns are set, only show texture if this element has one
    // Otherwise, use the global pattern
    let pattern: PatternName | null;
    if (hasIndividualPatterns) {
      pattern = elementPatterns[elementType];
      if (!pattern) {
        return {}; // No texture for this element
      }
    } else {
      pattern = globalPattern;
    }

    const settings = elementSettings[elementType] || globalSettings;

    // Generate the texture
    const textureDataURL = generateTexture(pattern as PatternName, settings);
    
    if (!textureDataURL) {
      return {};
    }

    // Use background shorthand to layer texture
    const textureBackground = settings.colorTint
      ? `linear-gradient(${settings.colorTint}, ${settings.colorTint}), url(${textureDataURL})`
      : `url(${textureDataURL})`;

    const styles: TextureStyles = {
      background: textureBackground,
      backgroundSize: 'auto',
      backgroundRepeat: 'repeat',
      backgroundBlendMode: settings.blendMode as any,
      position: 'relative',
    };
    
    return styles;
  }, [textureEnabled, elementType, globalPattern, globalSettings, elementPatterns, elementSettings]);

  return textureStyles;
}

/**
 * Hook to check if textures are enabled
 * @returns boolean indicating if textures are enabled
 */
export function useTexturesEnabled(): boolean {
  const { textureEnabled } = useTextures();
  return textureEnabled;
}

