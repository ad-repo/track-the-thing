import { useMemo, CSSProperties } from 'react';
import { useTextures, ElementType } from '../contexts/TextureContext';
import { generateTexture, PatternName } from '../services/textureGenerator';

interface TextureStyles {
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
    console.log(`[useTexture] ${elementType}: enabled=${textureEnabled}, pattern=${elementPatterns[elementType] || globalPattern}`);
    
    if (!textureEnabled) {
      return {};
    }

    // Get pattern and settings for this element
    const pattern = elementPatterns[elementType] || globalPattern;
    const settings = elementSettings[elementType] || globalSettings;

    // Generate the texture
    const textureDataURL = generateTexture(pattern as PatternName, settings);

    const styles: TextureStyles = {
      backgroundImage: textureDataURL ? `url(${textureDataURL})` : undefined,
      backgroundBlendMode: settings.blendMode as any,
      backgroundSize: 'auto',
      backgroundRepeat: 'repeat',
      position: 'relative',
    };

    // Apply color tint if specified
    if (settings.colorTint && textureDataURL) {
      styles.backgroundImage = `linear-gradient(${settings.colorTint}, ${settings.colorTint}), url(${textureDataURL})`;
    }

    console.log(`[useTexture] ${elementType}: Generated texture with pattern "${pattern}"`);
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

