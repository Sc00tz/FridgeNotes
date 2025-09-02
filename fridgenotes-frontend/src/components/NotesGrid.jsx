import React, { useState, useCallback, useRef } from 'react';
import NoteCard from './NoteCard';

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
  onAutocompleteAdd
}) => {
  const [draggedNoteId, setDraggedNoteId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Filter and sort notes
  const filteredNotes = notes.filter(note => {
    if (!searchTerm) return showArchived ? note.archived : !note.archived;

    // Check for label filter
    if (searchTerm.startsWith('label:')) {
      const labelName = searchTerm.substring(6).toLowerCase();
      const hasLabel = note.labels?.some(label => 
        label.display_name.toLowerCase().includes(labelName)
      );
      const matchesArchived = showArchived ? note.archived : !note.archived;
      return hasLabel && matchesArchived;
    }

    // Regular text search
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
    // First sort by pinned status (pinned notes first)
    if (a.pinned !== b.pinned) {
      return b.pinned - a.pinned; // true (1) comes before false (0)
    }
    
    // Then sort by position (ascending), then by created_at (descending) as fallback
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Drag and Drop Handlers
  const handleDragStart = useCallback((e, noteId, index) => {
    const note = filteredNotes.find(n => n.id === noteId);
    
    // Prevent dragging pinned notes
    if (note?.pinned) {
      e.preventDefault();
      return;
    }
    
    setDraggedNoteId(noteId);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', noteId.toString());
    
    // Add some visual feedback
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

  const handleDragLeave = useCallback((e) => {
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
      return; // No change needed
    }

    const draggedIndex = filteredNotes.findIndex(note => note.id === draggedId);
    if (draggedIndex === -1) return;

    const draggedNote = filteredNotes[draggedIndex];
    const targetNote = filteredNotes[dropIndex];

    // Prevent dropping pinned notes or dropping onto pinned positions
    if (draggedNote?.pinned || targetNote?.pinned) {
      return;
    }

    // Separate pinned and unpinned notes
    const pinnedNotes = filteredNotes.filter(note => note.pinned);
    const unpinnedNotes = filteredNotes.filter(note => !note.pinned);
    
    // Find indexes within unpinned notes only
    const unpinnedDraggedIndex = unpinnedNotes.findIndex(note => note.id === draggedId);
    const unpinnedDropIndex = dropIndex - pinnedNotes.length; // Adjust for pinned notes at top
    
    if (unpinnedDraggedIndex === -1 || unpinnedDropIndex < 0) return;

    // Reorder only the unpinned notes
    const newUnpinnedOrder = [...unpinnedNotes];
    const [movedNote] = newUnpinnedOrder.splice(unpinnedDraggedIndex, 1);
    newUnpinnedOrder.splice(unpinnedDropIndex, 0, movedNote);

    // Combine pinned notes (unchanged) + reordered unpinned notes
    const newFilteredOrder = [...pinnedNotes, ...newUnpinnedOrder];

    // Get ALL notes for the current category (active or archived)
    const currentCategoryNotes = notes.filter(note => 
      showArchived ? note.archived : !note.archived
    );
    
    // Find notes that are in current category but not visible due to search
    const visibleNoteIds = new Set(newFilteredOrder.map(note => note.id));
    const hiddenNotes = currentCategoryNotes.filter(note => !visibleNoteIds.has(note.id));
    
    // Final order: pinned notes first, then reordered unpinned notes, then hidden notes
    const finalOrder = [
      ...newFilteredOrder.map(note => note.id),
      ...hiddenNotes.map(note => note.id)
    ];
    
    // Call the reorder function
    if (onReorder) {
      try {
        await onReorder(finalOrder);
      } catch (error) {
        // Could add a toast notification here
      }
    }
  }, [filteredNotes, notes, showArchived, onReorder]);

  // Container drop handler for dropping at the end
  const handleContainerDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleContainerDrop = useCallback(async (e) => {
    e.preventDefault();
    
    // Only handle if not dropped on a specific note
    if (e.target.getAttribute('data-note-id')) {
      return;
    }

    const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
    if (!draggedId) return;

    const draggedIndex = filteredNotes.findIndex(note => note.id === draggedId);
    if (draggedIndex === -1 || draggedIndex === filteredNotes.length - 1) {
      return; // Already at the end
    }

    // Move to end
    const newFilteredOrder = [...filteredNotes];
    const [draggedNote] = newFilteredOrder.splice(draggedIndex, 1);
    newFilteredOrder.push(draggedNote);

    // Same logic as handleDrop - get complete order for current category
    const currentCategoryNotes = notes.filter(note => 
      showArchived ? note.archived : !note.archived
    );
    
    const visibleNoteIds = new Set(newFilteredOrder.map(note => note.id));
    const hiddenNotes = currentCategoryNotes.filter(note => !visibleNoteIds.has(note.id));
    
    const finalOrder = [
      ...newFilteredOrder.map(note => note.id),
      ...hiddenNotes.map(note => note.id)
    ];
    
    if (onReorder) {
      try {
        await onReorder(finalOrder);
      } catch (error) {
        // Error handled silently
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

  return (
    <div 
      className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-h-[200px] ${
        isDragging ? 'drag-active' : ''
      }`}
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
    >
      {filteredNotes.map((note, index) => {
        const isDraggedOver = dragOverIndex === index;
        const isBeingDragged = draggedNoteId === note.id;
        
        return (
          <div
            key={note.id}
            data-note-id={note.id}
            className={`transition-all duration-200 ${
              isDraggedOver ? 'scale-105 ring-2 ring-blue-500 ring-opacity-50' : ''
            } ${
              isBeingDragged ? 'opacity-50 scale-95' : ''
            } ${
              note.pinned ? 'cursor-default' : 'cursor-grab'
            }`}
            draggable={(!editingNoteId || editingNoteId !== note.id) && !note.pinned} // Don't drag while editing or if pinned
            onDragStart={(e) => handleDragStart(e, note.id, index)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
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
              isEditing={editingNoteId === note.id}
              onEditToggle={(editing) => onEditToggle(editing ? note.id : null)}
              isDragging={isDragging}
              isBeingDragged={isBeingDragged}
              userAutocompleteItems={userAutocompleteItems}
              onAutocompleteAdd={onAutocompleteAdd}
            />
          </div>
        );
      })}
      
      {/* Visual feedback styles for dragging */}
      <style jsx>{`
        .drag-active .transition-all {
          transition: transform 0.2s ease;
        }
        .drag-active .transition-all:hover:not(.opacity-50) {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
};

export default NotesGrid;