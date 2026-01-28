import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Filter } from 'lucide-react';
import LabelAutocomplete from './LabelAutocomplete';

/**
 * LabelSearch - A search input with label autocomplete for filtering notes
 * Can be used in the header or anywhere else for filtering by labels
 */
const LabelSearch = ({ 
  onLabelSelect,
  onSearchTermChange,
  selectedLabels = [],
  onRemoveLabel,
  placeholder = "Search notes or add label:keyword...",
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showLabelAutocomplete, setShowLabelAutocomplete] = useState(false);
  const [isLabelSearch, setIsLabelSearch] = useState(false);
  
  const inputRef = useRef(null);

  // Detect if user is trying to search by label
  useEffect(() => {
    const trimmed = searchTerm.trim();
    const isLabelQuery = trimmed.startsWith('label:') || trimmed.startsWith('tag:');
    setIsLabelSearch(isLabelQuery);
    
    // Auto-open autocomplete when user types label: or tag:
    if (isLabelQuery && !showLabelAutocomplete) {
      setShowLabelAutocomplete(true);
    }
  }, [searchTerm, showLabelAutocomplete]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearchTermChange?.(value);
  };

  const handleLabelSelect = (label) => {
    // Replace label: prefix with actual selection
    setSearchTerm('');
    setShowLabelAutocomplete(false);
    onLabelSelect?.(label);
  };

  const handleRemoveSelectedLabel = (labelId) => {
    onRemoveLabel?.(labelId);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowLabelAutocomplete(false);
      inputRef.current?.blur();
    }
  };

  // Extract label search term (remove label: prefix)
  const labelSearchTerm = isLabelSearch 
    ? searchTerm.replace(/^(label:|tag:)\s*/, '')
    : '';

  return (
    <div className={`label-search relative ${className}`}>
      {/* Selected labels display */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedLabels.map((label) => (
            <div
              key={label.id}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border"
              style={{ 
                borderColor: label.color || '#3b82f6',
                backgroundColor: `${label.color || '#3b82f6'}10`
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: label.color || '#3b82f6' }}
              />
              <span>{label.display_name || label.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-3 w-3 p-0 hover:bg-transparent"
                onClick={() => handleRemoveSelectedLabel(label.id)}
              >
                <X className="h-2 w-2" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        
        {/* Filter button to show autocomplete */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
          onClick={() => setShowLabelAutocomplete(!showLabelAutocomplete)}
        >
          <Filter className="h-3 w-3" />
        </Button>

        {/* Label autocomplete dropdown */}
        {showLabelAutocomplete && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50">
            <LabelAutocomplete
              onSelectLabel={handleLabelSelect}
              excludeLabelIds={selectedLabels.map(l => l.id)}
              placeholder={isLabelSearch ? labelSearchTerm : "Search labels to filter by..."}
              showAddButton={false}
              triggerComponent={null}
              className="w-full"
              maxResults={6}
            />
          </div>
        )}
      </div>

      {/* Help text for label search */}
      {searchTerm.trim() && !isLabelSearch && (
        <div className="mt-2 text-xs text-gray-500">
          💡 Tip: Type <code className="bg-gray-100 px-1 rounded">label:work</code> to search by labels
        </div>
      )}
    </div>
  );
};

export default LabelSearch;