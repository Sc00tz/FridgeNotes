import React, { useState } from 'react';
import { X } from 'lucide-react';

const LabelBadge = ({ 
  label, 
  onRemove = null, 
  onClick = null,
  isClickable = false,
  size = 'sm'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const sizeClasses = {
    xs: 'text-xs px-2 py-0.5',
    sm: 'text-xs px-2 py-1', 
    md: 'text-sm px-3 py-1.5'
  };
  
  const handleClick = () => {
    if (isClickable && onClick) {
      onClick(label);
    }
  };
  
  const handleRemove = (e) => {
    e.stopPropagation(); // Prevent triggering parent click
    if (onRemove) {
      onRemove(label.id);
    }
  };
  
  const labelColor = label.color || '#3b82f6';

  return (
    <div
      className={`
        label-badge inline-flex items-center gap-1 rounded-full border
        transition-all duration-150 select-none
        ${sizeClasses[size]}
        ${isClickable ? 'clickable cursor-pointer hover:shadow-sm hover:scale-105' : ''}
        ${isHovered ? 'shadow-sm' : ''}
      `}
      style={{
        // Tint the badge with the label color: a translucent fill plus the
        // label color for the border/text. Readable on both light and dark
        // note backgrounds (the previous white bg + gray text was invisible
        // against dark cards).
        backgroundColor: `${labelColor}26`, // ~15% opacity
        borderColor: labelColor,
        color: labelColor,
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${label.full_name || label.display_name || label.name}${isClickable ? ' (click to filter)' : ''}`}
    >
      <span className="truncate max-w-[120px] font-medium">
        {label.display_name || label.name}
      </span>

      {onRemove && (
        <button
          onClick={handleRemove}
          className="ml-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors"
          title="Remove label"
        >
          <X size={12} style={{ color: labelColor }} />
        </button>
      )}
    </div>
  );
};

export default LabelBadge;
