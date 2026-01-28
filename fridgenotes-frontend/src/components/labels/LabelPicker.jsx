import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Search } from 'lucide-react';
import LabelBadge from './LabelBadge';
import LabelAutocomplete from './LabelAutocomplete';

const LabelPicker = ({ 
  note,
  allLabels = [],
  onAddLabel,
  onRemoveLabel,
  className = ''
}) => {
  // Get labels already attached to this note (with safety checks)
  const noteLabels = Array.isArray(note.labels) ? note.labels.filter(label => label && typeof label === 'object' && label.id) : [];
  const attachedLabelIds = noteLabels.map(label => label.id) || [];

  const handleAddLabel = async (label) => {
    try {
      await onAddLabel(note.id, label.id);
    } catch (error) {
      console.error('Error adding label:', error);
    }
  };

  const handleRemoveLabel = async (labelId) => {
    try {
      await onRemoveLabel(note.id, labelId);
    } catch (error) {
      console.error('Error removing label:', error);
    }
  };

  return (
    <div className={`label-picker ${className}`}>
      {/* Current labels */}
      <div className="flex flex-wrap items-center gap-1 mb-2">
        {noteLabels.map((label) => (
          <LabelBadge
            key={label.id}
            label={label}
            onRemove={() => handleRemoveLabel(label.id)}
            size="sm"
          />
        ))}
        
        {/* Enhanced Label Autocomplete */}
        <LabelAutocomplete
          onSelectLabel={handleAddLabel}
          excludeLabelIds={attachedLabelIds}
          placeholder="Search and add labels..."
          showAddButton={true}
          maxResults={8}
        />
      </div>
    </div>
  );
};

export default LabelPicker;
