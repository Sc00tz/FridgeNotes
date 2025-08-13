// FridgeNotes color palette
// These colors provide a clean and organized note-taking experience

export const NOTE_COLORS = {
  default: {
    name: 'Default',
    value: 'default',
    background: '#ffffff',
    backgroundHover: '#f8f9fa',
    border: '#e0e0e0',
    text: '#202124',
    icon: '#5f6368',
    // Dark mode variants
    backgroundDark: '#1f2937',
    backgroundHoverDark: '#374151',
    borderDark: '#4b5563',
    textDark: '#f9fafb',
    iconDark: '#9ca3af'
  },
  coral: {
    name: 'Coral',
    value: 'coral',
    background: '#faafa8',
    backgroundHover: '#f28b82',
    border: '#e06055',
    text: '#202124',
    icon: '#d33b2c',
    // Dark mode variants
    backgroundDark: '#7f1d1d',
    backgroundHoverDark: '#991b1b',
    borderDark: '#dc2626',
    textDark: '#fef2f2',
    iconDark: '#fca5a5'
  },
  peach: {
    name: 'Peach', 
    value: 'peach',
    background: '#fcc2b0',
    backgroundHover: '#fbbc04',
    border: '#f4a261',
    text: '#202124',
    icon: '#e76f51'
  },
  sand: {
    name: 'Sand',
    value: 'sand', 
    background: '#fff8b8',
    backgroundHover: '#fef7cd',
    border: '#f9c74f',
    text: '#202124',
    icon: '#f9844a'
  },
  mint: {
    name: 'Mint',
    value: 'mint',
    background: '#b4ddd3',
    backgroundHover: '#a7d3c9',
    border: '#6ab187',
    text: '#202124',
    icon: '#00695c'
  },
  sage: {
    name: 'Sage',
    value: 'sage',
    background: '#d3e5ab',
    backgroundHover: '#ccdf90',
    border: '#9ccc65',
    text: '#202124',
    icon: '#689f38'
  },
  fog: {
    name: 'Fog',
    value: 'fog',
    background: '#aecbfa',
    backgroundHover: '#a5c9ea',
    border: '#64b5f6',
    text: '#202124',
    icon: '#1976d2'
  },
  storm: {
    name: 'Storm', 
    value: 'storm',
    background: '#d5d6db',
    backgroundHover: '#c8ccd1',
    border: '#9aa0a6',
    text: '#202124',
    icon: '#5f6368'
  },
  dusk: {
    name: 'Dusk',
    value: 'dusk',
    background: '#f6aea9',
    backgroundHover: '#f48fb1',
    border: '#e1bee7',
    text: '#202124',
    icon: '#8e24aa'
  },
  blossom: {
    name: 'Blossom',
    value: 'blossom', 
    background: '#fdcfe8',
    backgroundHover: '#f8bbd9',
    border: '#f48fb1',
    text: '#202124',
    icon: '#c2185b'
  },
  clay: {
    name: 'Clay',
    value: 'clay',
    background: '#e9bcbb',
    backgroundHover: '#d7aaa7',
    border: '#a1887f',
    text: '#202124',
    icon: '#6d4c41'
  },
  chalk: {
    name: 'Chalk',
    value: 'chalk',
    background: '#f0f4c3',
    backgroundHover: '#e6ee9c',
    border: '#dce775',
    text: '#202124',
    icon: '#827717'
  }
};

// Helper function to get color configuration
export const getColorConfig = (colorValue) => {
  return NOTE_COLORS[colorValue] || NOTE_COLORS.default;
};

// Theme-aware color configuration
export const getThemeAwareColorConfig = (colorValue, isDark = false) => {
  const colorConfig = NOTE_COLORS[colorValue] || NOTE_COLORS.default;
  
  if (!isDark) {
    return {
      background: colorConfig.background,
      backgroundHover: colorConfig.backgroundHover,
      border: colorConfig.border,
      text: colorConfig.text,
      icon: colorConfig.icon
    };
  }
  
  // Dark mode - use dark variants if available, otherwise darken light colors
  return {
    background: colorConfig.backgroundDark || colorConfig.background,
    backgroundHover: colorConfig.backgroundHoverDark || colorConfig.backgroundHover,
    border: colorConfig.borderDark || colorConfig.border,
    text: colorConfig.textDark || '#f9fafb',
    icon: colorConfig.iconDark || colorConfig.icon
  };
};

// Array of color options for UI (excluding default for selection palette)
export const COLOR_OPTIONS = Object.values(NOTE_COLORS).filter(color => color.value !== 'default');

// CSS custom properties generator for dynamic theming
export const generateColorCSS = (colorValue, isDark = false) => {
  const config = getThemeAwareColorConfig(colorValue, isDark);
  return {
    '--note-bg': config.background,
    '--note-bg-hover': config.backgroundHover,
    '--note-border': config.border,
    '--note-text': config.text,
    '--note-icon': config.icon
  };
};

// Tailwind-compatible color classes
export const getColorClasses = (colorValue) => {
  const colorMap = {
    default: 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50',
    coral: 'bg-red-200 border-red-300 text-gray-900 hover:bg-red-300',
    peach: 'bg-orange-200 border-orange-300 text-gray-900 hover:bg-orange-300', 
    sand: 'bg-yellow-200 border-yellow-300 text-gray-900 hover:bg-yellow-300',
    mint: 'bg-teal-200 border-teal-300 text-gray-900 hover:bg-teal-300',
    sage: 'bg-green-200 border-green-300 text-gray-900 hover:bg-green-300',
    fog: 'bg-blue-200 border-blue-300 text-gray-900 hover:bg-blue-300',
    storm: 'bg-gray-200 border-gray-300 text-gray-900 hover:bg-gray-300',
    dusk: 'bg-purple-200 border-purple-300 text-gray-900 hover:bg-purple-300',
    blossom: 'bg-pink-200 border-pink-300 text-gray-900 hover:bg-pink-300',
    clay: 'bg-amber-200 border-amber-300 text-gray-900 hover:bg-amber-300',
    chalk: 'bg-lime-200 border-lime-300 text-gray-900 hover:bg-lime-300'
  };
  
  return colorMap[colorValue] || colorMap.default;
};

// Color picker component data
export const COLOR_PICKER_GRID = [
  ['default', 'coral', 'peach', 'sand'],
  ['mint', 'sage', 'fog', 'storm'], 
  ['dusk', 'blossom', 'clay', 'chalk']
];
