import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Smartphone, 
  Download, 
  Wifi, 
  WifiOff, 
  Bell, 
  Home,
  Monitor,
  CheckCircle,
  Circle,
  Zap
} from 'lucide-react';

/**
 * Demo component showcasing PWA features and implementation
 */
const PWADemo = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPromptSupported, setInstallPromptSupported] = useState(false);

  useEffect(() => {
    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if install prompt is supported
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPromptSupported(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const pwaFeatures = [
    {
      icon: <Smartphone className="h-5 w-5" />,
      title: "App-like Experience",
      description: "Runs in fullscreen without browser UI",
      status: isInstalled ? "active" : "available"
    },
    {
      icon: <WifiOff className="h-5 w-5" />,
      title: "Offline Access",
      description: "Works without internet connection",
      status: "active"
    },
    {
      icon: <Home className="h-5 w-5" />,
      title: "Home Screen Icon",
      description: "Install directly to device home screen",
      status: installPromptSupported ? "available" : "manual"
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: "Fast Loading",
      description: "Cached resources for instant startup",
      status: "active"
    },
    {
      icon: <Bell className="h-5 w-5" />,
      title: "Push Notifications",
      description: "Get notified of shared notes (future)",
      status: "planned"
    }
  ];

  const installSteps = {
    chrome: [
      "Open FridgeNotes in Chrome",
      "Look for install icon in address bar",
      "Click 'Install' and follow prompts",
      "App appears on home screen/desktop"
    ],
    safari: [
      "Open FridgeNotes in Safari",
      "Tap Share button",
      "Scroll down and tap 'Add to Home Screen'",
      "Tap 'Add' to confirm"
    ],
    edge: [
      "Open FridgeNotes in Edge",
      "Click menu (⋯) → Apps",
      "Click 'Install this site as an app'",
      "Follow installation prompts"
    ]
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'available':
        return <Circle className="h-4 w-4 text-blue-600" />;
      case 'manual':
        return <Circle className="h-4 w-4 text-orange-600" />;
      case 'planned':
        return <Circle className="h-4 w-4 text-gray-400" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'available':
        return 'Available';
      case 'manual':
        return 'Manual Install';
      case 'planned':
        return 'Coming Soon';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'available':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'manual':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'planned':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">📱 Progressive Web App (PWA)</h1>
        <p className="text-muted-foreground">Native app experience using web technologies</p>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            PWA Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Connection Status:</span>
            <Badge variant={isOnline ? "default" : "destructive"} className="flex items-center gap-1">
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium">Installation Status:</span>
            <Badge variant={isInstalled ? "default" : "secondary"} className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {isInstalled ? 'Installed as App' : 'Running in Browser'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium">Install Prompt:</span>
            <Badge variant={installPromptSupported ? "default" : "secondary"}>
              {installPromptSupported ? 'Supported' : 'Manual Install Only'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* PWA Features */}
      <Card>
        <CardHeader>
          <CardTitle>PWA Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pwaFeatures.map((feature, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary">
                    {feature.icon}
                    <h4 className="font-medium">{feature.title}</h4>
                  </div>
                  {getStatusIcon(feature.status)}
                </div>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
                <Badge 
                  className={`text-xs ${getStatusColor(feature.status)}`}
                  variant="secondary"
                >
                  {getStatusText(feature.status)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Installation Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Installation Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/chrome/chrome-original.svg" className="w-5 h-5" alt="Chrome" />
                Chrome / Android
              </h4>
              <ol className="text-sm space-y-2">
                {installSteps.chrome.map((step, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-primary font-medium">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/safari/safari-original.svg" className="w-5 h-5" alt="Safari" />
                Safari / iOS
              </h4>
              <ol className="text-sm space-y-2">
                {installSteps.safari.map((step, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-primary font-medium">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Edge / Desktop
              </h4>
              <ol className="text-sm space-y-2">
                {installSteps.edge.map((step, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-primary font-medium">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Implementation */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Implementation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">📋 Manifest Features</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Custom app icons (64x64, 192x192, 512x512)</li>
                <li>• Standalone display mode</li>
                <li>• Portrait orientation lock</li>
                <li>• Theme color integration</li>
                <li>• Apple touch icon support</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">⚙️ Service Worker</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Automatic resource caching</li>
                <li>• Network-first API strategy</li>
                <li>• Offline fallback support</li>
                <li>• Cache-first for assets</li>
                <li>• Background sync ready</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">🎨 UI Enhancements</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Install prompt component</li>
                <li>• Status bar styling</li>
                <li>• Touch-optimized interface</li>
                <li>• No browser chrome in app mode</li>
                <li>• Logo integration in header</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">🔧 Build Integration</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Vite PWA plugin configuration</li>
                <li>• Automatic icon generation</li>
                <li>• Workbox service worker</li>
                <li>• Manifest auto-generation</li>
                <li>• Development mode support</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Why PWA?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="font-semibold mb-1">Fast</h4>
              <p className="text-xs text-muted-foreground">Cached resources load instantly</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl mb-2">📱</div>
              <h4 className="font-semibold mb-1">Native Feel</h4>
              <p className="text-xs text-muted-foreground">App-like experience</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl mb-2">🔄</div>
              <h4 className="font-semibold mb-1">Always Updated</h4>
              <p className="text-xs text-muted-foreground">Auto-updates in background</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl mb-2">💾</div>
              <h4 className="font-semibold mb-1">Offline Ready</h4>
              <p className="text-xs text-muted-foreground">Works without internet</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PWADemo;