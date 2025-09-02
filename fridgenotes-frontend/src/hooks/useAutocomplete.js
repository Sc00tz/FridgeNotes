/**
 * useAutocomplete Hook
 * 
 * Manages autocomplete data for shopping lists and checklist items.
 * Features:
 * - Learns from user's previously used items
 * - Frequency-based ranking of suggestions
 * - Local storage persistence
 * - Cleanup of old/unused items
 * 
 * @param {Object} currentUser - Current authenticated user
 * @returns {Object} Autocomplete utilities and data
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY_PREFIX = 'fridgenotes_autocomplete_';
const MAX_ITEMS = 500; // Maximum items to store per user
const MIN_USAGE_COUNT = 2; // Minimum usage to keep item in suggestions

export const useAutocomplete = (currentUser) => {
  const [userItems, setUserItems] = useState([]);
  const storageKey = currentUser ? `${STORAGE_KEY_PREFIX}${currentUser.id}` : null;

  // Load user items from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        // Validate structure and migrate if necessary
        if (data.version === 1 && Array.isArray(data.items)) {
          setUserItems(data.items);
        } else {
          // Handle legacy data or invalid format
          console.log('Migrating autocomplete data format');
          setUserItems([]);
        }
      }
    } catch (error) {
      console.error('Error loading autocomplete data:', error);
      setUserItems([]);
    }
  }, [storageKey]);

  // Save user items to localStorage
  const saveUserItems = useCallback((items) => {
    if (!storageKey) return;

    try {
      const data = {
        version: 1,
        items: items.slice(0, MAX_ITEMS), // Limit storage
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving autocomplete data:', error);
    }
  }, [storageKey]);

  // Add or update an item in user's autocomplete data
  const addItem = useCallback((itemText) => {
    if (!itemText || !itemText.trim()) return;
    
    const normalizedItem = itemText.trim();
    
    setUserItems(prevItems => {
      // Find existing item
      const existingIndex = prevItems.findIndex(
        item => item.text.toLowerCase() === normalizedItem.toLowerCase()
      );

      let newItems;
      if (existingIndex >= 0) {
        // Update existing item
        newItems = [...prevItems];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          count: newItems[existingIndex].count + 1,
          lastUsed: new Date().toISOString()
        };
      } else {
        // Add new item
        newItems = [
          ...prevItems,
          {
            text: normalizedItem,
            count: 1,
            firstUsed: new Date().toISOString(),
            lastUsed: new Date().toISOString()
          }
        ];
      }

      // Sort by usage frequency and recency
      newItems.sort((a, b) => {
        const aScore = a.count * 10 + (new Date(a.lastUsed).getTime() / 1000000);
        const bScore = b.count * 10 + (new Date(b.lastUsed).getTime() / 1000000);
        return bScore - aScore;
      });

      // Save to localStorage
      saveUserItems(newItems);
      
      return newItems;
    });
  }, [saveUserItems]);

  // Learn from existing notes to populate initial autocomplete data
  const learnFromNotes = useCallback((notes) => {
    if (!Array.isArray(notes)) return;

    const items = new Map();
    
    notes.forEach(note => {
      if (note.note_type === 'checklist' && note.checklist_items) {
        note.checklist_items.forEach(item => {
          const normalizedText = item.text.trim().toLowerCase();
          if (normalizedText && normalizedText.length > 1) {
            if (items.has(normalizedText)) {
              items.set(normalizedText, items.get(normalizedText) + 1);
            } else {
              items.set(normalizedText, 1);
            }
          }
        });
      }
    });

    // Convert to user items format and merge with existing
    setUserItems(prevItems => {
      const existingMap = new Map(
        prevItems.map(item => [item.text.toLowerCase(), item])
      );

      const mergedItems = [];
      
      // Add/update items from notes
      items.forEach((count, text) => {
        const existing = existingMap.get(text);
        if (existing) {
          mergedItems.push({
            ...existing,
            count: Math.max(existing.count, count)
          });
        } else if (count >= MIN_USAGE_COUNT) {
          mergedItems.push({
            text: text.charAt(0).toUpperCase() + text.slice(1), // Capitalize
            count,
            firstUsed: new Date().toISOString(),
            lastUsed: new Date().toISOString()
          });
        }
      });

      // Add existing items that weren't found in notes
      prevItems.forEach(item => {
        if (!items.has(item.text.toLowerCase())) {
          mergedItems.push(item);
        }
      });

      // Sort and limit
      const sortedItems = mergedItems
        .sort((a, b) => {
          const aScore = a.count * 10 + (new Date(a.lastUsed).getTime() / 1000000);
          const bScore = b.count * 10 + (new Date(b.lastUsed).getTime() / 1000000);
          return bScore - aScore;
        })
        .slice(0, MAX_ITEMS);

      saveUserItems(sortedItems);
      return sortedItems;
    });
  }, [saveUserItems]);

  // Get user items as simple string array for autocomplete
  const userItemsArray = useMemo(() => {
    return userItems
      .filter(item => item.count >= MIN_USAGE_COUNT)
      .map(item => item.text);
  }, [userItems]);

  // Clear all autocomplete data
  const clearItems = useCallback(() => {
    setUserItems([]);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  // Remove items that haven't been used recently
  const cleanup = useCallback(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    setUserItems(prevItems => {
      const filteredItems = prevItems.filter(item => {
        const lastUsed = new Date(item.lastUsed);
        return item.count >= MIN_USAGE_COUNT && lastUsed > thirtyDaysAgo;
      });

      if (filteredItems.length !== prevItems.length) {
        saveUserItems(filteredItems);
      }

      return filteredItems;
    });
  }, [saveUserItems]);

  return {
    userItems: userItemsArray,
    addItem,
    learnFromNotes,
    clearItems,
    cleanup,
    stats: {
      totalItems: userItems.length,
      activeItems: userItemsArray.length
    }
  };
};

export default useAutocomplete;