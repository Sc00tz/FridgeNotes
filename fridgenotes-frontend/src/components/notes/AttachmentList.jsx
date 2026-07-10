import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, X, Image as ImageIcon, Mic, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient from '../../lib/api';
import VoiceRecorder from './VoiceRecorder';

/**
 * Renders a note's attachments (image thumbnails + audio players) and, when
 * editing, controls to upload files or record a voice memo.
 *
 * Binaries are auth-protected, so images/audio are fetched as blob object URLs
 * rather than pointed at the URL directly. Object URLs are revoked on unmount.
 */

// One image/audio element that lazily fetches its blob URL (attachments are
// behind session auth, so a plain <img src=/api/...> wouldn't carry cookies
// for a cross-usage cache and can't be revoked cleanly).
const AttachmentMedia = ({ noteId, attachment }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(false);
  const urlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .fetchAttachmentBlobUrl(noteId, attachment.id)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        urlRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => !cancelled && setError(true));

    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [noteId, attachment.id]);

  if (error) {
    return <div className="text-xs text-red-500">Failed to load {attachment.filename}</div>;
  }
  if (!blobUrl) {
    return (
      <div className="flex items-center justify-center w-full h-24 bg-muted/40 rounded-md">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (attachment.attachment_type === 'image') {
    return (
      <a href={blobUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={blobUrl}
          alt={attachment.filename}
          className="max-h-40 w-auto rounded-md object-cover border"
        />
      </a>
    );
  }
  // audio
  return <audio src={blobUrl} controls className="w-full" />;
};

const AttachmentList = ({ noteId, attachments = [], isEditing }) => {
  // Own the list locally, seeded from the note's attachments, and refresh from
  // the server after upload/delete — avoids threading a note-reload callback
  // through the whole component tree.
  const [items, setItems] = useState(attachments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setItems(attachments);
  }, [attachments]);

  // Optimistic notes (offline-created) have a non-numeric client_id and no
  // server row yet, so attachments can't be uploaded until they sync.
  const noteSaved = noteId != null && Number.isInteger(Number(noteId)) && !String(noteId).includes('-');

  const refresh = async () => {
    try {
      const list = await apiClient.listAttachments(noteId);
      if (Array.isArray(list)) setItems(list);
    } catch {
      /* non-fatal: keep showing what we have */
    }
  };

  const doUpload = async (file, filename) => {
    setError(null);
    setUploading(true);
    try {
      await apiClient.uploadAttachment(noteId, file, filename);
      await refresh();
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await doUpload(file, file.name);
    }
    e.target.value = ''; // reset so the same file can be re-picked
  };

  const handleDelete = async (attachmentId) => {
    setError(null);
    try {
      await apiClient.deleteAttachment(noteId, attachmentId);
      await refresh();
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  const hasAttachments = items.length > 0;
  if (!hasAttachments && !isEditing) return null;

  return (
    <div className="attachments-container mt-3 space-y-2">
      {hasAttachments && (
        <div className="grid grid-cols-2 gap-2">
          {items.map((att) => (
            <div key={att.id} className="relative group">
              <AttachmentMedia noteId={noteId} attachment={att} />
              {isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(att.id)}
                  className="absolute top-1 right-1 h-6 w-6 p-0 bg-background/80 hover:bg-red-100 opacity-70 hover:opacity-100"
                  title="Remove attachment"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {isEditing && (
        <div className="space-y-2">
          {!noteSaved ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              Save the note before adding attachments.
            </p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Attach file
              </Button>
              <VoiceRecorder onRecorded={(blob) => doUpload(blob, `voice-memo-${Date.now()}.webm`)} disabled={uploading} />
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default AttachmentList;
