import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import LabelAutocomplete from './LabelAutocomplete';
import LabelSearch from './LabelSearch';

/**
 * Demo component showcasing the enhanced label autocomplete features
 */
const LabelAutocompleteDemo = () => {
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [searchResults, setSearchResults] = useState('');

  // Mock labels for demo
  const mockSelectedLabels = [
    { id: 1, name: 'Work', display_name: 'Work', color: '#3b82f6' },
    { id: 2, name: 'Important', display_name: 'Important', color: '#ef4444' }
  ];

  const handleLabelSelect = (label) => {
    console.log('Selected label:', label);
    setSelectedLabels(prev => [...prev, label]);
  };

  const handleRemoveLabel = (labelId) => {
    setSelectedLabels(prev => prev.filter(l => l.id !== labelId));
  };

  const handleSearchChange = (term) => {
    setSearchResults(term);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🏷️ Enhanced Label Autocomplete</h1>
        <p className="text-gray-600">Smart label search with keyboard navigation and highlighting</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Autocomplete */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Label Autocomplete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Features:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Real-time search with API integration</li>
                <li>• Keyboard navigation (↑↓ arrows)</li>
                <li>• Search term highlighting</li>
                <li>• Debounced requests (300ms)</li>
                <li>• Auto-select single results with Enter</li>
              </ul>
            </div>
            
            <LabelAutocomplete
              onSelectLabel={handleLabelSelect}
              excludeLabelIds={selectedLabels.map(l => l.id)}
              placeholder="Search for labels..."
              maxResults={5}
            />

            {selectedLabels.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Selected Labels:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedLabels.map(label => (
                    <div
                      key={label.id}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border"
                      style={{ borderColor: label.color }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.display_name}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-3 w-3 p-0 ml-1"
                        onClick={() => handleRemoveLabel(label.id)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Advanced Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Smart Label Search</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Features:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Detects <code>label:</code> prefix</li>
                <li>• Auto-opens autocomplete</li>
                <li>• Shows selected filters</li>
                <li>• Mixed search: text + labels</li>
                <li>• Filter button for quick access</li>
              </ul>
            </div>

            <LabelSearch
              onLabelSelect={handleLabelSelect}
              onSearchTermChange={handleSearchChange}
              selectedLabels={mockSelectedLabels}
              onRemoveLabel={(id) => console.log('Remove label:', id)}
              placeholder="Try typing 'label:work' or use the filter button..."
            />

            {searchResults && (
              <div className="p-3 bg-gray-50 rounded border">
                <h4 className="font-medium mb-1">Search Term:</h4>
                <code className="text-sm">{searchResults}</code>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Integration Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Integration Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold mb-2">In Note Cards</h4>
              <p className="text-sm text-gray-600 mb-2">
                Replace the existing dropdown in LabelPicker with our enhanced autocomplete
              </p>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
{`<LabelAutocomplete
  onSelectLabel={handleAdd}
  excludeLabelIds={[1,2,3]}
  maxResults={8}
/>`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Header Search</h4>
              <p className="text-sm text-gray-600 mb-2">
                Add smart filtering to the main search bar
              </p>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
{`<LabelSearch
  onLabelSelect={filterBy}
  onSearchTermChange={search}
  selectedLabels={filters}
/>`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Custom Trigger</h4>
              <p className="text-sm text-gray-600 mb-2">
                Use any component as the trigger
              </p>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
{`<LabelAutocomplete
  triggerComponent={
    <Button>Custom</Button>
  }
  showAddButton={false}
/>`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⌨️ Keyboard Shortcuts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">↑ ↓</kbd>
              <p className="mt-1 text-gray-600">Navigate suggestions</p>
            </div>
            <div>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Enter</kbd>
              <p className="mt-1 text-gray-600">Select highlighted</p>
            </div>
            <div>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Esc</kbd>
              <p className="mt-1 text-gray-600">Close dropdown</p>
            </div>
            <div>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">label:</kbd>
              <p className="mt-1 text-gray-600">Quick label search</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LabelAutocompleteDemo;