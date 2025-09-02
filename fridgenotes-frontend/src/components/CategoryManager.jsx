/**
 * CategoryManager Component
 * 
 * Provides a categorized view of checklist items organized by store sections.
 * Features drag-and-drop reordering within categories and category assignment.
 * 
 * Props:
 *   items: Array of checklist items
 *   onUpdateItem: Function to update an item (text, category, etc.)
 *   onDeleteItem: Function to delete an item
 *   onAddItem: Function to add a new item
 *   onToggleItem: Function to toggle item completion
 *   onReorderItems: Function to handle item reordering
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Plus, Trash2, Edit, Check, X, GripVertical, ShoppingCart } from 'lucide-react';
import ChecklistItemAutocomplete from './ChecklistItemAutocomplete';

// Store sections with logical shopping order
const STORE_CATEGORIES = [
  { id: 'Produce', name: 'Produce', icon: '🥬', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  { id: 'Dairy', name: 'Dairy & Eggs', icon: '🥛', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  { id: 'Meat & Seafood', name: 'Meat & Seafood', icon: '🥩', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  { id: 'Pantry', name: 'Pantry', icon: '🏪', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  { id: 'Frozen', name: 'Frozen', icon: '🧊', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300' },
  { id: 'Canned Goods', name: 'Canned Goods', icon: '🥫', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  { id: 'Bakery', name: 'Bakery', icon: '🍞', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' },
  { id: 'Beverages', name: 'Beverages', icon: '🥤', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  { id: 'Spices', name: 'Spices & Seasonings', icon: '🧂', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300' },
  { id: 'Other', name: 'Other', icon: '📦', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' }
];

const CategoryManager = ({
  items = [],
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onToggleItem,
  onReorderItems,
  userItems = []
}) => {
  const [editingItem, setEditingItem] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [newItemTexts, setNewItemTexts] = useState({});
  const [showCompleted, setShowCompleted] = useState(true);

  // Group items by category
  const categorizedItems = useMemo(() => {
    const grouped = {};
    
    // Initialize all categories
    STORE_CATEGORIES.forEach(cat => {
      grouped[cat.id] = [];
    });

    // Group items by category
    items.forEach(item => {
      const category = item.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });

    // Sort items within each category by order, then by completion status
    Object.keys(grouped).forEach(categoryId => {
      grouped[categoryId].sort((a, b) => {
        // Completed items go to bottom if not showing completed
        if (!showCompleted) {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
        }
        return a.order - b.order;
      });
    });

    return grouped;
  }, [items, showCompleted]);

  // Calculate completion stats
  const completionStats = useMemo(() => {
    const stats = {};
    Object.entries(categorizedItems).forEach(([categoryId, categoryItems]) => {
      const total = categoryItems.length;
      const completed = categoryItems.filter(item => item.completed).length;
      stats[categoryId] = { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
    });
    return stats;
  }, [categorizedItems]);

  const handleEditItem = (item) => {
    setEditingItem(item.id);
    setEditingText(item.text);
    setEditingCategory(item.category || 'Other');
  };

  const handleSaveEdit = () => {
    if (editingItem && editingText.trim()) {
      onUpdateItem(editingItem, { 
        text: editingText.trim(),
        category: editingCategory
      });
      setEditingItem(null);
      setEditingText('');
      setEditingCategory('');
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditingText('');
    setEditingCategory('');
  };

  const handleAddItem = (categoryId) => {
    const text = newItemTexts[categoryId];
    if (text && text.trim()) {
      onAddItem(text.trim(), categoryId);
      setNewItemTexts({ ...newItemTexts, [categoryId]: '' });
    }
  };

  const handleNewItemTextChange = (categoryId, text) => {
    setNewItemTexts({ ...newItemTexts, [categoryId]: text });
  };

  const getCategoryConfig = (categoryId) => {
    return STORE_CATEGORIES.find(cat => cat.id === categoryId) || STORE_CATEGORIES.find(cat => cat.id === 'Other');
  };

  // Filter out empty categories (unless they have items or are being edited)
  const activeCategories = STORE_CATEGORIES.filter(category => {
    const hasItems = categorizedItems[category.id].length > 0;
    const isAddingItem = newItemTexts[category.id];
    return hasItems || isAddingItem;
  });

  const totalItems = items.length;
  const completedItems = items.filter(item => item.completed).length;
  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5" />
              Shopping List Progress
            </CardTitle>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-sm">
                {completedItems} / {totalItems} completed
              </Badge>
              <div className="text-2xl font-bold text-primary">
                {overallProgress}%
              </div>
            </div>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 mt-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Category Sections */}
      <div className="space-y-4">
        {activeCategories.map((category) => {
          const categoryItems = categorizedItems[category.id];
          const stats = completionStats[category.id];
          const visibleItems = showCompleted ? categoryItems : categoryItems.filter(item => !item.completed);

          return (
            <Card key={category.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <CardTitle className="text-base">{category.name}</CardTitle>
                      {stats.total > 0 && (
                        <div className="text-sm text-muted-foreground">
                          {stats.completed} of {stats.total} items ({stats.percentage}%)
                        </div>
                      )}
                    </div>
                  </div>
                  {stats.total > 0 && (
                    <Badge className={category.color}>
                      {stats.percentage}%
                    </Badge>
                  )}
                </div>
                {stats.total > 0 && (
                  <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
                    <div 
                      className="bg-current h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${stats.percentage}%` }}
                    />
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="pt-0">
                {/* Items List */}
                <div className="space-y-2 mb-4">
                  {visibleItems.map((item) => (
                    <div 
                      key={item.id}
                      className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                        item.completed ? 'opacity-60 bg-muted/50' : 'bg-background hover:bg-muted/50'
                      }`}
                    >
                      {/* Drag Handle */}
                      <div className="cursor-grab text-muted-foreground hover:text-foreground">
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => onToggleItem(item.id)}
                        className="rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
                      />

                      {/* Item Content */}
                      <div className="flex-1 min-w-0">
                        {editingItem === item.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="text-sm"
                              autoFocus
                            />
                            <Select value={editingCategory} onValueChange={setEditingCategory}>
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STORE_CATEGORIES.map(cat => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.icon} {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveEdit} className="h-7">
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-7">
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}
                          >
                            {item.text}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {editingItem !== item.id && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditItem(item)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDeleteItem(item.id)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {visibleItems.length === 0 && !newItemTexts[category.id] && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No items in this category
                    </div>
                  )}
                </div>

                {/* Add New Item */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <ChecklistItemAutocomplete
                      value={newItemTexts[category.id] || ''}
                      onChange={(value) => handleNewItemTextChange(category.id, value)}
                      onSelect={(value) => handleNewItemTextChange(category.id, value)}
                      placeholder={`Add ${category.name.toLowerCase()} item...`}
                      userItems={userItems}
                      className="flex-1"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAddItem(category.id)}
                    disabled={!newItemTexts[category.id]?.trim()}
                    className="px-3"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Add Category Button */}
        {activeCategories.length < STORE_CATEGORIES.length && (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => {
                    // Show all categories that don't have items yet
                    const emptyCategory = STORE_CATEGORIES.find(cat => 
                      !activeCategories.find(active => active.id === cat.id)
                    );
                    if (emptyCategory) {
                      setNewItemTexts({ ...newItemTexts, [emptyCategory.id]: ' ' });
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category Section
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Show/Hide Completed Toggle */}
      {completedItems > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? 'Hide' : 'Show'} Completed Items ({completedItems})
          </Button>
        </div>
      )}
    </div>
  );
};

export default CategoryManager;