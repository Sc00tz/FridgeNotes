import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '../../lib/api';

/**
 * PIN dialog for private notes. Modes:
 *  - 'setup':  create the first PIN (requires account password)
 *  - 'unlock': enter the PIN to reveal a private note (calls onUnlocked(note))
 *  - 'change': change the PIN (requires current PIN)
 *
 * Props: mode, open, onClose, noteId (for unlock), onUnlocked, onPinSet
 */
const PinDialog = ({ mode = 'unlock', open, onClose, noteId, onUnlocked, onPinSet }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [password, setPassword] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Reset fields whenever the dialog opens or the mode changes.
  useEffect(() => {
    if (open) {
      setPin(''); setConfirmPin(''); setPassword(''); setCurrentPin('');
      setError(null); setBusy(false);
    }
  }, [open, mode]);

  const validPin = (p) => /^\d{4,12}$/.test(p);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError(null);

    if (mode === 'unlock') {
      if (!pin) return setError('Enter your PIN');
      setBusy(true);
      try {
        const note = await apiClient.unlockNote(noteId, pin);
        onUnlocked?.(note);
        onClose?.();
      } catch (err) {
        setError(err.message === 'Incorrect PIN' ? 'Incorrect PIN' : (err.message || 'Failed to unlock'));
      } finally {
        setBusy(false);
      }
      return;
    }

    // setup / change
    if (!validPin(pin)) return setError('PIN must be 4-12 digits');
    if (pin !== confirmPin) return setError('PINs do not match');
    if (mode === 'setup' && !password) return setError('Enter your account password');
    if (mode === 'change' && !currentPin) return setError('Enter your current PIN');

    setBusy(true);
    try {
      const body = { new_pin: pin };
      if (mode === 'setup') body.password = password;
      if (mode === 'change') body.current_pin = currentPin;
      await apiClient.setPrivatePin(body);
      onPinSet?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to set PIN');
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'unlock' ? 'Enter PIN' : mode === 'change' ? 'Change PIN' : 'Set a PIN';
  const desc = mode === 'unlock'
    ? 'Enter your PIN to view this private note.'
    : mode === 'change'
      ? 'Enter your current PIN and choose a new one.'
      : 'Choose a PIN to protect your private notes. You’ll need it to view them.';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> {title}
          </DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'change' && (
            <Input
              type="password" inputMode="numeric" autoComplete="off"
              placeholder="Current PIN"
              value={currentPin} onChange={(e) => setCurrentPin(e.target.value)}
            />
          )}

          <Input
            type="password" inputMode="numeric" autoComplete="off" autoFocus
            placeholder={mode === 'unlock' ? 'PIN' : 'New PIN (4-12 digits)'}
            value={pin} onChange={(e) => setPin(e.target.value)}
          />

          {mode !== 'unlock' && (
            <Input
              type="password" inputMode="numeric" autoComplete="off"
              placeholder="Confirm PIN"
              value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)}
            />
          )}

          {mode === 'setup' && (
            <Input
              type="password" autoComplete="current-password"
              placeholder="Account password"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Please wait…' : (mode === 'unlock' ? 'Unlock' : 'Save PIN')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PinDialog;
