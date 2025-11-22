import { useMemo, CSSProperties } from 'react';
import { useTextures, ElementType } from '../contexts/TextureContext';
import { generateTexture, PatternName } from '../services/textureGenerator';


interface TextureStyles {
  background?: string;
  backgroundImage?: string;
  backgroundBlendMode?: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
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
    if (!textureEnabled) {
      return {};
    }

    const pattern = elementPatterns[elementType];
    if (!pattern) {
      return {};
    }

    const settings = elementSettings[elementType] || globalSettings;
    const textureDataURL = generateTexture(pattern as PatternName, settings);
    
    if (!textureDataURL) {
      return {};
    }

    const textureBackground = settings.colorTint
      ? `linear-gradient(${settings.colorTint}, ${settings.colorTint}), url(${textureDataURL})`
      : `url(${textureDataURL})`;

    return {
      backgroundImage: textureBackground,
      backgroundSize: 'auto',
      backgroundRepeat: 'repeat',
      backgroundBlendMode: settings.blendMode as any,
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

