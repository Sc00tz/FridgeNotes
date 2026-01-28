/**
 * ImportExportDialog Component
 * 
 * Dialog for importing and exporting FridgeNotes data.
 * Features:
 * - Export to JSON and CSV formats
 * - Import from JSON with validation
 * - Progress tracking for large operations
 * - Data statistics and preview
 * - Error handling and user feedback
 * 
 * Props:
 *   isOpen: Whether dialog is visible
 *   onClose: Function to close dialog
 *   onExportJSON: Function to export data as JSON
 *   onExportCSV: Function to export data as CSV
 *   onImportJSON: Function to import data from JSON file
 *   stats: Object containing data statistics
 *   isProcessing: Whether import/export is in progress
 *   progress: Progress percentage (0-100)
 *   error: Error message if any
 *   success: Success message if any
 *   onClearMessages: Function to clear error/success messages
 */

import React, { useState, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Download, 
  Upload, 
  FileText, 
  Database, 
  BarChart3,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
  Archive,
  Pin,
  Bell,
  Tag
} from 'lucide-react';

const ImportExportDialog = ({ 
  isOpen, 
  onClose, 
  onExportJSON,
  onExportCSV,
  onImportJSON,
  stats = {},
  isProcessing = false,
  progress = 0,
  error = null,
  success = null,
  onClearMessages
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileSelect = (files) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        onImportJSON(file);
      } else {
        alert('Please select a JSON file (.json)');
      }
    }
  };

  // Handle drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Handle file input click
  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Import & Export Data</span>
          </DialogTitle>
          <DialogDescription>
            Backup your notes and labels or import data from another FridgeNotes export.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        {isProcessing && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Processing...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span className="text-red-700 text-sm">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearMessages}
              className="ml-auto h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
            <span className="text-green-700 text-sm">{success}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearMessages}
              className="ml-auto h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        )}

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="export">Export Data</TabsTrigger>
            <TabsTrigger value="import">Import Data</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* JSON Export */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <CardTitle>JSON Format</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Complete backup with all data and metadata. Best for importing back to FridgeNotes.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Notes:</span>
                      <span>{stats.totalNotes || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Labels:</span>
                      <span>{stats.totalLabels || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Includes:</span>
                      <span>All metadata</span>
                    </div>
                  </div>
                  <Button 
                    onClick={onExportJSON}
                    disabled={isProcessing || (stats.totalNotes || 0) === 0}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export as JSON
                  </Button>
                </CardContent>
              </Card>

              {/* CSV Export */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-green-500" />
                    <CardTitle>CSV Format</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Spreadsheet-friendly format. Good for data analysis and viewing in Excel.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Notes:</span>
                      <span>{stats.totalNotes || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Format:</span>
                      <span>Tabular</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Use for:</span>
                      <span>Analysis</span>
                    </div>
                  </div>
                  <Button 
                    onClick={onExportCSV}
                    disabled={isProcessing || (stats.totalNotes || 0) === 0}
                    className="w-full"
                    variant="outline"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export as CSV
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Export Info */}
            <Card className="mt-6">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm space-y-2">
                    <p><strong>JSON exports</strong> include all your notes, labels, checklist items, reminders, and metadata. This is the recommended format for backing up your data.</p>
                    <p><strong>CSV exports</strong> flatten your data into a spreadsheet format, which is useful for analysis but loses some structure and cannot be imported back.</p>
                    <p>Both formats are generated locally in your browser - your data never leaves your device.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="mt-6">
            <div className="space-y-6">
              {/* Import Area */}
              <Card>
                <CardHeader>
                  <CardTitle>Import from JSON</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Import notes and labels from a FridgeNotes JSON export file.
                  </p>
                </CardHeader>
                <CardContent>
                  <div
                    className={`
                      border-2 border-dashed rounded-lg p-8 text-center transition-colors
                      ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                      ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary hover:bg-primary/5'}
                    `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={handleFileInputClick}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">
                      {dragActive ? 'Drop your file here' : 'Choose a file or drag it here'}
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Supports JSON files up to {formatFileSize(10 * 1024 * 1024)}
                    </p>
                    <Button variant="outline" disabled={isProcessing}>
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Select File
                    </Button>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                  />
                </CardContent>
              </Card>

              {/* Import Info */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div className="text-sm space-y-2">
                      <p><strong>Import behavior:</strong></p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Existing labels with the same name will be reused</li>
                        <li>New labels will be created as needed</li>
                        <li>All notes will be imported as new notes</li>
                        <li>Duplicate detection is based on content similarity</li>
                        <li>Import progress will be shown above</li>
                      </ul>
                      <p className="pt-2">Only JSON files exported from FridgeNotes are supported for import.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Overview Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Overview</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">{stats.totalNotes || 0}</div>
                      <div className="text-sm text-muted-foreground">Total Notes</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">{stats.totalLabels || 0}</div>
                      <div className="text-sm text-muted-foreground">Total Labels</div>
                    </div>
                  </div>

                  {stats.notesByType && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Notes by Type</h4>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span>Text Notes</span>
                        </span>
                        <Badge variant="outline">{stats.notesByType.text || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <Database className="h-4 w-4" />
                          <span>Checklists</span>
                        </span>
                        <Badge variant="outline">{stats.notesByType.checklist || 0}</Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detail Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <Archive className="h-4 w-4 text-muted-foreground" />
                      <span>Archived Notes</span>
                    </span>
                    <Badge variant="secondary">{stats.archivedNotes || 0}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <Pin className="h-4 w-4 text-muted-foreground" />
                      <span>Pinned Notes</span>
                    </span>
                    <Badge variant="secondary">{stats.pinnedNotes || 0}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <span>With Reminders</span>
                    </span>
                    <Badge variant="secondary">{stats.notesWithReminders || 0}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span>Labels Created</span>
                    </span>
                    <Badge variant="secondary">{stats.totalLabels || 0}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Storage Estimate */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Export Size Estimate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <p>Based on your current data:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>JSON export: ~{formatFileSize((stats.totalNotes || 0) * 500 + (stats.totalLabels || 0) * 100)}</li>
                    <li>CSV export: ~{formatFileSize((stats.totalNotes || 0) * 300)}</li>
                  </ul>
                  <p className="mt-2 text-xs">
                    * Estimates are approximate and may vary based on content length.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ImportExportDialog;