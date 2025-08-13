import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit2, Trash2, Settings, Save, X } from 'lucide-react';
import LabelBadge from './LabelBadge';

// Label color options
const LABEL_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Green', value: '#10b981' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Gray', value: '#6b7280' }
];

const LabelManagement = ({ 
  isOpen, 
  onClose, 
  labels = [], 
  onCreateLabel, 
  onUpdateLabel, 
  onDeleteLabel, 
  loading = false 
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3b82f6',
    parent_id: null
  });
  const [errors, setErrors] = useState({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsCreating(false);
      setEditingLabel(null);
      setFormData({ name: '', color: '#3b82f6', parent_id: null });
      setErrors({});
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!formData.name.trim()) {
      setErrors({ name: 'Label name is required' });
      return;
    }

    try {
      if (editingLabel) {
        await onUpdateLabel(editingLabel.id, formData);
        setEditingLabel(null);
      } else {
        await onCreateLabel(formData);
        setIsCreating(false);
      }
      setFormData({ name: '', color: '#3b82f6', parent_id: null });
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to save label' });
    }
  };

  const handleEdit = (label) => {
    setEditingLabel(label);
    setFormData({
      name: label.name,
      color: label.color,
      parent_id: label.parent_id
    });
    setIsCreating(false);
  };

  const handleDelete = async (labelId) => {
    if (confirm('Are you sure you want to delete this label? It will be removed from all notes.')) {
      try {
        await onDeleteLabel(labelId);
        // Clear any existing errors
        setErrors({});
      } catch (error) {
        setErrors({ submit: error.message || 'Failed to delete label' });
      }
    }
  };

  const cancelEdit = () => {
    setEditingLabel(null);
    setIsCreating(false);
    setFormData({ name: '', color: '#3b82f6', parent_id: null });
    setErrors({});
  };

  // Get parent labels (no parent_id)
  const parentLabels = labels.filter(label => !label.parent_id);
  
  // Group labels by parent
  const labelsByParent = labels.reduce((acc, label) => {
    const parentId = label.parent_id || 'root';
    if (!acc[parentId]) acc[parentId] = [];
    acc[parentId].push(label);
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Manage Labels
          </DialogTitle>
          <DialogDescription>
            Create, edit, and organize your labels. You can create hierarchical labels by selecting a parent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create/Edit Form */}
          {(isCreating || editingLabel) && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                {editingLabel ? (
                  <><Edit2 className="h-4 w-4" /> Edit Label</>
                ) : (
                  <><Plus className="h-4 w-4" /> Create New Label</>
                )}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="text-sm font-medium">Label Name</label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter label name..."
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="color" className="text-sm font-medium">Color</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {LABEL_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: color.value })}
                          className={`
                            w-8 h-8 rounded-full border-2 transition-all hover:scale-110
                            ${formData.color === color.value 
                              ? 'border-gray-800 scale-110' 
                              : 'border-gray-300'
                            }
                          `}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="parent" className="text-sm font-medium">Parent Label (optional)</label>
                    <Select 
                      value={formData.parent_id || ''} 
                      onValueChange={(value) => setFormData({ 
                        ...formData, 
                        parent_id: value || null 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None (top level)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None (top level)</SelectItem>
                        {parentLabels.map((label) => (
                          <SelectItem key={label.id} value={label.id.toString()}>
                            {label.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preview */}
                {formData.name && (
                  <div>
                    <label className="text-sm font-medium">Preview</label>
                    <div className="mt-2">
                      <LabelBadge
                        label={{
                          id: 'preview',
                          name: formData.name,
                          display_name: formData.parent_id ? 
                            `${parentLabels.find(p => p.id === parseInt(formData.parent_id))?.name || 'Parent'}: ${formData.name}` : 
                            formData.name,
                          color: formData.color
                        }}
                        size="md"
                      />
                    </div>
                  </div>
                )}

                {errors.submit && (
                  <p className="text-sm text-red-500">{errors.submit}</p>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    <Save className="h-4 w-4 mr-2" />
                    {editingLabel ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Action Buttons */}
          {!isCreating && !editingLabel && (
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Your Labels ({labels.length})</h3>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Label
              </Button>
            </div>
          )}

          {/* Labels List */}
          <div className="space-y-4">
            {labels.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No labels created yet</p>
                <p className="text-sm">Create your first label to get started organizing your notes</p>
              </div>
            ) : (
              <>
                {/* Root level labels */}
                {(labelsByParent.root || []).map((label) => (
                  <div key={label.id} className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <LabelBadge label={label} size="md" />
                        <span className="text-sm text-gray-500">({label.children?.length || 0} children)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(label)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(label.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Child labels */}
                    {(labelsByParent[label.id] || []).map((childLabel) => (
                      <div key={childLabel.id} className="ml-6 flex items-center justify-between p-2 bg-gray-50 border rounded hover:bg-gray-100">
                        <LabelBadge label={childLabel} size="sm" />
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(childLabel)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(childLabel.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LabelManagement;
