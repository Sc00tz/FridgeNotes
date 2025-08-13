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

// Custom hooks
import { useAuth } from './hooks/useAuth';
import { useAdmin } from './hooks/useAdmin';
import { useShare } from './hooks/useShare';
import useNoteLabels from './hooks/useNoteLabels';
import { ThemeProvider } from './hooks/useTheme';

import './App.css';
import './mobile.css';

function App() {
  // All business logic in hooks
  const auth = useAuth();
  const admin = useAdmin(auth.currentUser);
  const noteLabels = useNoteLabels(auth.currentUser, auth.isAuthenticated);
  const share = useShare();

  // UI state only
  const [modals, setModals] = useState({
    login: false, register: false, profile: false, admin: false, 
    labels: false, createNote: false
  });

  const [form, setForm] = useState({
    searchTerm: '', editingNoteId: null, showArchived: false,
    newNoteType: 'text', shareNote: null, shareUsername: '', shareAccessLevel: 'read'
  });

  useEffect(() => { auth.checkAuthStatus(); }, []);

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
    </div>
  );
}

export default App;