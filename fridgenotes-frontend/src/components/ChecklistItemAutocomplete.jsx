/**
 * ChecklistItemAutocomplete Component
 * 
 * Provides intelligent autocomplete for shopping list/checklist items.
 * Features:
 * - Common grocery/shopping items database
 * - Learning from user's previous items
 * - Smart filtering and ranking
 * - Keyboard navigation
 * - Custom item addition
 * 
 * Props:
 *   value: Current input value
 *   onChange: Function to handle input value changes
 *   onSelect: Function called when item is selected
 *   placeholder: Input placeholder text
 *   disabled: Whether input is disabled
 *   userItems: Array of user's previous items for personalized suggestions
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Check } from 'lucide-react';

// Common shopping/grocery items database with categories
const COMMON_ITEMS = [
  // Produce
  { item: 'Apples', category: 'Produce' }, { item: 'Bananas', category: 'Produce' }, 
  { item: 'Oranges', category: 'Produce' }, { item: 'Lemons', category: 'Produce' }, 
  { item: 'Limes', category: 'Produce' }, { item: 'Grapes', category: 'Produce' }, 
  { item: 'Strawberries', category: 'Produce' }, { item: 'Blueberries', category: 'Produce' },
  { item: 'Tomatoes', category: 'Produce' }, { item: 'Onions', category: 'Produce' }, 
  { item: 'Garlic', category: 'Produce' }, { item: 'Potatoes', category: 'Produce' }, 
  { item: 'Carrots', category: 'Produce' }, { item: 'Celery', category: 'Produce' }, 
  { item: 'Bell peppers', category: 'Produce' }, { item: 'Broccoli', category: 'Produce' },
  { item: 'Spinach', category: 'Produce' }, { item: 'Lettuce', category: 'Produce' }, 
  { item: 'Cucumber', category: 'Produce' }, { item: 'Avocados', category: 'Produce' }, 
  { item: 'Mushrooms', category: 'Produce' }, { item: 'Zucchini', category: 'Produce' }, 
  { item: 'Green beans', category: 'Produce' },
  
  // Dairy & Eggs
  { item: 'Milk', category: 'Dairy' }, { item: 'Eggs', category: 'Dairy' }, 
  { item: 'Butter', category: 'Dairy' }, { item: 'Cheese', category: 'Dairy' },
  { item: 'Yogurt', category: 'Dairy' }, { item: 'Cream cheese', category: 'Dairy' }, 
  { item: 'Sour cream', category: 'Dairy' }, { item: 'Heavy cream', category: 'Dairy' },
  
  // Meat & Seafood
  { item: 'Chicken breast', category: 'Meat & Seafood' }, { item: 'Ground beef', category: 'Meat & Seafood' }, 
  { item: 'Salmon', category: 'Meat & Seafood' }, { item: 'Shrimp', category: 'Meat & Seafood' }, 
  { item: 'Bacon', category: 'Meat & Seafood' }, { item: 'Ham', category: 'Meat & Seafood' }, 
  { item: 'Turkey', category: 'Meat & Seafood' }, { item: 'Pork chops', category: 'Meat & Seafood' },
  
  // Pantry Staples
  { item: 'Bread', category: 'Bakery' }, { item: 'Rice', category: 'Pantry' }, 
  { item: 'Pasta', category: 'Pantry' }, { item: 'Flour', category: 'Pantry' }, 
  { item: 'Sugar', category: 'Pantry' }, { item: 'Salt', category: 'Spices' }, 
  { item: 'Black pepper', category: 'Spices' }, { item: 'Olive oil', category: 'Pantry' }, 
  { item: 'Vegetable oil', category: 'Pantry' }, { item: 'Vinegar', category: 'Pantry' }, 
  { item: 'Baking soda', category: 'Pantry' }, { item: 'Baking powder', category: 'Pantry' }, 
  { item: 'Vanilla extract', category: 'Pantry' }, { item: 'Honey', category: 'Pantry' }, 
  { item: 'Peanut butter', category: 'Pantry' },
  
  // Canned/Packaged
  { item: 'Canned tomatoes', category: 'Canned Goods' }, { item: 'Chicken broth', category: 'Canned Goods' }, 
  { item: 'Vegetable broth', category: 'Canned Goods' }, { item: 'Canned beans', category: 'Canned Goods' }, 
  { item: 'Tuna', category: 'Canned Goods' }, { item: 'Cereal', category: 'Pantry' },
  { item: 'Oatmeal', category: 'Pantry' }, { item: 'Crackers', category: 'Pantry' }, 
  { item: 'Chips', category: 'Pantry' }, { item: 'Granola bars', category: 'Pantry' },
  
  // Frozen
  { item: 'Frozen vegetables', category: 'Frozen' }, { item: 'Frozen berries', category: 'Frozen' }, 
  { item: 'Ice cream', category: 'Frozen' }, { item: 'Frozen pizza', category: 'Frozen' }, 
  { item: 'Frozen chicken', category: 'Frozen' },
  
  // Beverages
  { item: 'Coffee', category: 'Beverages' }, { item: 'Tea', category: 'Beverages' }, 
  { item: 'Juice', category: 'Beverages' }, { item: 'Soda', category: 'Beverages' }, 
  { item: 'Water', category: 'Beverages' }, { item: 'Wine', category: 'Beverages' }, 
  { item: 'Beer', category: 'Beverages' },
  
  // Personal Care
  { item: 'Toothpaste', category: 'Other' }, { item: 'Shampoo', category: 'Other' }, 
  { item: 'Soap', category: 'Other' }, { item: 'Deodorant', category: 'Other' }, 
  { item: 'Toilet paper', category: 'Other' }, { item: 'Paper towels', category: 'Other' }, 
  { item: 'Tissues', category: 'Other' },
  
  // Cleaning
  { item: 'Dish soap', category: 'Other' }, { item: 'Laundry detergent', category: 'Other' }, 
  { item: 'All-purpose cleaner', category: 'Other' }, { item: 'Sponges', category: 'Other' }
];

const ChecklistItemAutocomplete = ({ 
  value, 
  onChange, 
  onSelect, 
  placeholder = "Add item...", 
  disabled = false,
  userItems = [],
  className = "",
  suggestedCategory = null,
  onSelectWithCategory = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Combine and rank suggestions
  const suggestions = useMemo(() => {
    if (!value || value.length < 1) return [];

    const query = value.toLowerCase().trim();
    const suggestions = [];

    // Add user items first (personalized suggestions have higher priority)
    const userMatches = userItems
      .filter(item => item.toLowerCase().includes(query))
      .map(item => ({
        text: item,
        type: 'user',
        category: 'Recent',
        score: getMatchScore(item.toLowerCase(), query) + 100 // Boost user items
      }));

    // Add common items
    const commonMatches = COMMON_ITEMS
      .filter(item => item.item.toLowerCase().includes(query))
      .map(item => ({
        text: item.item,
        type: 'common',
        category: item.category,
        score: getMatchScore(item.item.toLowerCase(), query) + 
               (suggestedCategory && item.category === suggestedCategory ? 50 : 0) // Boost category matches
      }));

    // Combine and deduplicate
    const allMatches = [...userMatches, ...commonMatches];
    const seen = new Set();
    const deduped = allMatches.filter(item => {
      const key = item.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by score (higher is better) and take top 8
    return deduped
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [value, userItems]);

  // Calculate match score for ranking
  function getMatchScore(item, query) {
    const itemLower = item.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Exact match gets highest score
    if (itemLower === queryLower) return 1000;
    
    // Starts with query gets high score
    if (itemLower.startsWith(queryLower)) return 500;
    
    // Contains query gets medium score
    if (itemLower.includes(queryLower)) return 100;
    
    // Calculate fuzzy match score
    let score = 0;
    let queryIndex = 0;
    
    for (let i = 0; i < itemLower.length && queryIndex < queryLower.length; i++) {
      if (itemLower[i] === queryLower[queryIndex]) {
        score += 10;
        queryIndex++;
      }
    }
    
    return score;
  }

  // Handle input changes
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(newValue.length > 0);
    setSelectedIndex(-1);
  };

  // Handle item selection
  const handleSelect = (suggestion) => {
    if (onSelectWithCategory && suggestion.category) {
      onSelectWithCategory(suggestion.text, suggestion.category);
    } else {
      onSelect(suggestion.text);
    }
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (value.trim()) {
          onSelect(value.trim());
        }
      }
      return;
    }

    switch (e.key) {
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
        } else if (value.trim()) {
          onSelect(value.trim());
        }
        break;
      
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      
      default:
        break;
    }
  };

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(value.length > 0)}
        placeholder={placeholder}
        disabled={disabled}
        className="text-sm border-none p-0 h-auto focus-visible:ring-0"
        autoComplete="off"
      />
      
      {isOpen && suggestions.length > 0 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto shadow-lg border">
          <div className="p-1">
            {suggestions.map((suggestion, index) => (
              <Button
                key={suggestion.text}
                variant={index === selectedIndex ? "secondary" : "ghost"}
                className={`w-full justify-start text-left h-auto p-2 font-normal ${
                  index === selectedIndex ? 'bg-secondary' : 'hover:bg-secondary/50'
                }`}
                onClick={() => handleSelect(suggestion)}
              >
                <div className="flex items-center w-full">
                  <span className="flex-1">{suggestion.text}</span>
                  <div className="flex items-center gap-1 ml-2">
                    {suggestion.category && suggestion.type !== 'user' && (
                      <span className="text-xs bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                        {suggestion.category}
                      </span>
                    )}
                    {suggestion.type === 'user' && (
                      <span className="text-xs text-muted-foreground">Recent</span>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ChecklistItemAutocomplete;