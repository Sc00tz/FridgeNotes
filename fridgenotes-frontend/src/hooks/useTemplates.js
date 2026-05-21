/**
 * useTemplates Hook
 *
 * Manages list templates for quick note creation. Templates are stored in
 * localStorage per user and sorted by usage frequency + recency so the most
 * relevant ones surface first.
 *
 * @param {Object} currentUser - Current authenticated user
 * @returns {Object} Template list (sorted), CRUD actions, similarity search, and stats
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY_PREFIX = 'fridgenotes_templates_';
const MAX_TEMPLATES = 50;

export const useTemplates = (currentUser) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const storageKey = currentUser ? `${STORAGE_KEY_PREFIX}${currentUser.id}` : null;

  useEffect(() => {
    if (!storageKey) return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.version === 1 && Array.isArray(data.templates)) {
          setTemplates(data.templates);
        } else {
          setTemplates([]);
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      setError('Failed to load templates');
      setTemplates([]);
    }
  }, [storageKey]);

  const saveTemplates = useCallback((templatesList) => {
    if (!storageKey) return;

    try {
      const data = {
        version: 1,
        templates: templatesList.slice(0, MAX_TEMPLATES),
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving templates:', error);
      setError('Failed to save templates');
    }
  }, [storageKey]);

  const createTemplate = useCallback(async (templateData) => {
    if (!templateData.name || !Array.isArray(templateData.items)) {
      throw new Error('Invalid template data');
    }

    setLoading(true);
    setError(null);

    try {
      const newTemplate = {
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: templateData.name.trim(),
        description: templateData.description || '',
        items: templateData.items.filter(item => item && item.trim()),
        color: templateData.color || 'default',
        created_at: new Date().toISOString(),
        created_from_note_id: templateData.created_from_note_id || null,
        usage_count: 0,
      };

      setTemplates(prev => {
        const updated = [newTemplate, ...prev];
        saveTemplates(updated);
        return updated;
      });

      return newTemplate;
    } catch (error) {
      setError(`Failed to create template: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [saveTemplates]);

  const updateTemplate = useCallback(async (templateId, updates) => {
    setLoading(true);
    setError(null);

    try {
      setTemplates(prev => {
        const updated = prev.map(template =>
          template.id === templateId
            ? {
                ...template,
                ...updates,
                updated_at: new Date().toISOString(),
              }
            : template
        );
        saveTemplates(updated);
        return updated;
      });
    } catch (error) {
      setError(`Failed to update template: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [saveTemplates]);

  const deleteTemplate = useCallback(async (templateId) => {
    setLoading(true);
    setError(null);

    try {
      setTemplates(prev => {
        const updated = prev.filter(template => template.id !== templateId);
        saveTemplates(updated);
        return updated;
      });
    } catch (error) {
      setError(`Failed to delete template: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [saveTemplates]);

  const useTemplate = useCallback(async (templateId) => {
    try {
      setTemplates(prev => {
        const updated = prev.map(template =>
          template.id === templateId
            ? {
                ...template,
                usage_count: (template.usage_count || 0) + 1,
                last_used: new Date().toISOString(),
              }
            : template
        );
        saveTemplates(updated);
        return updated;
      });
    } catch (error) {
      console.error('Failed to update template usage:', error);
      // Non-critical — do not rethrow.
    }
  }, [saveTemplates]);

  const getSortedTemplates = useCallback(() => {
    return [...templates].sort((a, b) => {
      const usageA = a.usage_count || 0;
      const usageB = b.usage_count || 0;

      if (usageA !== usageB) {
        return usageB - usageA;
      }

      const lastUsedA = a.last_used ? new Date(a.last_used).getTime() : 0;
      const lastUsedB = b.last_used ? new Date(b.last_used).getTime() : 0;

      if (lastUsedA !== lastUsedB) {
        return lastUsedB - lastUsedA;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [templates]);

  const findSimilarTemplates = useCallback((note) => {
    if (!note || note.note_type !== 'checklist' || !note.checklist_items) {
      return [];
    }

    const noteItems = note.checklist_items.map(item => item.text.toLowerCase());

    return templates
      .map(template => {
        const templateItems = template.items.map(item => item.toLowerCase());
        const commonItems = noteItems.filter(item =>
          templateItems.some(tItem => tItem.includes(item) || item.includes(tItem))
        );

        return {
          ...template,
          similarity: commonItems.length / Math.max(noteItems.length, templateItems.length),
        };
      })
      .filter(t => t.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  }, [templates]);

  const clearTemplates = useCallback(() => {
    setTemplates([]);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  return {
    templates: getSortedTemplates(),
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    useTemplate,
    findSimilarTemplates,
    clearTemplates,
    stats: {
      totalTemplates: templates.length,
      totalUsage: templates.reduce((sum, t) => sum + (t.usage_count || 0), 0),
    },
  };
};

export default useTemplates;
