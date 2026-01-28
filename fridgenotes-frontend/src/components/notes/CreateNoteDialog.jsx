import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  List,
  FileText,
  LayoutTemplate
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CreateNoteDialog = ({ 
  isOpen, 
  onOpenChange, 
  noteType, 
  onNoteTypeChange, 
  onCreate,
  onOpenTemplates 
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="shadow-lg">
          <Plus className="h-5 w-5 mr-2" />
          Create Note
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Note</DialogTitle>
          <DialogDescription>
            Choose the type of note you want to create.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={noteType} onValueChange={onNoteTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Text Note
                </div>
              </SelectItem>
              <SelectItem value="checklist">
                <div className="flex items-center">
                  <List className="h-4 w-4 mr-2" />
                  Checklist
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => {
                onOpenChange(false);
                if (onOpenTemplates) onOpenTemplates();
              }}
              className="flex items-center"
            >
              <LayoutTemplate className="h-4 w-4 mr-2" />
              Use Template
            </Button>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onCreate}>Create</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateNoteDialog;
