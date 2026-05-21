/**
 * useImportExport Hook
 *
 * Manages data import/export for FridgeNotes. Supports JSON (full backup with
 * labels and checklist items) and CSV (flat notes export). JSON import handles
 * label deduplication and gracefully skips notes that fail to create.
 *
 * @param {Object} currentUser - Current authenticated user
 * @param {Array} notes - Current notes array
 * @param {Array} labels - Current labels array
 * @param {Function} createNote - Function to create new notes
 * @param {Function} createLabel - Function to create new labels
 * @param {Function} addLabelToNote - Function to associate a label with a note
 * @returns {Object} Import/export state and action functions
 */

import { useState, useCallback, useMemo } from 'react';

const EXPORT_VERSION = '1.0';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_FORMATS = ['json', 'csv'];

export const useImportExport = (currentUser, notes = [], labels = [], createNote, createLabel, addLabelToNote) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const clearMessages = useCallback(() => {
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
  }, []);

  const generateFilename = useCallback((format) => {
    const timestamp = new Date().toISOString().split('T')[0];
    const username = currentUser?.username || 'user';
    return `fridgenotes-${username}-${timestamp}.${format}`;
  }, [currentUser]);

  const prepareExportData = useCallback(() => {
    return {
      version: EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      user: {
        username: currentUser?.username,
        id: currentUser?.id,
      },
      labels: labels.map(label => ({
        id: label.id,
        display_name: label.display_name,
        color: label.color,
        created_at: label.created_at,
      })),
      notes: notes.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        note_type: note.note_type,
        color: note.color,
        pinned: note.pinned,
        archived: note.archived,
        position: note.position,
        reminder_date: note.reminder_date,
        created_at: note.created_at,
        updated_at: note.updated_at,
        checklist_items: note.checklist_items?.map(item => ({
          id: item.id,
          text: item.text,
          completed: item.completed,
          order: item.order,
        })) || null,
        labels: note.labels?.map(label => ({
          id: label.id,
          display_name: label.display_name,
          color: label.color,
        })) || [],
      })),
      stats: {
        total_notes: notes.length,
        total_labels: labels.length,
        notes_by_type: {
          text: notes.filter(n => n.note_type === 'text').length,
          checklist: notes.filter(n => n.note_type === 'checklist').length,
        },
      },
    };
  }, [currentUser, notes, labels]);

  const exportToJSON = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const exportData = prepareExportData();
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = generateFilename('json');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(100);
      setSuccess(`Exported ${notes.length} notes and ${labels.length} labels to JSON`);
      clearMessages();
    } catch (error) {
      console.error('Export to JSON failed:', error);
      setError('Failed to export data to JSON');
      clearMessages();
    } finally {
      setIsProcessing(false);
    }
  }, [prepareExportData, generateFilename, notes.length, labels.length, clearMessages]);

  const exportToCSV = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const headers = [
        'ID', 'Title', 'Type', 'Content', 'Color', 'Pinned', 'Archived',
        'Created', 'Updated', 'Labels', 'Checklist Items', 'Reminder',
      ];

      const rows = notes.map(note => [
        note.id,
        `"${(note.title || '').replace(/"/g, '""')}"`,
        note.note_type,
        `"${(note.content || '').replace(/"/g, '""')}"`,
        note.color,
        note.pinned ? 'Yes' : 'No',
        note.archived ? 'Yes' : 'No',
        note.created_at,
        note.updated_at,
        `"${(note.labels || []).map(l => l.display_name).join(', ')}"`,
        `"${(note.checklist_items || []).map(item => `${item.completed ? '[x]' : '[ ]'} ${item.text}`).join('; ').replace(/"/g, '""')}"`,
        note.reminder_date || '',
      ]);

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = generateFilename('csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(100);
      setSuccess(`Exported ${notes.length} notes to CSV`);
      clearMessages();
    } catch (error) {
      console.error('Export to CSV failed:', error);
      setError('Failed to export data to CSV');
      clearMessages();
    } finally {
      setIsProcessing(false);
    }
  }, [notes, generateFilename, clearMessages]);

  const validateImportData = useCallback((data) => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format');
    }

    if (!data.version) {
      throw new Error('Missing version information');
    }

    if (!Array.isArray(data.notes)) {
      throw new Error('Notes data is not an array');
    }

    if (!Array.isArray(data.labels)) {
      throw new Error('Labels data is not an array');
    }

    for (const note of data.notes) {
      if (!note.title && !note.content && !note.checklist_items) {
        throw new Error(`Note ${note.id} has no content`);
      }
      if (!['text', 'checklist'].includes(note.note_type)) {
        throw new Error(`Invalid note type: ${note.note_type}`);
      }
    }

    return true;
  }, []);

  const importFromJSON = useCallback(async (file) => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 10MB limit');
      }

      if (file.type !== 'application/json') {
        throw new Error('Please select a JSON file');
      }

      const text = await file.text();
      const importData = JSON.parse(text);

      validateImportData(importData);

      setProgress(20);

      const existingLabelMap = new Map(
        labels.map(label => [label.display_name.toLowerCase(), label])
      );

      // Maps imported label IDs to the IDs they were assigned in this instance,
      // so note-label associations can be re-created correctly after import.
      const labelMapping = new Map();
      let labelsCreated = 0;

      for (const importLabel of importData.labels || []) {
        const existingLabel = existingLabelMap.get(importLabel.display_name.toLowerCase());

        if (existingLabel) {
          labelMapping.set(importLabel.id, existingLabel.id);
        } else {
          try {
            const newLabel = await createLabel({
              display_name: importLabel.display_name,
              color: importLabel.color,
            });
            labelMapping.set(importLabel.id, newLabel.id);
            labelsCreated++;
          } catch (error) {
            console.warn(`Failed to create label "${importLabel.display_name}":`, error);
          }
        }
      }

      setProgress(40);

      let notesCreated = 0;
      let notesSkipped = 0;
      const totalNotes = importData.notes.length;

      for (let i = 0; i < totalNotes; i++) {
        const importNote = importData.notes[i];

        try {
          const noteData = {
            title: importNote.title || '',
            note_type: importNote.note_type,
            content: importNote.note_type === 'text' ? (importNote.content || '') : undefined,
            color: importNote.color || 'default',
            pinned: importNote.pinned || false,
            archived: importNote.archived || false,
            reminder_date: importNote.reminder_date || null,
            checklist_items: importNote.note_type === 'checklist'
              ? (importNote.checklist_items || []).map(item => ({
                  text: item.text,
                  completed: item.completed || false,
                  order: item.order || 0,
                }))
              : undefined,
          };

          const newNote = await createNote(noteData);

          if (addLabelToNote && importNote.labels && importNote.labels.length > 0) {
            for (const importLabel of importNote.labels) {
              const mappedId = labelMapping.get(importLabel.id);
              if (mappedId) {
                try {
                  await addLabelToNote(newNote.id, mappedId);
                } catch {
                  // Non-fatal: note was created, only the label link failed.
                }
              }
            }
          }

          notesCreated++;
        } catch (error) {
          console.warn(`Failed to create note "${importNote.title}":`, error);
          notesSkipped++;
        }

        setProgress(40 + (i + 1) / totalNotes * 60);
      }

      setProgress(100);

      const message = [
        'Import completed!',
        `${notesCreated} notes created`,
        notesSkipped > 0 ? `${notesSkipped} notes skipped` : null,
        labelsCreated > 0 ? `${labelsCreated} labels created` : null,
      ].filter(Boolean).join(', ');

      setSuccess(message);
      clearMessages();

      return {
        notesCreated,
        notesSkipped,
        labelsCreated,
      };
    } catch (error) {
      console.error('Import failed:', error);
      setError(`Import failed: ${error.message}`);
      clearMessages();
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [validateImportData, labels, createLabel, createNote, addLabelToNote, clearMessages]);

  const stats = useMemo(() => {
    return {
      totalNotes: notes.length,
      totalLabels: labels.length,
      notesByType: {
        text: notes.filter(n => n.note_type === 'text').length,
        checklist: notes.filter(n => n.note_type === 'checklist').length,
      },
      archivedNotes: notes.filter(n => n.archived).length,
      pinnedNotes: notes.filter(n => n.pinned).length,
      notesWithReminders: notes.filter(n => n.reminder_date).length,
    };
  }, [notes, labels]);

  return {
    isProcessing,
    progress,
    error,
    success,
    stats,

    exportToJSON,
    exportToCSV,

    importFromJSON,

    generateFilename,
    supportedFormats: SUPPORTED_FORMATS,
    maxFileSize: MAX_FILE_SIZE,

    clearError: () => setError(null),
    clearSuccess: () => setSuccess(null),
  };
};

export default useImportExport;
