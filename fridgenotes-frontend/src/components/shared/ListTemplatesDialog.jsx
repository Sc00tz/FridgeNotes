/**
 * ListTemplatesDialog Component
 * 
 * Dialog for managing list templates and creating notes from templates.
 * Features:
 * - Built-in templates (grocery, household, etc.)
 * - Custom user templates from existing notes
 * - Template creation from current note
 * - Quick note creation from templates
 * 
 * Props:
 *   isOpen: Whether dialog is visible
 *   onClose: Function to close dialog
 *   onCreateNoteFromTemplate: Function to create a new note from template
 *   onSaveAsTemplate: Function to save current note as template
 *   currentNote: Currently selected note (for save as template)
 *   templates: Array of user templates
 *   onDeleteTemplate: Function to delete custom template
 */

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Plus, 
  ShoppingCart, 
  Home, 
  Utensils, 
  Car, 
  Briefcase, 
  Heart, 
  Trash2,
  Copy 
} from 'lucide-react';

// Built-in template definitions
const BUILTIN_TEMPLATES = [
  {
    id: 'grocery-essentials',
    name: 'Grocery Essentials',
    description: 'Basic grocery shopping list',
    icon: ShoppingCart,
    color: 'green',
    items: [
      'Milk', 'Bread', 'Eggs', 'Butter', 'Bananas', 'Apples', 'Chicken breast', 
      'Rice', 'Pasta', 'Tomatoes', 'Onions', 'Garlic', 'Olive oil', 'Salt', 'Black pepper'
    ]
  },
  {
    id: 'household-supplies',
    name: 'Household Supplies',
    description: 'Common household items',
    icon: Home,
    color: 'blue',
    items: [
      'Toilet paper', 'Paper towels', 'Dish soap', 'Laundry detergent', 
      'All-purpose cleaner', 'Trash bags', 'Light bulbs', 'Batteries'
    ]
  },
  {
    id: 'weekly-meal-prep',
    name: 'Weekly Meal Prep',
    description: 'Ingredients for meal preparation',
    icon: Utensils,
    color: 'orange',
    items: [
      'Chicken thighs', 'Ground turkey', 'Sweet potatoes', 'Broccoli', 'Bell peppers',
      'Brown rice', 'Quinoa', 'Greek yogurt', 'Spinach', 'Avocados', 'Olive oil spray'
    ]
  },
  {
    id: 'car-maintenance',
    name: 'Car Maintenance',
    description: 'Vehicle maintenance checklist',
    icon: Car,
    color: 'gray',
    items: [
      'Check oil level', 'Check tire pressure', 'Wash car', 'Check brake fluid',
      'Replace air freshener', 'Clean interior', 'Check lights', 'Gas up'
    ]
  },
  {
    id: 'work-supplies',
    name: 'Office/Work Supplies',
    description: 'Common office supplies',
    icon: Briefcase,
    color: 'purple',
    items: [
      'Pens', 'Notebooks', 'Sticky notes', 'Paper clips', 'Staples',
      'Printer paper', 'File folders', 'Highlighters', 'Binders'
    ]
  },
  {
    id: 'date-night',
    name: 'Date Night Prep',
    description: 'Planning a special evening',
    icon: Heart,
    color: 'pink',
    items: [
      'Make dinner reservation', 'Choose outfit', 'Plan activity', 'Get flowers',
      'Charge phone', 'Check weather', 'Prepare playlist'
    ]
  }
];

