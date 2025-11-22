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
    globalSettings,
    elementPatterns,
    elementSettings,
  } = useTextures();

  const textureStyles = useMemo(() => {
    const pattern = elementPatterns[elementType];
    
    // Debug log to trace the flow for settings (since that's what we're testing)
    if (elementType === 'settings') {
      console.log(`[TEXTURE DEBUG useTexture] settings: enabled=${textureEnabled}, pattern=${pattern}, hasPattern=${pattern !== null && pattern !== undefined}`);
      console.log(`[TEXTURE DEBUG useTexture] settings: elementPatterns object:`, elementPatterns);
    }
    
    // No textures if disabled
    if (!textureEnabled) {
      return {};
    }

    // Only show texture if this element has a pattern explicitly assigned
    if (!pattern) {
      if (elementType === 'settings') {
        console.log(`[TEXTURE DEBUG useTexture] settings: NO PATTERN, returning empty styles`);
      }
      return {};
    }

    const settings = elementSettings[elementType] || globalSettings;
    const textureDataURL = generateTexture(pattern as PatternName, settings);
    
    if (!textureDataURL) {
      console.error(`[TEXTURE DEBUG] ${elementType}: generation FAILED for pattern=${pattern}`);
      return {};
    }

    if (elementType === 'settings') {
      console.log(`[TEXTURE DEBUG useTexture] settings: SUCCESS - generated texture, opacity=${settings.opacity}, blend=${settings.blendMode}`);
    }

    const textureBackground = settings.colorTint
      ? `linear-gradient(${settings.colorTint}, ${settings.colorTint}), url(${textureDataURL})`
      : `url(${textureDataURL})`;

    return {
      backgroundImage: textureBackground,
      backgroundSize: 'auto',
      backgroundRepeat: 'repeat',
      backgroundBlendMode: settings.blendMode as any,
      position: 'relative',
    };
  }, [textureEnabled, elementType, globalSettings, elementPatterns, elementSettings]);

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

