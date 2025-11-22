import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { PatternName, TextureOptions, getAllPatterns } from '../services/textureGenerator';
import { settingsApi } from '../api';

export type ElementType =
  | 'cards'
  | 'calendar'
  | 'lists'
  | 'kanban'
  | 'modals'
  | 'navigation'
  | 'panels'
  | 'sidebar'
  | 'header'
  | 'buttons'
  | 'settings'
  | 'reports'
  | 'search';

interface TextureContextType {
  // Master toggle
  textureEnabled: boolean;
  toggleTexture: () => void;

  // Pattern selection
  globalPattern: PatternName;
  setGlobalPattern: (pattern: PatternName) => void;

  // Global settings
  globalSettings: TextureOptions;
  updateGlobalSettings: (settings: Partial<TextureOptions>) => void;

  // Per-element patterns
  elementPatterns: Record<ElementType, PatternName | null>;
  setElementPattern: (element: ElementType, pattern: PatternName | null) => void;

  // Per-element settings
  elementSettings: Record<ElementType, TextureOptions | null>;
  updateElementSettings: (element: ElementType, settings: Partial<TextureOptions> | null) => void;

  // Random pattern rotation
  randomEnabled: boolean;
  setRandomEnabled: (enabled: boolean) => void;
  randomInterval: number; // minutes
  setRandomInterval: (minutes: number) => void;
  randomPatternPool: PatternName[];
  setRandomPatternPool: (patterns: PatternName[]) => void;
  nextRandomPattern: () => void;

  // Utility functions
  getPatternForElement: (element: ElementType) => PatternName;
  getSettingsForElement: (element: ElementType) => TextureOptions;
  resetToDefaults: () => void;
  exportConfiguration: () => string;
  importConfiguration: (config: string) => void;
}

const DEFAULT_SETTINGS: TextureOptions = {
  scale: 1.0,
  opacity: 0.2,
  density: 0.5,
  angle: 0,
  blendMode: 'multiply',
  seed: Date.now(),
};

const TextureContext = createContext<TextureContextType | undefined>(undefined);

export function useTextures() {
  const context = useContext(TextureContext);
  if (!context) {
    throw new Error('useTextures must be used within a TextureProvider');
  }
  return context;
}

interface TextureProviderProps {
  children: ReactNode;
}

