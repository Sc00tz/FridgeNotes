import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';
import apiClient from '../lib/api';

const LabelAutocomplete = ({ 
  onSelectLabel,
  excludeLabelIds = [],
  placeholder = "Search labels...",
  showAddButton = true,
  className = '',
  triggerComponent = null,
  maxResults = 10
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Debounced search function
  const searchLabels = useCallback(
    async (query) => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await apiClient.searchLabels(query);
        // Filter out excluded labels
        const filtered = results
          .filter(label => !excludeLabelIds.includes(label.id))
          .slice(0, maxResults);
        setSuggestions(filtered);
      } catch (error) {
        console.error('Error searching labels:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [excludeLabelIds, maxResults]
  );

  // Debounce search requests
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      searchLabels(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchLabels]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setSelectedIndex(-1);
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

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  const handleSelect = (label) => {
    onSelectLabel(label);
    setIsOpen(false);
    setSearchTerm('');
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setSelectedIndex(-1);
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        } else if (suggestions.length === 1) {
          handleSelect(suggestions[0]);
        }
        break;
    }
  };

  // Highlight matching text in suggestions
  const highlightMatch = (text, query) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 font-medium">
          {part}
        </span>
      ) : part
    );
  };

  // Default trigger button
  const defaultTrigger = showAddButton ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsOpen(!isOpen)}
      className="h-6 px-2 text-xs border border-dashed border-gray-300 hover:border-gray-400"
    >
      <Plus className="h-3 w-3 mr-1" />
      Add Label
    </Button>
  ) : null;

  const trigger = triggerComponent || defaultTrigger;

  return (
    <div className={`label-autocomplete relative ${className}`} ref={dropdownRef}>
      {/* Trigger */}
      {trigger && (
        <div onClick={() => setIsOpen(!isOpen)}>
          {trigger}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border rounded-lg shadow-lg min-w-[250px] max-w-[350px]">
          {/* Search input */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                ref={inputRef}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="pl-9 h-9 text-sm"
              />
              {isLoading && (
                <div className="absolute right-3 top-2.5">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                </div>
              )}
            </div>
          </div>

          {/* Suggestions */}
          <div className="max-h-64 overflow-y-auto">
            {suggestions.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                {searchTerm.trim() ? (
                  isLoading ? 'Searching...' : 'No matching labels found'
                ) : (
                  'Start typing to search labels'
                )}
              </div>
            ) : (
              <div className="p-1">
                {suggestions.map((label, index) => (
                  <button
                    key={label.id}
                    onClick={() => handleSelect(label)}
                    className={`w-full flex items-center gap-3 p-3 rounded text-left transition-colors ${
                      index === selectedIndex 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Color indicator */}
                    <div
                      className="w-4 h-4 rounded-full border flex-shrink-0"
                      style={{ backgroundColor: label.color || '#3b82f6' }}
                    />
                    
                    {/* Label info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {highlightMatch(label.display_name || label.name, searchTerm)}
                      </div>
                      {label.full_name && label.full_name !== (label.display_name || label.name) && (
                        <div className="text-xs text-gray-500 truncate">
                          {label.full_name}
                        </div>
                      )}
                    </div>

                    {/* Keyboard hint for selected item */}
                    {index === selectedIndex && (
                      <CornerDownLeft className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Keyboard shortcuts hint */}
          {suggestions.length > 0 && (
            <div className="p-2 border-t bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
              <span>Use ↑↓ to navigate</span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" />
                to select
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LabelAutocomplete;