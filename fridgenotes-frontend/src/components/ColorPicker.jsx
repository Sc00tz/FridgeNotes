import React, { useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { NOTE_COLORS, COLOR_PICKER_GRID, getColorConfig } from '../utils/colors';

const ColorPicker = ({ currentColor = 'default', onColorChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleColorSelect = (colorValue) => {
    onColorChange(colorValue);
    setIsOpen(false);
  };

  const currentColorConfig = getColorConfig(currentColor);

  return (
    <div className="relative">
      {/* Color Picker Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          p-2 rounded-full transition-all duration-200 
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-gray-100 active:bg-gray-200'
          }
        `}
        title={`Change color (current: ${currentColorConfig.name})`}
        aria-label="Change note color"
      >
        <Palette 
          size={18} 
          className="text-gray-600"
          style={{ color: currentColorConfig.icon }}
        />
      </button>

      {/* Color Picker Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Color Picker Panel */}
          <div className="absolute top-full right-0 mt-2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
            <div className="grid grid-cols-4 gap-1">
              {COLOR_PICKER_GRID.flat().map((colorValue) => {
                const colorConfig = getColorConfig(colorValue);
                const isSelected = currentColor === colorValue;
                
                return (
                  <button
                    key={colorValue}
                    type="button"
                    onClick={() => handleColorSelect(colorValue)}
                    className={`
                      w-8 h-8 rounded-full border-2 transition-all duration-150
                      hover:scale-110 active:scale-95 relative
                      ${isSelected 
                        ? 'border-gray-800 shadow-md' 
                        : 'border-gray-300 hover:border-gray-400'
                      }
                    `}
                    style={{ 
                      backgroundColor: colorConfig.background,
                      borderColor: isSelected ? '#374151' : colorConfig.border
                    }}
                    title={`${colorConfig.name} color`}
                    aria-label={`Change to ${colorConfig.name} color`}
                  >
                    {isSelected && (
                      <Check 
                        size={14} 
                        className="absolute inset-0 m-auto text-gray-700" 
                      />
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Color name display */}
            <div className="mt-2 text-xs text-gray-600 text-center">
              {currentColorConfig.name}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ColorPicker;
