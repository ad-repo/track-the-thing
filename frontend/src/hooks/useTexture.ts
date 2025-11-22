import { useMemo, CSSProperties } from 'react';
import { useTextures, ElementType } from '../contexts/TextureContext';
import { generateTexture, PatternName } from '../services/textureGenerator';

// VERSION CHECK - v3
console.log('[useTexture.ts] CODE VERSION: v3 - 2024-11-22');

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
      console.log(`[useTexture] ${elementType}: Textures disabled, returning empty styles`);
      return {};
    }

    // Get pattern and settings for this element
    const pattern = elementPatterns[elementType] || globalPattern;
    const settings = elementSettings[elementType] || globalSettings;

    // Generate the texture
    const textureDataURL = generateTexture(pattern as PatternName, settings);
    
    console.log(`[useTexture] ${elementType}: Generated texture data URL (length: ${textureDataURL?.length || 0})`);
    console.log(`[useTexture] ${elementType}: Opacity: ${settings.opacity}, Scale: ${settings.scale}, Density: ${settings.density}`);

    if (!textureDataURL) {
      console.error(`[useTexture] ${elementType}: Failed to generate texture data URL!`);
      return {};
    }

    // Create the texture background with explicit CSS properties
    const styles: TextureStyles = {
      backgroundImage: `url(${textureDataURL})`,
      backgroundBlendMode: settings.blendMode as any,
      backgroundSize: 'auto',
      backgroundRepeat: 'repeat',
      position: 'relative',
    };

    // Apply color tint if specified
    if (settings.colorTint) {
      styles.backgroundImage = `linear-gradient(${settings.colorTint}, ${settings.colorTint}), url(${textureDataURL})`;
    }
    
    // CRITICAL: Ensure backgroundImage isn't being overridden
    // Add !important through a style object won't work, so we need to ensure
    // the image is actually valid and applied
    console.log(`[useTexture] ${elementType}: Final backgroundImage property:`, styles.backgroundImage?.substring(0, 80));

    console.log(`[useTexture] ${elementType}: FINAL STYLES ==>`, JSON.stringify(styles, null, 2));
    console.log(`[useTexture] ${elementType}: backgroundImage starts with:`, styles.backgroundImage?.substring(0, 50));
    
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

