import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Smartphone } from 'lucide-react';

const PWAValidator = () => {
  const [checks, setChecks] = useState({});
  const [manifest, setManifest] = useState(null);

  useEffect(() => {
    const runChecks = async () => {
      const results = {};

      // Check HTTPS
      results.https = location.protocol === 'https:' || location.hostname === 'localhost';

      // Check Service Worker
      results.serviceWorker = 'serviceWorker' in navigator;

      // Check if Service Worker is registered
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          results.swRegistered = !!registration;
        } catch (e) {
          results.swRegistered = false;
        }
      }

      // Check Manifest
      try {
        const manifestResponse = await fetch('/manifest.webmanifest');
        if (manifestResponse.ok) {
          const manifestData = await manifestResponse.json();
          results.manifest = true;
          results.manifestName = !!manifestData.name;
          results.manifestIcons = manifestData.icons && manifestData.icons.length > 0;
          results.manifestStartUrl = !!manifestData.start_url;
          results.manifestDisplay = manifestData.display === 'standalone';
          setManifest(manifestData);
        } else {
          results.manifest = false;
        }
      } catch (e) {
        results.manifest = false;
      }

      // Check if running as PWA
      results.isPWA = window.matchMedia('(display-mode: standalone)').matches;

      // Check install prompt capability
      results.installPrompt = false;
      const handler = (e) => {
        results.installPrompt = true;
        setChecks({...results});
      };
      window.addEventListener('beforeinstallprompt', handler);

      setChecks(results);

      // Clean up
      return () => window.removeEventListener('beforeinstallprompt', handler);
    };

    runChecks();
  }, []);

  const getStatusIcon = (status) => {
    if (status === true) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === false) return <XCircle className="h-4 w-4 text-red-600" />;
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  };

  const getStatusText = (status) => {
    if (status === true) return 'Pass';
    if (status === false) return 'Fail';
    return 'Unknown';
  };

  const testIconUrl = async (url) => {
    try {
      const response = await fetch(url);
      return response.ok;
    } catch (e) {
      return false;
    }
  };

  const [iconTests, setIconTests] = useState({});

  useEffect(() => {
    if (manifest && manifest.icons) {
      const testIcons = async () => {
        const tests = {};
        for (const icon of manifest.icons) {
          tests[icon.src] = await testIconUrl(icon.src);
        }
        setIconTests(tests);
      };
      testIcons();
    }
  }, [manifest]);

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          PWA Installation Validator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {/* Core Requirements */}
          <div className="space-y-2">
            <h4 className="font-semibold">Core Requirements</h4>
            
            <div className="flex items-center justify-between p-2 border rounded">
              <span>HTTPS or localhost</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(checks.https)}
                <Badge variant={checks.https ? "default" : "destructive"}>
                  {getStatusText(checks.https)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 border rounded">
              <span>Service Worker Support</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(checks.serviceWorker)}
                <Badge variant={checks.serviceWorker ? "default" : "destructive"}>
                  {getStatusText(checks.serviceWorker)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 border rounded">
              <span>Service Worker Registered</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(checks.swRegistered)}
                <Badge variant={checks.swRegistered ? "default" : "destructive"}>
                  {getStatusText(checks.swRegistered)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 border rounded">
              <span>Web App Manifest</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(checks.manifest)}
                <Badge variant={checks.manifest ? "default" : "destructive"}>
                  {getStatusText(checks.manifest)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Manifest Details */}
          {manifest && (
            <div className="space-y-2">
              <h4 className="font-semibold">Manifest Details</h4>
              
              <div className="flex items-center justify-between p-2 border rounded">
                <span>App Name</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(checks.manifestName)}
                  <Badge variant={checks.manifestName ? "default" : "destructive"}>
                    {checks.manifestName ? manifest.name : 'Missing'}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 border rounded">
                <span>Display Mode</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(checks.manifestDisplay)}
                  <Badge variant={checks.manifestDisplay ? "default" : "destructive"}>
                    {manifest.display || 'Missing'}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 border rounded">
                <span>Start URL</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(checks.manifestStartUrl)}
                  <Badge variant={checks.manifestStartUrl ? "default" : "destructive"}>
                    {manifest.start_url || 'Missing'}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 border rounded">
                <span>Icons ({manifest.icons?.length || 0})</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(checks.manifestIcons)}
                  <Badge variant={checks.manifestIcons ? "default" : "destructive"}>
                    {checks.manifestIcons ? 'Present' : 'Missing'}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Icon Tests */}
          {manifest && manifest.icons && (
            <div className="space-y-2">
              <h4 className="font-semibold">Icon Accessibility</h4>
              {manifest.icons.map((icon, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                  <span>{icon.sizes} ({icon.purpose || 'any'})</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(iconTests[icon.src])}
                    <Badge variant={iconTests[icon.src] ? "default" : "destructive"}>
                      {iconTests[icon.src] !== undefined ? 
                        (iconTests[icon.src] ? 'Accessible' : 'Not Found') : 
                        'Testing...'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Install Status */}
          <div className="space-y-2">
            <h4 className="font-semibold">Installation Status</h4>
            
            <div className="flex items-center justify-between p-2 border rounded">
              <span>Running as PWA</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(checks.isPWA)}
                <Badge variant={checks.isPWA ? "default" : "secondary"}>
                  {checks.isPWA ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 border rounded">
              <span>Install Prompt Available</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(checks.installPrompt)}
                <Badge variant={checks.installPrompt ? "default" : "secondary"}>
                  {checks.installPrompt ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Debug Info */}
          <div className="space-y-2">
            <h4 className="font-semibold">Debug Info</h4>
            <div className="p-3 bg-muted rounded text-xs font-mono">
              <div>Protocol: {location.protocol}</div>
              <div>Hostname: {location.hostname}</div>
              <div>User Agent: {navigator.userAgent.substring(0, 100)}...</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PWAValidator;