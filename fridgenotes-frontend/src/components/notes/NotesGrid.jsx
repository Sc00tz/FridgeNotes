import React, { useState, useCallback, useRef } from 'react';
import NoteCard from './NoteCard';
import VirtualizedGrid from './VirtualizedGrid';

/**
 * NotesGrid Component
 *
 * Filters, sorts, and renders the note list inside a VirtualizedGrid.
 * Handles drag-and-drop reordering, blocking moves that would interleave
 * pinned and unpinned notes.
 */
const NotesGrid = ({
  notes,
  searchTerm,
  showArchived,
  editingNoteId,
  onUpdate,
  onDelete,
  onShare,
  onChecklistItemUpdate,
  onHideSharedNote,
  onLabelClick,
  onLabelRemove,
  onLabelAdd,
  allLabels,
  onPinToggle,
  onEditToggle,
  onReorder,
  userAutocompleteItems = [],
  onAutocompleteAdd,
}) => {
  const [draggedNoteId, setDraggedNoteId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const filteredNotes = notes.filter(note => {
    if (!searchTerm) return showArchived ? note.archived : !note.archived;

    if (searchTerm.startsWith('label:')) {
      const labelName = searchTerm.substring(6).toLowerCase();
      const hasLabel = note.labels?.some(label =>
        label.display_name.toLowerCase().includes(labelName)
      );
      const matchesArchived = showArchived ? note.archived : !note.archived;
      return hasLabel && matchesArchived;
    }

    const matchesSearch =
      note.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.checklist_items?.some(item =>
        item.text.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      note.labels?.some(label =>
        label.display_name.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesArchived = showArchived ? note.archived : !note.archived;
    return matchesSearch && matchesArchived;
  }).sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return b.pinned - a.pinned;
    }

    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Open a note in the large editor when its card is clicked — but ignore
  // clicks on interactive controls (pin, color, menu, checkboxes, links) so
  // those keep working, and don't fire right after a drag.
  const handleCardOpen = useCallback((e, noteId) => {
    if (isDragging) return;
    if (e.target.closest('button, a, input, textarea, [role="menu"], [role="menuitem"], [role="dialog"]')) {
      return;
    }
    onEditToggle(noteId);
  }, [isDragging, onEditToggle]);

  const handleDragStart = useCallback((e, noteId) => {
    const note = filteredNotes.find(n => n.id === noteId);

    if (note?.pinned) {
      e.preventDefault();
      return;
    }

    setDraggedNoteId(noteId);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', noteId.toString());
    e.target.style.opacity = '0.5';
  }, [filteredNotes]);

  const handleDragEnd = useCallback((e) => {
    e.target.style.opacity = '1';
    setDraggedNoteId(null);
    setDragOverIndex(null);
    setIsDragging(false);
    dragCounter.current = 0;
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e, index) => {
    e.preventDefault();
    dragCounter.current++;
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback(async (e, dropIndex) => {
    e.preventDefault();
    setDragOverIndex(null);
    setIsDragging(false);
    dragCounter.current = 0;

    const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
    if (!draggedId || draggedId === filteredNotes[dropIndex]?.id) {
      return;
    }

    const draggedIndex = filteredNotes.findIndex(note => note.id === draggedId);
    if (draggedIndex === -1) return;

    const draggedNote = filteredNotes[draggedIndex];
    const targetNote = filteredNotes[dropIndex];

    if (draggedNote?.pinned || targetNote?.pinned) {
      return;
    }

    const pinnedNotes = filteredNotes.filter(note => note.pinned);
    const unpinnedNotes = filteredNotes.filter(note => !note.pinned);

    const unpinnedDraggedIndex = unpinnedNotes.findIndex(note => note.id === draggedId);
    // Adjust drop index to be relative to the unpinned sublist.
    const unpinnedDropIndex = dropIndex - pinnedNotes.length;

    if (unpinnedDraggedIndex === -1 || unpinnedDropIndex < 0) return;

    const newUnpinnedOrder = [...unpinnedNotes];
    const [movedNote] = newUnpinnedOrder.splice(unpinnedDraggedIndex, 1);
    newUnpinnedOrder.splice(unpinnedDropIndex, 0, movedNote);

    const newFilteredOrder = [...pinnedNotes, ...newUnpinnedOrder];

    const currentCategoryNotes = notes.filter(note =>
      showArchived ? note.archived : !note.archived
    );

    const visibleNoteIds = new Set(newFilteredOrder.map(note => note.id));
    const hiddenNotes = currentCategoryNotes.filter(note => !visibleNoteIds.has(note.id));

    const finalOrder = [
      ...newFilteredOrder.map(note => note.id),
      ...hiddenNotes.map(note => note.id),
    ];

    if (onReorder) {
      try {
        await onReorder(finalOrder);
      } catch {
        // Reorder errors are non-fatal; the server is the source of truth.
      }
    }
  }, [filteredNotes, notes, showArchived, onReorder]);

  const handleContainerDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleContainerDrop = useCallback(async (e) => {
    e.preventDefault();

    if (e.target.getAttribute('data-note-id')) {
      return;
    }

    const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
    if (!draggedId) return;

    const draggedIndex = filteredNotes.findIndex(note => note.id === draggedId);
    if (draggedIndex === -1 || draggedIndex === filteredNotes.length - 1) {
      return;
    }

    const newFilteredOrder = [...filteredNotes];
    const [draggedNote] = newFilteredOrder.splice(draggedIndex, 1);
    newFilteredOrder.push(draggedNote);

    const currentCategoryNotes = notes.filter(note =>
      showArchived ? note.archived : !note.archived
    );

    const visibleNoteIds = new Set(newFilteredOrder.map(note => note.id));
    const hiddenNotes = currentCategoryNotes.filter(note => !visibleNoteIds.has(note.id));

    const finalOrder = [
      ...newFilteredOrder.map(note => note.id),
      ...hiddenNotes.map(note => note.id),
    ];

    if (onReorder) {
      try {
        await onReorder(finalOrder);
      } catch {
        // Non-fatal.
      }
    }

    setDragOverIndex(null);
    setIsDragging(false);
    dragCounter.current = 0;
  }, [filteredNotes, notes, showArchived, onReorder]);

  if (filteredNotes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          {searchTerm ? 'No notes match your search.' : 'No notes yet. Create your first note!'}
        </div>
      </div>
    );
  }

  const grid = (
    <VirtualizedGrid
      items={filteredNotes}
      className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-h-[200px] ${isDragging ? 'drag-active' : ''}`}
      itemHeight={300}
      buffer={2}
      renderItem={(note, index) => {
        const isDraggedOver = dragOverIndex === index;
        const isBeingDragged = draggedNoteId === note.id;

        return (
          <div
            key={note.id}
            data-note-id={note.id}
            className={`transition-all duration-200 ${isDraggedOver ? 'scale-105 ring-2 ring-blue-500 ring-opacity-50' : ''} ${isBeingDragged ? 'opacity-50 scale-95' : ''} ${note.pinned ? 'cursor-default' : 'cursor-grab'}`}
            draggable={!note.pinned}
            onDragStart={(e) => handleDragStart(e, note.id, index)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onClick={(e) => handleCardOpen(e, note.id)}
          >
            <NoteCard
              note={note}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onShare={onShare}
              onChecklistItemUpdate={(itemId, itemData) => onChecklistItemUpdate(note.id, itemId, itemData)}
              onHideSharedNote={onHideSharedNote}
              onLabelClick={onLabelClick}
              onLabelRemove={onLabelRemove}
              onLabelAdd={onLabelAdd}
              allLabels={allLabels}
              onPinToggle={onPinToggle}
              isEditing={false}
              onEditToggle={(editing) => onEditToggle(editing ? note.id : null)}
              isDragging={isDragging}
              isBeingDragged={isBeingDragged}
              userAutocompleteItems={userAutocompleteItems}
              onAutocompleteAdd={onAutocompleteAdd}
            />
          </div>
        );
      }}
    />
  );

  // The note currently being edited (rendered large in a modal overlay).
  const editingNote = editingNoteId != null
    ? filteredNotes.find(n => n.id === editingNoteId)
    : null;

  return (
    <>
      {grid}

      {/* Keep-style editor: the note opens centered and larger, in edit mode,
          over a backdrop. Reuses NoteCard so all editing behavior is identical. */}
      {editingNote && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
          onClick={() => onEditToggle(null)}
        >
          <div
            className="w-full max-w-2xl mt-4 sm:mt-12"
            onClick={(e) => e.stopPropagation()}
          >
            <NoteCard
              note={editingNote}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onShare={onShare}
              onChecklistItemUpdate={(itemId, itemData) => onChecklistItemUpdate(editingNote.id, itemId, itemData)}
              onHideSharedNote={onHideSharedNote}
              onLabelClick={onLabelClick}
              onLabelRemove={onLabelRemove}
              onLabelAdd={onLabelAdd}
              allLabels={allLabels}
              onPinToggle={onPinToggle}
              isEditing={true}
              onEditToggle={(editing) => onEditToggle(editing ? editingNote.id : null)}
              isDragging={false}
              isBeingDragged={false}
              userAutocompleteItems={userAutocompleteItems}
              onAutocompleteAdd={onAutocompleteAdd}
              largeEditor
            />
          </div>
        </div>
      )}
    </>
  );
};

export default NotesGrid;