export function TextureProvider({ children }: TextureProviderProps) {
  
  // Load initial state from localStorage
  const [textureEnabled, setTextureEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('texture_enabled');
    return saved ? JSON.parse(saved) : false;
  });

  const [globalPattern, setGlobalPatternState] = useState<PatternName>(() => {
    const saved = localStorage.getItem('texture_global_pattern');
    return saved ? (JSON.parse(saved) as PatternName) : 'noise';
  });

  const [globalSettings, setGlobalSettings] = useState<TextureOptions>(() => {
    const saved = localStorage.getItem('texture_global_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [elementPatterns, setElementPatterns] = useState<Record<ElementType, PatternName | null>>(() => {
    const saved = localStorage.getItem('texture_element_patterns');
    return saved
      ? JSON.parse(saved)
      : {
          cards: null,
          calendar: null,
          lists: null,
          kanban: null,
          modals: null,
          navigation: null,
          panels: null,
          sidebar: null,
          header: null,
          buttons: null,
          settings: null,
          reports: null,
          search: null,
        };
  });

  const [elementSettings, setElementSettings] = useState<Record<ElementType, TextureOptions | null>>(() => {
    const saved = localStorage.getItem('texture_element_settings');
    return saved
      ? JSON.parse(saved)
      : {
          cards: null,
          calendar: null,
          lists: null,
          kanban: null,
          modals: null,
          navigation: null,
          panels: null,
          sidebar: null,
          header: null,
          buttons: null,
          settings: null,
          reports: null,
          search: null,
        };
  });

  const [randomEnabled, setRandomEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem('texture_random_enabled');
    return saved ? JSON.parse(saved) : false;
  });

  const [randomInterval, setRandomIntervalState] = useState<number>(() => {
    const saved = localStorage.getItem('texture_random_interval');
    return saved ? JSON.parse(saved) : 5; // 5 minutes default
  });

  const [randomPatternPool, setRandomPatternPoolState] = useState<PatternName[]>(() => {
    const saved = localStorage.getItem('texture_random_pool');
    return saved ? JSON.parse(saved) : getAllPatterns();
  });

  // Load settings from database on mount
  useEffect(() => {
    const loadFromDatabase = async () => {
      try {
        console.log('[TextureProvider] Loading settings from database...');
        const settings = await settingsApi.get();
        console.log('[TextureProvider] Loaded settings:', settings);
        
        if (settings.texture_settings) {
          try {
            const parsed = JSON.parse(settings.texture_settings);
            console.log('[TextureProvider] Parsed texture settings:', parsed);
            
            if (parsed.textureEnabled !== undefined) setTextureEnabled(parsed.textureEnabled);
            if (parsed.globalPattern) setGlobalPatternState(parsed.globalPattern);
            if (parsed.globalSettings) setGlobalSettings(parsed.globalSettings);
            if (parsed.elementPatterns) {
              console.log('[TextureProvider] Setting element patterns:', parsed.elementPatterns);
              setElementPatterns(parsed.elementPatterns);
            }
            if (parsed.elementSettings) setElementSettings(parsed.elementSettings);
            if (parsed.randomEnabled !== undefined) setRandomEnabledState(parsed.randomEnabled);
            if (parsed.randomInterval) setRandomIntervalState(parsed.randomInterval);
            if (parsed.randomPatternPool) setRandomPatternPoolState(parsed.randomPatternPool);
          } catch (error) {
            console.error('[TextureProvider] Failed to parse texture_settings:', error);
          }
        }
      } catch (error) {
        console.error('[TextureProvider] Failed to load from database:', error);
      }
    };

    loadFromDatabase();
  }, []);

  // Save to database whenever settings change
  const saveToDatabase = useCallback(async () => {
    try {
      const textureConfig = {
        textureEnabled,
        globalPattern,
        globalSettings,
        elementPatterns,
        elementSettings,
        randomEnabled,
        randomInterval,
        randomPatternPool,
      };

      console.log('[TextureProvider] Saving to database:', textureConfig);
      await settingsApi.update({
        texture_enabled: textureEnabled,
        texture_settings: JSON.stringify(textureConfig),
      });
      console.log('[TextureProvider] Saved successfully');
    } catch (error) {
      console.error('[TextureProvider] Failed to save to database:', error);
    }
  }, [
    textureEnabled,
    globalPattern,
    globalSettings,
    elementPatterns,
    elementSettings,
    randomEnabled,
    randomInterval,
    randomPatternPool,
  ]);

  // Persist to localStorage immediately
  useEffect(() => {
    localStorage.setItem('texture_enabled', JSON.stringify(textureEnabled));
  }, [textureEnabled]);

  useEffect(() => {
    localStorage.setItem('texture_global_pattern', JSON.stringify(globalPattern));
  }, [globalPattern]);

  useEffect(() => {
    localStorage.setItem('texture_global_settings', JSON.stringify(globalSettings));
  }, [globalSettings]);

  useEffect(() => {
    localStorage.setItem('texture_element_patterns', JSON.stringify(elementPatterns));
  }, [elementPatterns]);

  useEffect(() => {
    localStorage.setItem('texture_element_settings', JSON.stringify(elementSettings));
  }, [elementSettings]);

  useEffect(() => {
    localStorage.setItem('texture_random_enabled', JSON.stringify(randomEnabled));
  }, [randomEnabled]);

  useEffect(() => {
    localStorage.setItem('texture_random_interval', JSON.stringify(randomInterval));
  }, [randomInterval]);

  useEffect(() => {
    localStorage.setItem('texture_random_pool', JSON.stringify(randomPatternPool));
  }, [randomPatternPool]);

  // Debounced save to database - only save once when settings change
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToDatabase();
    }, 1000); // Wait 1 second after last change

    return () => clearTimeout(timer);
  }, [
    textureEnabled,
    globalPattern,
    globalSettings,
    elementPatterns,
    elementSettings,
    randomEnabled,
    randomInterval,
    randomPatternPool,
    saveToDatabase,
  ]);

  const toggleTexture = useCallback(() => {
    setTextureEnabled((prev) => !prev);
  }, []);

  const setGlobalPattern = useCallback((pattern: PatternName) => {
    setGlobalPatternState(pattern);
    // Update seed for reproducible randomness
    setGlobalSettings((prev) => ({
      ...prev,
      seed: Date.now(),
    }));
  }, []);

  const updateGlobalSettings = useCallback((settings: Partial<TextureOptions>) => {
    setGlobalSettings((prev) => ({
      ...prev,
      ...settings,
    }));
  }, []);

  const setElementPattern = useCallback((element: ElementType, pattern: PatternName | null) => {
    setElementPatterns((prev) => ({
      ...prev,
      [element]: pattern,
    }));
  }, []);

  const updateElementSettings = useCallback(
    (element: ElementType, settings: Partial<TextureOptions> | null) => {
      setElementSettings((prev) => ({
        ...prev,
        [element]: settings ? { ...DEFAULT_SETTINGS, ...settings } : null,
      }));
    },
    []
  );

  const setRandomEnabled = useCallback((enabled: boolean) => {
    setRandomEnabledState(enabled);
  }, []);

  const setRandomInterval = useCallback((minutes: number) => {
    setRandomIntervalState(Math.max(1, Math.min(60, minutes)));
  }, []);

  const setRandomPatternPool = useCallback((patterns: PatternName[]) => {
    setRandomPatternPoolState(patterns);
  }, []);

  const nextRandomPattern = useCallback(() => {
    setGlobalPatternState((currentPattern) => {
      if (randomPatternPool.length === 0) return currentPattern;
      
      const currentIndex = randomPatternPool.indexOf(currentPattern);
      const nextIndex = (currentIndex + 1) % randomPatternPool.length;
      return randomPatternPool[nextIndex];
    });
    
    // Update seed for new pattern
    setGlobalSettings((prev) => ({
      ...prev,
      seed: Date.now(),
    }));
  }, [randomPatternPool]);

  // Random pattern rotation - placed after nextRandomPattern is defined
  useEffect(() => {
    if (!randomEnabled || !textureEnabled || randomPatternPool.length === 0) {
      return;
    }

    const intervalMs = randomInterval * 60 * 1000;
    const intervalId = setInterval(() => {
      nextRandomPattern();
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [randomEnabled, randomInterval, randomPatternPool, textureEnabled, nextRandomPattern]);

  const getPatternForElement = useCallback(
    (element: ElementType): PatternName => {
      return elementPatterns[element] || globalPattern;
    },
    [elementPatterns, globalPattern]
  );

  const getSettingsForElement = useCallback(
    (element: ElementType): TextureOptions => {
      return elementSettings[element] || globalSettings;
    },
    [elementSettings, globalSettings]
  );

  const resetToDefaults = useCallback(() => {
    // Keep textureEnabled state - don't disable textures when resetting
    setGlobalPatternState('noise');
    setGlobalSettings(DEFAULT_SETTINGS);
    setElementPatterns({
      cards: null,
      calendar: null,
      lists: null,
      kanban: null,
      modals: null,
      navigation: null,
      panels: null,
      sidebar: null,
      header: null,
      buttons: null,
      settings: null,
      reports: null,
      search: null,
    });
    setElementSettings({
      cards: null,
      calendar: null,
      lists: null,
      kanban: null,
      modals: null,
      navigation: null,
      panels: null,
      sidebar: null,
      header: null,
      buttons: null,
      settings: null,
      reports: null,
      search: null,
    });
    setRandomEnabledState(false);
    setRandomIntervalState(5);
    setRandomPatternPoolState(getAllPatterns());
  }, []);

  const exportConfiguration = useCallback((): string => {
    const config = {
      textureEnabled,
      globalPattern,
      globalSettings,
      elementPatterns,
      elementSettings,
      randomEnabled,
      randomInterval,
      randomPatternPool,
    };
    return JSON.stringify(config, null, 2);
  }, [
    textureEnabled,
    globalPattern,
    globalSettings,
    elementPatterns,
    elementSettings,
    randomEnabled,
    randomInterval,
    randomPatternPool,
  ]);

  const importConfiguration = useCallback((config: string) => {
    try {
      const parsed = JSON.parse(config);
      if (parsed.textureEnabled !== undefined) setTextureEnabled(parsed.textureEnabled);
      if (parsed.globalPattern) setGlobalPatternState(parsed.globalPattern);
      if (parsed.globalSettings) setGlobalSettings(parsed.globalSettings);
      if (parsed.elementPatterns) setElementPatterns(parsed.elementPatterns);
      if (parsed.elementSettings) setElementSettings(parsed.elementSettings);
      if (parsed.randomEnabled !== undefined) setRandomEnabledState(parsed.randomEnabled);
      if (parsed.randomInterval) setRandomIntervalState(parsed.randomInterval);
      if (parsed.randomPatternPool) setRandomPatternPoolState(parsed.randomPatternPool);
    } catch (error) {
      console.error('Failed to import texture configuration:', error);
    }
  }, []);

  const value: TextureContextType = {
    textureEnabled,
    toggleTexture,
    globalPattern,
    setGlobalPattern,
    globalSettings,
    updateGlobalSettings,
    elementPatterns,
    setElementPattern,
    elementSettings,
    updateElementSettings,
    randomEnabled,
    setRandomEnabled,
    randomInterval,
    setRandomInterval,
    randomPatternPool,
    setRandomPatternPool,
    nextRandomPattern,
    getPatternForElement,
    getSettingsForElement,
    resetToDefaults,
    exportConfiguration,
    importConfiguration,
  };

  return <TextureContext.Provider value={value}>{children}</TextureContext.Provider>;
}

