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
  
  return (
    <div
      className={`
        label-badge inline-flex items-center gap-1 rounded-full border-2 bg-white
        transition-all duration-150 select-none
        ${sizeClasses[size]}
        ${isClickable ? 'clickable cursor-pointer hover:shadow-sm hover:scale-105' : ''}
        ${isHovered ? 'shadow-sm' : ''}
      `}
      style={{
        borderColor: label.color || '#3b82f6',
        color: '#374151' // Neutral text color
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${label.full_name || label.display_name || label.name}${isClickable ? ' (click to filter)' : ''}`}
    >
      <span className="truncate max-w-[120px]">
        {label.display_name || label.name}
      </span>
      
      {onRemove && (
        <button
          onClick={handleRemove}
          className="ml-1 hover:bg-gray-100 rounded-full p-0.5 transition-colors"
          title="Remove label"
        >
          <X size={12} className="text-gray-500 hover:text-gray-700" />
        </button>
      )}
    </div>
  );
};

export default LabelBadge;
