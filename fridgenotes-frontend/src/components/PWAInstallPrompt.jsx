import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, X } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show our custom install prompt
      setShowInstallPrompt(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback for iOS or if prompt not available
      setShowInstallPrompt(false);
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Remember user dismissed it (you could store this in localStorage)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed or user dismissed recently
  const dismissedRecently = () => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (!dismissed) return false;
    const dismissedTime = parseInt(dismissed);
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return dismissedTime > oneDayAgo;
  };

  if (isInstalled || !showInstallPrompt || dismissedRecently()) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 border-2 border-primary/20 shadow-lg md:max-w-sm md:left-auto">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Install FridgeNotes
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-6 w-6 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Install FridgeNotes as an app for a better experience with offline access and notifications.
        </p>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            ✓ <span>Works offline</span>
          </div>
          <div className="flex items-center gap-1">
            ✓ <span>Home screen icon</span>
          </div>
          <div className="flex items-center gap-1">
            ✓ <span>App-like experience</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleInstallClick} size="sm" className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Install App
          </Button>
          <Button variant="outline" size="sm" onClick={handleDismiss}>
            Not now
          </Button>
        </div>

        {/* iOS-specific instructions */}
        {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
          <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
            <strong>iOS:</strong> Tap the share button in Safari, then "Add to Home Screen"
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PWAInstallPrompt;