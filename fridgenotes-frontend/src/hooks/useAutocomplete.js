/**
 * useAutocomplete Hook
 *
 * Manages autocomplete suggestions for checklist items. Learns from the
 * user's previously entered items and ranks suggestions by frequency and
 * recency. Data is persisted to localStorage per user.
 *
 * @param {Object} currentUser - Current authenticated user
 * @returns {Object} { userItems, addItem, learnFromNotes, clearItems, cleanup, stats }
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const STORAGE_KEY_PREFIX = 'fridgenotes_autocomplete_';
const MAX_ITEMS = 500;
const MIN_USAGE_COUNT = 2;

export const useAutocomplete = (currentUser) => {
  const [userItems, setUserItems] = useState([]);
  const storageKey = currentUser ? `${STORAGE_KEY_PREFIX}${currentUser.id}` : null;
  const learnThrottleRef = useRef({ lastTime: 0, lastCount: 0 });

  useEffect(() => {
    if (!storageKey) return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.version === 1 && Array.isArray(data.items)) {
          setUserItems(data.items);
        } else {
          setUserItems([]);
        }
      }
    } catch (error) {
      console.error('Error loading autocomplete data:', error);
      setUserItems([]);
    }
  }, [storageKey]);

  const saveUserItems = useCallback((items) => {
    if (!storageKey) return;

    try {
      const data = {
        version: 1,
        items: items.slice(0, MAX_ITEMS),
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving autocomplete data:', error);
    }
  }, [storageKey]);

  const addItem = useCallback((itemText) => {
    if (!itemText || !itemText.trim()) return;

    const normalizedItem = itemText.trim();

    setUserItems(prevItems => {
      const existingIndex = prevItems.findIndex(
        item => item.text.toLowerCase() === normalizedItem.toLowerCase()
      );

      let newItems;
      if (existingIndex >= 0) {
        newItems = [...prevItems];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          count: newItems[existingIndex].count + 1,
          lastUsed: new Date().toISOString(),
        };
      } else {
        newItems = [
          ...prevItems,
          {
            text: normalizedItem,
            count: 1,
            firstUsed: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
          },
        ];
      }

      newItems.sort((a, b) => {
        const aScore = a.count * 10 + (new Date(a.lastUsed).getTime() / 1000000);
        const bScore = b.count * 10 + (new Date(b.lastUsed).getTime() / 1000000);
        return bScore - aScore;
      });

      saveUserItems(newItems);
      return newItems;
    });
  }, [saveUserItems]);

  /**
   * Scans existing notes to seed the autocomplete list.
   * Throttled so rapid note changes don't trigger repeated full scans —
   * skips if fewer than 10 s have passed and the note count hasn't moved
   * by at least 5.
   */
  const learnFromNotes = useCallback((notes) => {
    if (!notes || notes.length === 0) return;

    const now = Date.now();
    const { lastTime, lastCount } = learnThrottleRef.current;
    const timeSinceLastLearning = now - lastTime;
    const countDifference = Math.abs(notes.length - lastCount);

    if (timeSinceLastLearning < 10000 && countDifference < 5) {
      return;
    }

    learnThrottleRef.current = { lastTime: now, lastCount: notes.length };

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

    setUserItems(prevItems => {
      const existingMap = new Map(
        prevItems.map(item => [item.text.toLowerCase(), item])
      );

      const mergedItems = [];

      items.forEach((count, text) => {
        const existing = existingMap.get(text);
        if (existing) {
          mergedItems.push({
            ...existing,
            count: Math.max(existing.count, count),
          });
        } else if (count >= MIN_USAGE_COUNT) {
          mergedItems.push({
            text: text.charAt(0).toUpperCase() + text.slice(1),
            count,
            firstUsed: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
          });
        }
      });

      prevItems.forEach(item => {
        if (!items.has(item.text.toLowerCase())) {
          mergedItems.push(item);
        }
      });

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

  const userItemsArray = useMemo(() => {
    return userItems
      .filter(item => item.count >= MIN_USAGE_COUNT)
      .map(item => item.text);
  }, [userItems]);

  const clearItems = useCallback(() => {
    setUserItems([]);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

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
      activeItems: userItemsArray.length,
    },
  };
};

export default useAutocomplete;
