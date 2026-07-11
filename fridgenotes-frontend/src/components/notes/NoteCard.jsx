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
  Eye,
  MapPin
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ColorPicker from '../ui/ColorPicker';
import { getColorConfig, generateColorCSS, getThemeAwareColorConfig } from '../../utils/colors';
import { useTheme } from '../../hooks/useTheme.jsx';
import LabelBadges from '../labels/LabelBadges';
import LabelPicker from '../labels/LabelPicker';
import ReminderPicker from '../reminders/ReminderPicker';
import ReminderBadge from '../reminders/ReminderBadge';
import LocationPicker from '../reminders/LocationPicker';
import AttachmentList from './AttachmentList';
import ChecklistItemAutocomplete from './ChecklistItemAutocomplete';
import PinDialog from './PinDialog';
import { Lock, Unlock } from 'lucide-react';
import apiClient from '../../lib/api';
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

  // Private-notes state: the server sends locked notes redacted (is_locked).
  // After the user unlocks, we hold the full note here and render from it.
  const [unlockedContent, setUnlockedContent] = useState(null);
  const [pinDialog, setPinDialog] = useState(null); // 'unlock' | 'setup' | null
  const isLocked = note.is_locked && !unlockedContent;

  // The note whose content we render: the unlocked full version if we have it,
  // otherwise the (possibly redacted) note from props.
  const effectiveNote = unlockedContent || note;

  useEffect(() => {
    setEditedNote(unlockedContent || note);
  }, [note, unlockedContent]);

  // If the note prop changes identity (e.g. re-fetch), drop any stale unlock.
  useEffect(() => {
    setUnlockedContent(null);
  }, [note.id]);

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

  const handleLocationChange = (locationFields) => {
    // Persist immediately (like color) so the location reminder is saved even
    // if the user doesn't hit the note's Save button.
    const updatedNote = { ...editedNote, ...locationFields };
    setEditedNote(updatedNote);
    onUpdate(updatedNote);
  };

  const handleChecklistItemToggle = (itemId, completed) => {
    // Update local state first
    const updatedItems = (editedNote.checklist_items || []).map(item =>
      item.id === itemId ? { ...item, completed } : item
    );
    const updatedNote = { ...editedNote, checklist_items: updatedItems };
    setEditedNote(updatedNote);

    // Temp IDs mean the note hasn't been saved yet — no API call, just keep local state.
    if (String(itemId).startsWith('temp_')) {
      return;
    }

    if (onChecklistItemUpdate && typeof onChecklistItemUpdate === 'function') {
      onChecklistItemUpdate(itemId, { completed });
    } else if (onUpdate && typeof onUpdate === 'function') {
      onUpdate(updatedNote);
    }
  };

  const handleAddChecklistItem = (itemText = null) => {
    const textToAdd = itemText || newChecklistItem.trim();
    if (textToAdd) {
      const newItem = {
        id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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

  // Toggle a note's private flag. Making a note private the first time requires
  // a PIN to exist — if none is set, prompt to create one first.
  const handleTogglePrivate = async () => {
    if (!note.is_private) {
      const { has_private_pin } = await apiClient.getPrivatePinStatus().catch(() => ({ has_private_pin: false }));
      if (!has_private_pin) {
        setPinDialog('setup');
        return;
      }
      onUpdate({ ...note, is_private: true });
    } else {
      // Making public: content must be available. If locked, unlock first.
      if (note.is_locked && !unlockedContent) {
        setPinDialog('unlock');
        return;
      }
      onUpdate({ ...effectiveNote, is_private: false });
    }
  };

  const handleUnlocked = (fullNote) => {
    setUnlockedContent(fullNote);
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
        '--note-bg-hover': colorConfig.backgroundHover,
        '--note-text': colorConfig.text,
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
              className={`h-8 w-8 p-0 transition-opacity border border-transparent hover:border-gray-200 rounded-sm ${note.pinned ? 'opacity-100 text-yellow-600' : 'opacity-30 hover:opacity-100'
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
                <DropdownMenuItem onClick={handleTogglePrivate}>
                  {note.is_private ? (
                    <>
                      <Unlock className="h-4 w-4 mr-2" />
                      Make public
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Make private
                    </>
                  )}
                </DropdownMenuItem>
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
        {isLocked ? (
          /* Locked private note: title is shown (in the header); content is
             withheld until the user unlocks with their PIN. */
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <Lock className="h-8 w-8 opacity-40" style={{ color: colorConfig.text }} />
            <span className="text-sm opacity-70" style={{ color: colorConfig.text }}>
              This note is private
            </span>
            <Button variant="outline" size="sm" onClick={() => setPinDialog('unlock')}>
              <Unlock className="h-4 w-4 mr-2" />
              Unlock
            </Button>
          </div>
        ) : note.note_type === 'text' ? (
          /* Text Note */
          isEditing ? (
            <Textarea
              value={editedNote.content || ''}
              onChange={(e) => setEditedNote({ ...editedNote, content: e.target.value })}
              placeholder="Start writing..."
              className="min-h-[100px] border-none p-0 resize-none focus-visible:ring-0"
            />
          ) : (
            <div className="whitespace-pre-wrap-break text-sm leading-relaxed text-container-safe" style={{ color: colorConfig.text }}>
              {note.content || (
                <span className="italic" style={{ color: colorConfig.text }}>Empty note</span>
              )}
            </div>
          )
        ) : (
          /* Checklist Note */
          <div className="space-y-3">
            {totalCount > 0 && (
              <div className="flex items-center justify-between text-sm" style={{ color: colorConfig.text }}>
                <span>{completedCount} of {totalCount} completed</span>
                {totalCount > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="h-6 px-2 text-xs"
                    style={{ color: colorConfig.text }}
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

            <div className="space-y-2">
              {activeItems.map((item) => (
                <div key={item.id} className="flex items-center space-x-2 group">
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={(checked) => handleChecklistItemToggle(item.id, checked)}
                    className="mt-0.5"
                    style={{ borderColor: colorConfig.text }}
                  />
                  {isEditing ? (
                    <div className="flex-1 flex items-center space-x-2">
                      <Input
                        value={item.text}
                        onChange={(e) => handleChecklistItemTextChange(item.id, e.target.value)}
                        className="text-sm border-none p-0 h-auto focus-visible:ring-0"
                        style={{ color: colorConfig.text }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveChecklistItem(item.id)}
                        className="h-6 w-6 p-0 opacity-40 hover:opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                        style={{ color: colorConfig.text }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm flex-1 text-container-safe break-words-anywhere" style={{ color: colorConfig.text }}>
                      {item.text}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {completedItems.length > 0 && (
              <div className="pt-3" style={{ borderTop: `1px solid ${colorConfig.border}` }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="w-full justify-between h-8 px-0 mb-2"
                  style={{ color: colorConfig.text }}
                >
                  <span className="text-xs">
                    {completedItems.length} completed item{completedItems.length !== 1 ? 's' : ''}
                  </span>
                  {showCompleted ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>

                {showCompleted && (
                  <div className="space-y-2">
                    {completedItems.map((item) => (
                      <div key={item.id} className="flex items-center space-x-2 group">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={(checked) => handleChecklistItemToggle(item.id, checked)}
                          className="mt-0.5"
                          style={{ borderColor: colorConfig.text }}
                        />
                        {isEditing ? (
                          <div className="flex-1 flex items-center space-x-2">
                            <Input
                              value={item.text}
                              onChange={(e) => handleChecklistItemTextChange(item.id, e.target.value)}
                              className="text-sm border-none p-0 h-auto focus-visible:ring-0 line-through"
                              style={{ color: colorConfig.text }}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveChecklistItem(item.id)}
                              className="h-6 w-6 p-0 opacity-40 hover:opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                              style={{ color: colorConfig.text }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm flex-1 line-through text-container-safe break-words-anywhere" style={{ color: colorConfig.text }}>
                            {item.text}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isEditing && (
              <div className="flex items-center space-x-2 pt-2">
                <Plus className="h-4 w-4 mt-0.5" style={{ color: colorConfig.text }} />
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

        {/* Attachments - images and voice memos (hidden while locked) */}
        {!isLocked && (
          <AttachmentList
            noteId={note.id}
            attachments={effectiveNote.attachments || []}
            isEditing={isEditing}
          />
        )}

        {/* Reminder - Show ReminderPicker when editing, ReminderBadge when viewing */}
        {isEditing ? (
          <div className="reminder-container mt-3 space-y-2">
            <ReminderPicker
              reminder={editedNote.reminder_datetime}
              onReminderChange={handleReminderChange}
            />
            <LocationPicker
              note={editedNote}
              onLocationChange={handleLocationChange}
            />
          </div>
        ) : (
          <div className="reminder-container mt-3 space-y-2">
            <ReminderBadge
              reminder={note.reminder_datetime}
              completed={note.reminder_completed}
            />
            {note.reminder_latitude != null && (
              <div className="flex items-center gap-2 p-2 rounded-md border border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/40 dark:text-green-300 text-sm">
                <MapPin size={16} />
                <span className="font-medium">
                  {note.reminder_location_name ||
                    `${note.reminder_latitude.toFixed(4)}, ${note.reminder_longitude.toFixed(4)}`}
                  {note.reminder_radius ? ` · ${note.reminder_radius}m` : ''}
                </span>
              </div>
            )}
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
        <div
          className="flex items-center justify-between mt-4 pt-4 note-metadata"
          style={{ borderTop: `1px solid ${colorConfig.border}`, color: colorConfig.text }}
        >
          <span className="text-xs">
            {note.updated_at ? new Date(note.updated_at).toLocaleDateString() : 'No date'}
          </span>
          <div className="flex items-center gap-1">
            {note.is_private && (
              <Badge variant="outline" className="text-xs flex items-center gap-1" style={{ borderColor: colorConfig.border, color: colorConfig.text }}>
                <Lock className="h-3 w-3" /> Private
              </Badge>
            )}
            {note.pinned && (
              <Badge variant="outline" className="text-xs" style={{ borderColor: colorConfig.border, color: colorConfig.text }}>
                Pinned
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      {/* PIN dialog for setting up / entering the private-notes PIN */}
      {pinDialog && (
        <PinDialog
          mode={pinDialog}
          open={!!pinDialog}
          noteId={note.id}
          onClose={() => setPinDialog(null)}
          onUnlocked={handleUnlocked}
          onPinSet={() => {
            // After creating the PIN via the "Make private" flow, mark private now.
            if (pinDialog === 'setup') onUpdate({ ...note, is_private: true });
          }}
        />
      )}
    </Card>
  );
};

export default NoteCard;