const ListTemplatesDialog = ({ 
  isOpen, 
  onClose, 
  onCreateNoteFromTemplate, 
  onSaveAsTemplate,
  currentNote,
  templates = [],
  onDeleteTemplate 
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);

  // Handle creating note from template
  const handleCreateFromTemplate = async (template) => {
    const noteData = {
      title: template.name,
      note_type: 'checklist',
      color: template.color || 'default',
      checklist_items: template.items.map((item, index) => ({
        text: item,
        completed: false,
        order: index
      }))
    };

    try {
      await onCreateNoteFromTemplate(noteData);
      onClose();
    } catch (error) {
      console.error('Failed to create note from template:', error);
    }
  };

  // Handle saving current note as template
  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || !currentNote) return;

    setSaving(true);
    try {
      const templateData = {
        name: templateName.trim(),
        description: `Template created from "${currentNote.title || 'Untitled'}"`,
        items: currentNote.checklist_items?.map(item => item.text) || [],
        color: currentNote.color || 'default',
        created_from_note_id: currentNote.id
      };

      await onSaveAsTemplate(templateData);
      setTemplateName('');
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setSaving(false);
    }
  };

  const getColorClass = (color) => {
    const colorMap = {
      green: 'bg-green-100 border-green-300',
      blue: 'bg-blue-100 border-blue-300',
      orange: 'bg-orange-100 border-orange-300',
      gray: 'bg-gray-100 border-gray-300',
      purple: 'bg-purple-100 border-purple-300',
      pink: 'bg-pink-100 border-pink-300',
      default: 'bg-white border-gray-200'
    };
    return colorMap[color] || colorMap.default;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List Templates</DialogTitle>
          <DialogDescription>
            Choose from built-in templates or create custom templates from your notes.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="builtin" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="builtin">Built-in Templates</TabsTrigger>
            <TabsTrigger value="custom">
              My Templates ({templates.length})
            </TabsTrigger>
            <TabsTrigger value="save" disabled={!currentNote || currentNote.note_type !== 'checklist'}>
              Save Current
            </TabsTrigger>
          </TabsList>

          {/* Built-in Templates */}
          <TabsContent value="builtin" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BUILTIN_TEMPLATES.map((template) => {
                const Icon = template.icon;
                return (
                  <Card 
                    key={template.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${getColorClass(template.color)}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Icon className="h-5 w-5" />
                          <div>
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {template.items.length} items
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-sm text-muted-foreground mb-3">
                        {template.items.slice(0, 3).join(', ')}
                        {template.items.length > 3 && ` +${template.items.length - 3} more`}
                      </div>
                      <Button 
                        onClick={() => handleCreateFromTemplate(template)}
                        className="w-full"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create List
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Custom Templates */}
          <TabsContent value="custom" className="mt-4">
            {templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No custom templates yet</p>
                <p className="text-sm">
                  Create templates by saving your existing checklists in the "Save Current" tab.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <Card 
                    key={template.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${getColorClass(template.color)}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {template.items?.length || 0} items
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTemplate(template.id);
                            }}
                            className="h-8 w-8 p-0 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-sm text-muted-foreground mb-3">
                        {template.items?.slice(0, 3).join(', ')}
                        {template.items?.length > 3 && ` +${template.items.length - 3} more`}
                      </div>
                      <Button 
                        onClick={() => handleCreateFromTemplate(template)}
                        className="w-full"
                        size="sm"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Create List
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Save Current Note as Template */}
          <TabsContent value="save" className="mt-4">
            {!currentNote ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No note selected</p>
              </div>
            ) : currentNote.note_type !== 'checklist' ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Only checklist notes can be saved as templates</p>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Save "{currentNote.title || 'Untitled'}" as Template</CardTitle>
                    <CardDescription>
                      This will create a reusable template with {currentNote.checklist_items?.length || 0} items.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Template Name</label>
                      <Input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Enter template name..."
                        className="w-full"
                      />
                    </div>
                    
                    {currentNote.checklist_items && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Items Preview</label>
                        <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                          {currentNote.checklist_items.slice(0, 5).map(item => item.text).join(', ')}
                          {currentNote.checklist_items.length > 5 && ` +${currentNote.checklist_items.length - 5} more`}
                        </div>
                      </div>
                    )}

                    <Button 
                      onClick={handleSaveAsTemplate}
                      disabled={!templateName.trim() || saving}
                      className="w-full"
                    >
                      {saving ? 'Saving...' : 'Save as Template'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ListTemplatesDialog;