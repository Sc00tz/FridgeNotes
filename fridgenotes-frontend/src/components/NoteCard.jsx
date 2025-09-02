import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  MoreVertical, 
  Edit, 
  Trash2, 
  Share, 
  Archive, 
  ArchiveRestore,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  EyeOff,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ColorPicker from './ColorPicker';
import { getColorConfig, generateColorCSS, getThemeAwareColorConfig } from '../utils/colors';
import { useTheme } from '../hooks/useTheme.jsx';
import LabelBadges from './LabelBadges';
import LabelPicker from './LabelPicker';
import ReminderPicker from './ReminderPicker';
import ReminderBadge from './ReminderBadge';
import ChecklistItemAutocomplete from './ChecklistItemAutocomplete';
import './NoteCard.css';

const NoteCard = ({ 
  note, 
  onUpdate, 
  onDelete, 
  onShare, 
  onChecklistItemUpdate,
  onHideSharedNote,
  onLabelClick,
  onLabelRemove,
  onLabelAdd,
  allLabels = [],
  onPinToggle,
  isEditing,
  onEditToggle,
  userAutocompleteItems = [],
  onAutocompleteAdd
}) => {
  const [editedNote, setEditedNote] = useState(note);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);

  useEffect(() => {
    setEditedNote(note);
  }, [note]);

  const handleSave = () => {
    onUpdate(editedNote);
    onEditToggle(false);
  };

  const handleCancel = () => {
    setEditedNote(note);
    onEditToggle(false);
  };

  const handleReminderChange = (reminderDateTime) => {
    setEditedNote({
      ...editedNote,
      reminder_datetime: reminderDateTime,
      reminder_completed: false, // Reset completion when reminder is changed
      reminder_snoozed_until: null // Clear any snooze when reminder is changed
    });
  };

  const handleChecklistItemToggle = (itemId, completed) => {
    // Update local state first
    const updatedItems = (editedNote.checklist_items || []).map(item =>
      item.id === itemId ? { ...item, completed } : item
    );
    const updatedNote = { ...editedNote, checklist_items: updatedItems };
    setEditedNote(updatedNote);
    
    // Call parent update function only if it exists and is a function
    if (onChecklistItemUpdate && typeof onChecklistItemUpdate === 'function') {
      onChecklistItemUpdate(itemId, { completed });
    } else {
      // Fallback: use the regular onUpdate function
      if (onUpdate && typeof onUpdate === 'function') {
        onUpdate(updatedNote);
      }
    }
  };

  const handleAddChecklistItem = (itemText = null) => {
    const textToAdd = itemText || newChecklistItem.trim();
    if (textToAdd) {
      const newItem = {
        id: Date.now(), // Temporary ID
        text: textToAdd,
        completed: false,
        order: editedNote.checklist_items.length
      };
      const updatedNote = {
        ...editedNote,
        checklist_items: [...editedNote.checklist_items, newItem]
      };
      setEditedNote(updatedNote);
      setNewChecklistItem('');
      
      // Add to user's autocomplete data
      if (onAutocompleteAdd && typeof onAutocompleteAdd === 'function') {
        onAutocompleteAdd(textToAdd);
      }
    }
  };

  const handleRemoveChecklistItem = (itemId) => {
    const updatedItems = editedNote.checklist_items.filter(item => item.id !== itemId);
    const updatedNote = { ...editedNote, checklist_items: updatedItems };
    setEditedNote(updatedNote);
  };

  const handleChecklistItemTextChange = (itemId, text) => {
    const updatedItems = editedNote.checklist_items.map(item =>
      item.id === itemId ? { ...item, text } : item
    );
    const updatedNote = { ...editedNote, checklist_items: updatedItems };
    setEditedNote(updatedNote);
  };

  const handleColorChange = (newColor) => {
    const updatedNote = { ...editedNote, color: newColor };
    setEditedNote(updatedNote);
    onUpdate(updatedNote);
  };

  const handlePinToggle = () => {
    if (onPinToggle) {
      onPinToggle(note.id, !note.pinned);
    }
  };

  // Separate active and completed items
  const activeItems = (editedNote.checklist_items || []).filter(item => !item.completed);
  const completedItems = (editedNote.checklist_items || []).filter(item => item.completed);
  
  const completedCount = completedItems.length;
  const totalCount = (editedNote.checklist_items || []).length;



  // Get theme and color configuration for this note
  const { isDark } = useTheme();
  const colorConfig = getThemeAwareColorConfig(note.color || 'default', isDark);
  const colorStyles = generateColorCSS(note.color || 'default', isDark);

  return (
    <Card 
      className={`
        note-card transition-all duration-200 hover:shadow-lg border-2
        ${note.pinned ? 'ring-2 ring-blue-200' : ''} 
        ${note.archived ? 'opacity-75' : ''}
      `}
      style={{
        backgroundColor: colorConfig.background,
        borderColor: colorConfig.border,
        color: colorConfig.text,
        '--note-bg-hover': colorConfig.backgroundHover
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <Input
                value={editedNote.title}
                onChange={(e) => setEditedNote({ ...editedNote, title: e.target.value })}
                placeholder="Note title..."
                className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0"
                style={{ color: colorConfig.text }}
              />
            ) : (
              <h3 className="text-lg font-semibold leading-tight" style={{ color: colorConfig.text }}>
                {note.title || 'Untitled'}
              </h3>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            {/* Pin Button */}
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 transition-opacity border border-transparent hover:border-gray-200 rounded-sm ${
                note.pinned ? 'opacity-100 text-yellow-600' : 'opacity-30 hover:opacity-100'
              }`}
              onClick={handlePinToggle}
              title={note.pinned ? 'Unpin note' : 'Pin note'}
            >
              {note.pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
            </Button>
            
            {/* Color Picker */}
            <ColorPicker 
              currentColor={note.color || 'default'}
              onColorChange={handleColorChange}
              disabled={false}
            />
            
            {/* More Options Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 opacity-30 hover:opacity-100 transition-opacity border border-transparent hover:border-gray-200 rounded-sm"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditToggle(!isEditing)}>
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditing ? 'Stop Editing' : 'Edit'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onShare(note)}>
                  <Share className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                {note.shared_with_current_user && (
                  <DropdownMenuItem 
                    onClick={() => onHideSharedNote && onHideSharedNote(note, note.current_user_share_id)}
                    className="flex items-center"
                  >
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide from my view
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onUpdate({ ...note, archived: !note.archived })}>
                  {note.archived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(note.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Labels - Show LabelPicker when editing, LabelBadges when viewing */}
        {isEditing ? (
          <div className="labels-container mt-3">
            <LabelPicker
              note={editedNote}
              allLabels={allLabels}
              onAddLabel={onLabelAdd}
              onRemoveLabel={onLabelRemove}
            />
          </div>
        ) : (
          note.labels && note.labels.length > 0 && (
            <div className="labels-container mt-3">
              <LabelBadges 
                labels={note.labels}
                maxVisible={3}
                onLabelClick={onLabelClick}
                onLabelRemove={null}  // No removal when not editing
                isClickable={true}
                editable={false}
                className=""
              />
            </div>
          )
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {note.note_type === 'text' ? (
          /* Text Note */
          isEditing ? (
            <Textarea
              value={editedNote.content || ''}
              onChange={(e) => setEditedNote({ ...editedNote, content: e.target.value })}
              placeholder="Start writing..."
              className="min-h-[100px] border-none p-0 resize-none focus-visible:ring-0"
            />
          ) : (
            <div className="whitespace-pre-wrap-break text-sm leading-relaxed text-container-safe">
              {note.content || (
                <span className="text-muted-foreground italic">Empty note</span>
              )}
            </div>
          )
        ) : (
          /* Checklist Note */
          <div className="space-y-3">
            {/* Progress indicator for checklist */}
            {totalCount > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{completedCount} of {totalCount} completed</span>
                {totalCount > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="h-6 px-2 text-xs"
                  >
                    {showCompleted ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Hide completed
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Show all ({completedCount} hidden)
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Active checklist items */}
            <div className="space-y-2">
              {activeItems.map((item) => (
                <div key={item.id} className="flex items-center space-x-2 group">
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={(checked) => handleChecklistItemToggle(item.id, checked)}
                    className="mt-0.5"
                  />
                  {isEditing ? (
                    <div className="flex-1 flex items-center space-x-2">
                      <Input
                        value={item.text}
                        onChange={(e) => handleChecklistItemTextChange(item.id, e.target.value)}
                        className="text-sm border-none p-0 h-auto focus-visible:ring-0"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveChecklistItem(item.id)}
                        className="h-6 w-6 p-0 opacity-40 hover:opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm flex-1 text-container-safe break-words-anywhere">
                      {item.text}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Completed items section */}
            {completedItems.length > 0 && (
              <div className="pt-3 border-t border-muted">
                {/* Completed items toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="w-full justify-between text-muted-foreground hover:text-foreground h-8 px-0 mb-2"
                >
                  <span className="text-xs">
                    {completedItems.length} completed item{completedItems.length !== 1 ? 's' : ''}
                  </span>
                  {showCompleted ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>

                {/* Completed items list (collapsible) */}
                {showCompleted && (
                  <div className="space-y-2">
                    {completedItems.map((item) => (
                      <div key={item.id} className="flex items-center space-x-2 group opacity-75">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={(checked) => handleChecklistItemToggle(item.id, checked)}
                          className="mt-0.5"
                        />
                        {isEditing ? (
                          <div className="flex-1 flex items-center space-x-2">
                            <Input
                              value={item.text}
                              onChange={(e) => handleChecklistItemTextChange(item.id, e.target.value)}
                              className="text-sm border-none p-0 h-auto focus-visible:ring-0 line-through text-muted-foreground"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveChecklistItem(item.id)}
                              className="h-6 w-6 p-0 opacity-40 hover:opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm flex-1 line-through text-muted-foreground text-container-safe break-words-anywhere">
                            {item.text}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Add new item (only when editing) */}
            {isEditing && (
              <div className="flex items-center space-x-2 pt-2">
                <Plus className="h-4 w-4 text-muted-foreground mt-0.5" />
                <ChecklistItemAutocomplete
                  value={newChecklistItem}
                  onChange={setNewChecklistItem}
                  onSelect={handleAddChecklistItem}
                  placeholder="Add item..."
                  userItems={userAutocompleteItems}
                  className="flex-1"
                />
              </div>
            )}
          </div>
        )}

        {/* Reminder - Show ReminderPicker when editing, ReminderBadge when viewing */}
        {isEditing ? (
          <div className="reminder-container mt-3">
            <ReminderPicker
              reminder={editedNote.reminder_datetime}
              onReminderChange={handleReminderChange}
            />
          </div>
        ) : (
          <div className="reminder-container mt-3">
            <ReminderBadge
              reminder={note.reminder_datetime}
              completed={note.reminder_completed}
            />
          </div>
        )}

        {/* Edit controls */}
        {isEditing && (
          <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        )}

        {/* Note metadata */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t note-metadata">
          <span>
            {note.updated_at ? new Date(note.updated_at).toLocaleDateString() : 'No date'}
          </span>
          {note.pinned && (
            <Badge variant="outline" className="text-xs">
              Pinned
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NoteCard;