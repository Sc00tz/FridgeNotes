import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Search } from 'lucide-react';
import LabelBadge from './LabelBadge';

const LabelPicker = ({ 
  note,
  allLabels = [],
  onAddLabel,
  onRemoveLabel,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Get labels already attached to this note (with safety checks)
  const noteLabels = Array.isArray(note.labels) ? note.labels.filter(label => label && typeof label === 'object' && label.id) : [];
  const attachedLabelIds = new Set(noteLabels.map(label => label.id) || []);
  
  // Filter available labels (not already attached) based on search
  const availableLabels = allLabels.filter(label => 
    !attachedLabelIds.has(label.id) &&
    (label.display_name || label.name).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleAddLabel = async (label) => {
    try {
      await onAddLabel(note.id, label.id);
      setSearchTerm('');
      setIsOpen(false);
    } catch (error) {
      // Error handled silently
    }
  };

  const handleRemoveLabel = async (labelId) => {
    try {
      await onRemoveLabel(note.id, labelId);
    } catch (error) {
      // Error handled silently
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    } else if (e.key === 'Enter' && availableLabels.length === 1) {
      // Auto-select if only one option
      handleAddLabel(availableLabels[0]);
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
        
        {/* Add label button */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="h-6 px-2 text-xs border border-dashed border-gray-300 hover:border-gray-400"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Label
          </Button>

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border rounded-lg shadow-lg min-w-[200px] max-w-[300px]">
              {/* Search input */}
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3 w-3 text-gray-400" />
                  <Input
                    ref={inputRef}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search labels..."
                    className="pl-7 h-7 text-xs"
                  />
                </div>
              </div>

              {/* Label options */}
              <div className="max-h-48 overflow-y-auto">
                {availableLabels.length === 0 ? (
                  <div className="p-3 text-xs text-gray-500 text-center">
                    {searchTerm ? 'No matching labels found' : 'No more labels available'}
                  </div>
                ) : (
                  <div className="p-1">
                    {availableLabels.map((label) => (
                      <button
                        key={label.id}
                        onClick={() => handleAddLabel(label)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 rounded text-left"
                      >
                        <div
                          className="w-3 h-3 rounded-full border"
                          style={{ backgroundColor: label.color || '#3b82f6' }}
                        />
                        <span className="text-xs flex-1 truncate">
                          {label.display_name || label.name}
                        </span>
                        {label.parent_id && (
                          <span className="text-xs text-gray-400">
                            {label.full_name}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick note if no labels exist */}
              {allLabels.length === 0 && (
                <div className="p-3 text-xs text-gray-500 text-center border-t">
                  <p>No labels created yet.</p>
                  <p>Use the Labels button in the header to create some!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LabelPicker;
