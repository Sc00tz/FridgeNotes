import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus } from 'lucide-react';

/**
 * FridgeNotes - Main Application Component
 * 
 * Architecture: Uses custom hooks for business logic (useAuth, useNoteLabels, useAdmin, useShare)
 * This component handles UI state management and coordinates between hooks and components.
 */

// Components
import AppHeader from './components/AppHeader';
import NotesGrid from './components/NotesGrid';
import CreateNoteDialog from './components/CreateNoteDialog';
import ShareDialog from './components/ShareDialog';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import UserProfileModal from './components/UserProfileModal';
import AdminPanel from './components/AdminPanel';
import LabelManagement from './components/LabelManagement';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import ReminderNotifications from './components/ReminderNotifications';
import ListTemplatesDialog from './components/ListTemplatesDialog';
import OfflineSyncStatus from './components/OfflineSyncStatus';
import ImportExportDialog from './components/ImportExportDialog';
import RecipeToShoppingDialog from './components/RecipeToShoppingDialog';

// Custom hooks
import { useAuth } from './hooks/useAuth';
import { useAdmin } from './hooks/useAdmin';
import { useShare } from './hooks/useShare';
import useNoteLabels from './hooks/useNoteLabels';
import { useAutocomplete } from './hooks/useAutocomplete';
import { useTemplates } from './hooks/useTemplates';
import { useImportExport } from './hooks/useImportExport';
import { ThemeProvider } from './hooks/useTheme.jsx';

import './App.css';
import './mobile.css';

