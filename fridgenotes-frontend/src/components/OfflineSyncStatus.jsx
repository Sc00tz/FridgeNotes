/**
 * OfflineSyncStatus Component
 * 
 * Displays current sync status and provides manual sync controls.
 * Shows as a non-intrusive indicator that expands with details on hover/click.
 * 
 * Features:
 * - Online/offline indicator
 * - Pending sync queue size
 * - Manual sync trigger
 * - Error display
 * - Last sync time
 * 
 * Props:
 *   isOnline: Whether device is online
 *   isSyncing: Whether sync is currently in progress
 *   queueSize: Number of pending operations
 *   lastSync: Last successful sync timestamp
 *   syncErrors: Array of recent sync errors
 *   onForceSync: Function to trigger manual sync
 *   onClearQueue: Function to clear sync queue
 */

import React, { useState } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Trash2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

const OfflineSyncStatus = ({ 
  isOnline, 
  isSyncing, 
  queueSize = 0, 
  lastSync, 
  syncErrors = [],
  onForceSync,
  onClearQueue 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Don't show anything if everything is fine and no queue
  if (isOnline && !isSyncing && queueSize === 0 && syncErrors.length === 0) {
    return null;
  }

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (syncErrors.length > 0) return 'bg-yellow-500';
    if (isSyncing) return 'bg-blue-500';
    if (queueSize > 0) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (syncErrors.length > 0) return 'Sync errors';
    if (queueSize > 0) return 'Pending sync';
    return 'Online';
  };

  const handleForceSync = async () => {
    if (onForceSync && isOnline && !isSyncing) {
      try {
        await onForceSync();
      } catch (error) {
        console.error('Manual sync failed:', error);
      }
    }
  };

  return (
    <div className="fixed top-16 right-4 z-40">
      {/* Compact Status Indicator */}
      <Card 
        className={`
          transition-all duration-200 cursor-pointer shadow-lg border-l-4 
          ${isExpanded ? 'w-80' : 'w-auto'}
        `}
        style={{ borderLeftColor: getStatusColor().replace('bg-', '') }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                isSyncing ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <Wifi className="h-4 w-4 text-green-500" />
                )
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              
              <span className="text-sm font-medium">{getStatusText()}</span>
              
              {queueSize > 0 && (
                <Badge variant="outline" className="text-xs">
                  {queueSize} pending
                </Badge>
              )}
              
              {syncErrors.length > 0 && (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          
          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-4 space-y-3 border-t pt-3">
              {/* Status Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                    <span>{getStatusText()}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last sync:</span>
                  <span>{formatLastSync(lastSync)}</span>
                </div>
                
                {queueSize > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pending:</span>
                    <span>{queueSize} operations</span>
                  </div>
                )}
              </div>
              
              {/* Sync Errors */}
              {syncErrors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>Recent errors ({syncErrors.length})</span>
                  </div>
                  <div className="max-h-20 overflow-y-auto space-y-1">
                    {syncErrors.slice(0, 3).map((error, index) => (
                      <div key={index} className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        {error.operation}: {error.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleForceSync();
                  }}
                  disabled={!isOnline || isSyncing}
                  className="flex-1"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
                
                {queueSize > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onClearQueue) onClearQueue();
                    }}
                    className="px-2"
                    title="Clear sync queue"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              {/* Help Text */}
              <div className="text-xs text-muted-foreground">
                {!isOnline && (
                  <p>You're offline. Changes will sync when connection is restored.</p>
                )}
                {isOnline && queueSize > 0 && (
                  <p>Automatic sync will retry failed operations.</p>
                )}
                {isOnline && queueSize === 0 && syncErrors.length === 0 && (
                  <p>All changes are synced.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OfflineSyncStatus;