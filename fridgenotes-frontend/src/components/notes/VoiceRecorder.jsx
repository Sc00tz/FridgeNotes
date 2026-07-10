import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Records a voice memo via the MediaRecorder API and hands the resulting audio
 * Blob to onRecorded (which uploads it). Requests mic permission on first use.
 *
 * The recorded MIME type depends on the browser (Chrome/Firefox: audio/webm;
 * Safari: audio/mp4) — both are in the server's allowlist.
 */
const VoiceRecorder = ({ onRecorded, disabled = false }) => {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Clean up the mic stream and timer if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        // Stop the mic so the browser's recording indicator clears.
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (blob.size > 0) onRecorded?.(blob);
      };

      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Could not start recording');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2">
      {recording ? (
        <Button
          variant="outline"
          size="sm"
          onClick={stopRecording}
          className="flex items-center gap-1 text-red-600 border-red-300"
        >
          <Square className="h-4 w-4 fill-current" />
          Stop {fmt(elapsed)}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={startRecording}
          disabled={disabled}
          className="flex items-center gap-1"
        >
          <Mic className="h-4 w-4" />
          Record memo
        </Button>
      )}
      {recording && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
          Recording…
        </span>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};

export default VoiceRecorder;