function App() {
  // All business logic in hooks
  const auth = useAuth();
  const admin = useAdmin(auth.currentUser);
  const noteLabels = useNoteLabels(auth.currentUser, auth.isAuthenticated);
  const share = useShare();
  const autocomplete = useAutocomplete(auth.currentUser);
  const templates = useTemplates(auth.currentUser);
  const importExport = useImportExport(
    auth.currentUser, 
    noteLabels.notes, 
    noteLabels.labels, 
    noteLabels.createNote, 
    noteLabels.createLabel
  );

  // UI state only
  const [modals, setModals] = useState({
    login: false, register: false, profile: false, admin: false, 
    labels: false, createNote: false, templates: false, importExport: false, recipe: false
  });

  const [form, setForm] = useState({
    searchTerm: '', editingNoteId: null, showArchived: false,
    newNoteType: 'text', shareNote: null, shareUsername: '', shareAccessLevel: 'read'
  });

  useEffect(() => { auth.checkAuthStatus(); }, []);
  
  // Learn from existing notes when they're loaded
  useEffect(() => {
    if (noteLabels.notes.length > 0) {
      autocomplete.learnFromNotes(noteLabels.notes);
    }
  }, [noteLabels.notes, autocomplete.learnFromNotes]);

  const openModal = useCallback((name) => setModals(prev => ({ ...prev, [name]: true })), []);
  const closeModal = useCallback((name) => setModals(prev => ({ ...prev, [name]: false })), []);

  // Auth handlers
  const handleLogin = async (data) => { await auth.login(data); closeModal('login'); };
  const handleRegister = async (data) => { await auth.register(data); closeModal('register'); };
  const handleLogout = async () => { 
    await auth.logout(); 
    noteLabels.setNotes([]); 
    noteLabels.clearLabels(); 
  };

  // Note handlers
  const handleCreateNote = async () => {
    const noteData = {
      user_id: auth.currentUser.id, title: '', note_type: form.newNoteType,
      content: form.newNoteType === 'text' ? '' : undefined,
      checklist_items: form.newNoteType === 'checklist' ? [] : undefined
    };
    const newNote = await noteLabels.createNote(noteData);
    setForm(prev => ({ ...prev, editingNoteId: newNote.id }));
    closeModal('createNote');
  };

  // Share handlers
  const handleShare = useCallback((note) => setForm(prev => ({ ...prev, shareNote: note })), []);
  const handleShareNote = async () => {
    await share.shareNote(form.shareNote.id, {
      username: form.shareUsername.trim(), access_level: form.shareAccessLevel
    });
    setForm(prev => ({ ...prev, shareNote: null, shareUsername: '', shareAccessLevel: 'read' }));
  };

  const handleHideSharedNote = async (note, shareId) => {
    await share.hideSharedNote(note.id, shareId);
    noteLabels.setNotes(prev => prev.filter(n => n.id !== note.id));
  };

  // Label handlers - now simplified since logic is in useNoteLabels
  const handleLabelClick = useCallback((label) => 
    setForm(prev => ({ ...prev, searchTerm: `label:${label.display_name}` })), []);

  const handleLabelAdd = async (noteId, labelId) => {
    await noteLabels.addLabelToNote(noteId, labelId);
  };

  const handleLabelRemove = async (noteId, labelId) => {
    await noteLabels.removeLabelFromNote(noteId, labelId);
  };

  // Reorder handler
  const handleReorderNotes = async (noteIds) => {
    await noteLabels.reorderNotes(noteIds);
  };

  // Reminder handlers
  const handleCompleteReminder = async (noteId) => {
    try {
      await noteLabels.api.completeReminder(noteId);
      await noteLabels.fetchNotes(); // Refresh notes to get updated state
    } catch (error) {
      console.error('Error completing reminder:', error);
    }
  };

  const handleSnoozeReminder = async (noteId, snoozeUntil) => {
    try {
      await noteLabels.api.snoozeReminder(noteId, snoozeUntil);
      await noteLabels.fetchNotes(); // Refresh notes to get updated state
    } catch (error) {
      console.error('Error snoozing reminder:', error);
    }
  };

  const handleDismissReminder = async (noteId) => {
    try {
      await noteLabels.api.dismissReminder(noteId);
      // Don't need to refresh notes for dismiss - it's just a UI action
    } catch (error) {
      console.error('Error dismissing reminder:', error);
    }
  };

  // Template handlers
  const handleCreateNoteFromTemplate = async (templateData) => {
    try {
      const noteData = {
        user_id: auth.currentUser.id,
        ...templateData
      };
      const newNote = await noteLabels.createNote(noteData);
      setForm(prev => ({ ...prev, editingNoteId: newNote.id }));
      
      // Update template usage statistics
      if (templateData.templateId) {
        await templates.useTemplate(templateData.templateId);
      }
      
      closeModal('templates');
    } catch (error) {
      console.error('Failed to create note from template:', error);
    }
  };

  const handleSaveAsTemplate = async (templateData) => {
    try {
      await templates.createTemplate(templateData);
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  // Recipe handlers
  const handleCreateShoppingListFromRecipe = async (shoppingListData) => {
    try {
      const noteData = {
        user_id: auth.currentUser.id,
        ...shoppingListData
      };
      const newNote = await noteLabels.createNote(noteData);
      setForm(prev => ({ ...prev, editingNoteId: newNote.id }));
      closeModal('recipe');
    } catch (error) {
      console.error('Failed to create shopping list from recipe:', error);
    }
  };

  const getCurrentEditingNote = () => {
    if (!form.editingNoteId) return null;
    return noteLabels.notes.find(note => note.id === form.editingNoteId);
  };

  // Loading screen
  if (auth.loading && !auth.currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
          <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 bg-primary rounded"></div>
              <span className="font-bold">FridgeNotes</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={() => openModal('login')}>
                <LogIn className="h-4 w-4 mr-2" />Sign In
              </Button>
              <Button variant="outline" onClick={() => openModal('register')}>
                <UserPlus className="h-4 w-4 mr-2" />Create Account
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to FridgeNotes</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            A self-hosted note-taking application with real-time collaboration, perfect for shopping lists and notes.
          </p>
        </main>

        <LoginModal isOpen={modals.login} onClose={() => closeModal('login')} onLogin={handleLogin}
          onSwitchToRegister={() => { closeModal('login'); openModal('register'); }}
          loading={auth.loading} error={auth.error} />

        <RegisterModal isOpen={modals.register} onClose={() => closeModal('register')} onRegister={handleRegister}
          onSwitchToLogin={() => { closeModal('register'); openModal('login'); }}
          loading={auth.loading} error={auth.error} />
      </div>
    );
  }

  // Main app
  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        searchTerm={form.searchTerm}
        onSearchChange={(value) => setForm(prev => ({ ...prev, searchTerm: value }))}
        showArchived={form.showArchived}
        onToggleArchived={() => setForm(prev => ({ ...prev, showArchived: !prev.showArchived }))}
        currentUser={auth.currentUser}
        onOpenProfile={() => openModal('profile')}
        onOpenAdmin={() => openModal('admin')}
        onOpenLabels={() => openModal('labels')}
        onOpenImportExport={() => openModal('importExport')}
        onOpenRecipe={() => openModal('recipe')}
        onLogout={handleLogout}
      />

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <CreateNoteDialog
            isOpen={modals.createNote}
            onOpenChange={(open) => setModals(prev => ({ ...prev, createNote: open }))}
            noteType={form.newNoteType}
            onNoteTypeChange={(type) => setForm(prev => ({ ...prev, newNoteType: type }))}
            onCreate={handleCreateNote}
            onOpenTemplates={() => openModal('templates')}
          />
        </div>

        <NotesGrid
          notes={noteLabels.notes} searchTerm={form.searchTerm} showArchived={form.showArchived}
          editingNoteId={form.editingNoteId} onUpdate={noteLabels.updateNote} onDelete={noteLabels.deleteNote}
          onShare={handleShare} onChecklistItemUpdate={noteLabels.updateChecklistItem}
          onHideSharedNote={handleHideSharedNote} onLabelClick={handleLabelClick}
          onLabelRemove={handleLabelRemove} onLabelAdd={handleLabelAdd} allLabels={noteLabels.labels}
          onPinToggle={noteLabels.pinToggle}
          onEditToggle={(noteId) => setForm(prev => ({ ...prev, editingNoteId: noteId }))}
          onReorder={handleReorderNotes}
          userAutocompleteItems={autocomplete.userItems}
          onAutocompleteAdd={autocomplete.addItem}
        />
      </main>

      <ShareDialog note={form.shareNote} isOpen={!!form.shareNote}
        onClose={() => setForm(prev => ({ ...prev, shareNote: null }))}
        username={form.shareUsername} onUsernameChange={(val) => setForm(prev => ({ ...prev, shareUsername: val }))}
        accessLevel={form.shareAccessLevel} onAccessLevelChange={(val) => setForm(prev => ({ ...prev, shareAccessLevel: val }))}
        onShare={handleShareNote} loading={share.loading} />

      <UserProfileModal isOpen={modals.profile} onClose={() => closeModal('profile')} user={auth.currentUser}
        onUpdateProfile={auth.updateProfile} onChangePassword={auth.changePassword}
        loading={auth.loading} error={auth.error} success={auth.success} />

      <AdminPanel isOpen={modals.admin} onClose={() => closeModal('admin')} users={admin.users}
        onCreateUser={admin.createUser} onUpdateUser={admin.updateUser} onDeleteUser={admin.deleteUser}
        onToggleUserActive={admin.toggleUserActive} onToggleUserAdmin={admin.toggleUserAdmin}
        loading={admin.loading} error={admin.error} success={admin.success} />

      <LabelManagement isOpen={modals.labels} onClose={() => closeModal('labels')} labels={noteLabels.labels}
        onCreateLabel={noteLabels.createLabel} onUpdateLabel={noteLabels.updateLabel}
        onDeleteLabel={noteLabels.deleteLabel}
        loading={noteLabels.loading} />

      <ListTemplatesDialog 
        isOpen={modals.templates} 
        onClose={() => closeModal('templates')}
        onCreateNoteFromTemplate={handleCreateNoteFromTemplate}
        onSaveAsTemplate={handleSaveAsTemplate}
        currentNote={getCurrentEditingNote()}
        templates={templates.templates}
        onDeleteTemplate={templates.deleteTemplate}
      />

      <ImportExportDialog
        isOpen={modals.importExport}
        onClose={() => closeModal('importExport')}
        onExportJSON={importExport.exportToJSON}
        onExportCSV={importExport.exportToCSV}
        onImportJSON={importExport.importFromJSON}
        stats={importExport.stats}
        isProcessing={importExport.isProcessing}
        progress={importExport.progress}
        error={importExport.error}
        success={importExport.success}
        onClearMessages={() => {
          importExport.clearError();
          importExport.clearSuccess();
        }}
      />

      <RecipeToShoppingDialog
        isOpen={modals.recipe}
        onClose={() => closeModal('recipe')}
        onCreateShoppingList={handleCreateShoppingListFromRecipe}
      />

      {/* Status messages */}
      {(auth.error || noteLabels.error || admin.error || share.error) && (
        <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-md z-50">
          {auth.error || noteLabels.error || admin.error || share.error}
        </div>
      )}
      {(auth.success || noteLabels.success || admin.success || share.success) && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md z-50">
          {auth.success || noteLabels.success || admin.success || share.success}
        </div>
      )}

      {/* Reminder Notifications */}
      <ReminderNotifications
        notes={noteLabels.filteredNotes}
        onMarkComplete={handleCompleteReminder}
        onSnooze={handleSnoozeReminder}
        onDismiss={handleDismissReminder}
      />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Offline Sync Status */}
      <OfflineSyncStatus
        isOnline={noteLabels.offlineSync?.isOnline}
        isSyncing={noteLabels.offlineSync?.isSyncing}
        queueSize={noteLabels.offlineSync?.queueSize}
        lastSync={noteLabels.offlineSync?.lastSync}
        syncErrors={noteLabels.offlineSync?.syncErrors}
        onForceSync={noteLabels.offlineSync?.forcSync}
        onClearQueue={noteLabels.offlineSync?.clearSyncQueue}
      />
    </div>
  );
}

export default App;