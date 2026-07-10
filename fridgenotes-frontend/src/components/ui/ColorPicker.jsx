import React, { useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { COLOR_PICKER_GRID, getColorConfig } from '../../utils/colors';

/**
 * Note color picker.
 *
 * Layout uses inline styles (fixed-size swatches in an explicit grid) rather
 * than utility classes so that global mobile CSS — e.g. `.grid { width: 100% }`
 * and broad `button` touch-target rules — cannot stretch or overlap the
 * swatches. Keep the critical dimensions inline for that reason.
 */
const SWATCH = 30; // px — swatch diameter

const ColorPicker = ({ currentColor = 'default', onColorChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleColorSelect = (colorValue) => {
    onColorChange(colorValue);
    setIsOpen(false);
  };

  const currentColorConfig = getColorConfig(currentColor);
  const swatches = COLOR_PICKER_GRID.flat();

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`p-2 rounded-full transition-colors duration-200 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        title={`Change color (current: ${currentColorConfig.name})`}
        aria-label="Change note color"
      >
        <Palette size={18} style={{ color: currentColorConfig.icon }} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <div
            className="absolute top-full right-0 mt-2 z-20 rounded-xl shadow-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            style={{ padding: 12 }}
            role="dialog"
            aria-label="Note color picker"
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(4, ${SWATCH}px)`,
                gap: 10,
                justifyContent: 'center',
              }}
            >
              {swatches.map((colorValue) => {
                const colorConfig = getColorConfig(colorValue);
                const isSelected = currentColor === colorValue;

                return (
                  <button
                    key={colorValue}
                    type="button"
                    onClick={() => handleColorSelect(colorValue)}
                    title={`${colorConfig.name} color`}
                    aria-label={`Change to ${colorConfig.name} color`}
                    aria-pressed={isSelected}
                    style={{
                      width: SWATCH,
                      height: SWATCH,
                      minWidth: SWATCH,
                      minHeight: SWATCH,
                      flex: 'none',
                      padding: 0,
                      borderRadius: '9999px',
                      backgroundColor: colorConfig.background,
                      border: `2px solid ${isSelected ? '#3b82f6' : colorConfig.border}`,
                      boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.35)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                    }}
                  >
                    {isSelected && <Check size={16} style={{ color: '#1f2937' }} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>

            {/* Current color name */}
            <div className="mt-3 text-xs text-center text-gray-600 dark:text-gray-300">
              {currentColorConfig.name}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ColorPicker;
