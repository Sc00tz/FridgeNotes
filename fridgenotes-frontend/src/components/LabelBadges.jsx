import React, { useState } from 'react';
import LabelBadge from './LabelBadge';

const LabelBadges = ({ 
  labels = [], 
  maxVisible = 3, 
  onLabelClick = null,
  onLabelRemove = null,
  isClickable = false,
  editable = false,
  className = ''
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Safety check to ensure labels is always an array and contains valid objects
  const safeLabels = Array.isArray(labels) ? labels.filter(label => label && typeof label === 'object' && label.id) : [];
  
  if (!safeLabels || safeLabels.length === 0) {
    return null;
  }
  
  const visibleLabels = safeLabels.slice(0, maxVisible);
  const hiddenLabels = safeLabels.slice(maxVisible);
  const hasHiddenLabels = hiddenLabels.length > 0;
  
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {/* Visible label badges */}
      {visibleLabels.map((label) => (
        <LabelBadge
          key={label.id}
          label={label}
          onClick={onLabelClick}
          onRemove={editable ? onLabelRemove : null}
          isClickable={isClickable}
          size="sm"
        />
      ))}
      
      {/* "+X more" indicator with tooltip */}
      {hasHiddenLabels && (
        <div 
          className="relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div
            className={`
              label-more-indicator inline-flex items-center px-2 py-1 text-xs
              rounded-full border-2 border-gray-300 bg-gray-50
              text-gray-600 cursor-default
              transition-all duration-150
              ${showTooltip ? 'shadow-sm scale-105' : ''}
            `}
            title={`${hiddenLabels.length} more labels`}
          >
            +{hiddenLabels.length} more
          </div>
          
          {/* Tooltip with hidden labels */}
          {showTooltip && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-10" />
              
              {/* Tooltip */}
              <div className="label-tooltip absolute top-full left-0 mt-2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[200px]">
                <div className="text-xs text-gray-500 mb-1 font-medium">
                  Additional labels:
                </div>
                <div className="flex flex-wrap gap-1">
                  {hiddenLabels.map((label) => (
                    <LabelBadge
                      key={label.id}
                      label={label}
                      onClick={onLabelClick}
                      onRemove={editable ? onLabelRemove : null}
                      isClickable={isClickable}
                      size="xs"
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LabelBadges;
