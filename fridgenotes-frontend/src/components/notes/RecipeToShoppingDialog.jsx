/**
 * RecipeToShoppingDialog Component
 * 
 * Allows users to paste recipe text and convert it into a shopping list
 * with automatic ingredient parsing and categorization.
 * 
 * Features:
 * - Large text area for recipe input
 * - Real-time ingredient parsing preview
 * - Category assignment and editing
 * - Ingredient list editing before creating note
 * - Smart parsing of various recipe formats
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Trash2, Edit, Check, X, ChefHat } from 'lucide-react';
import { useRecipe } from '../hooks/useRecipe';

const RecipeToShoppingDialog = ({ 
  isOpen, 
  onClose, 
  onCreateShoppingList 
}) => {
  const [recipeText, setRecipeText] = useState('');
  const [listTitle, setListTitle] = useState('Recipe Shopping List');
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editingText, setEditingText] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  
  const {
    parseRecipeText,
    createShoppingListFromRecipe,
    parsedIngredients,
    isParsingRecipe,
    clearParsedIngredients,
    availableCategories
  } = useRecipe();

  // Parse recipe when text changes (debounced)
  useEffect(() => {
    if (!recipeText.trim()) {
      clearParsedIngredients();
      return;
    }

    const timeoutId = setTimeout(() => {
      parseRecipeText(recipeText);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [recipeText, parseRecipeText, clearParsedIngredients]);

  const handleCreateList = () => {
    if (parsedIngredients.length === 0) return;

    const shoppingListData = createShoppingListFromRecipe(parsedIngredients, listTitle);
    onCreateShoppingList(shoppingListData);
    handleClose();
  };

  const handleClose = () => {
    setRecipeText('');
    setListTitle('Recipe Shopping List');
    setEditingIndex(-1);
    clearParsedIngredients();
    onClose();
  };

  const handleDeleteIngredient = (index) => {
    const updated = parsedIngredients.filter((_, i) => i !== index);
    // We need to manually update since this bypasses the parsing
    clearParsedIngredients();
    setTimeout(() => {
      // Trigger re-parse with updated list
      const updatedText = updated.map(ing => ing.text).join('\n');
      parseRecipeText(updatedText);
    }, 0);
  };

  const handleEditIngredient = (index) => {
    const ingredient = parsedIngredients[index];
    setEditingIndex(index);
    setEditingText(ingredient.text);
    setEditingCategory(ingredient.category);
  };

  const handleSaveEdit = () => {
    if (editingIndex < 0) return;

    // Update the ingredient in the list
    const updated = [...parsedIngredients];
    updated[editingIndex] = {
      ...updated[editingIndex],
      text: editingText,
      category: editingCategory
    };
    
    // Clear and re-set the parsed ingredients
    clearParsedIngredients();
    setTimeout(() => {
      parseRecipeText(updated.map(ing => ing.text).join('\n'));
    }, 0);

    setEditingIndex(-1);
    setEditingText('');
    setEditingCategory('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(-1);
    setEditingText('');
    setEditingCategory('');
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Produce': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'Dairy': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'Meat & Seafood': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      'Pantry': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      'Frozen': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
      'Canned Goods': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'Bakery': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
      'Beverages': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'Spices': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      'Other': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    };
    return colors[category] || colors['Other'];
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Convert Recipe to Shopping List
          </DialogTitle>
          <DialogDescription>
            Paste your recipe text below and we'll automatically extract the ingredients 
            and organize them into a shopping list with store categories.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Left Panel - Recipe Input */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Shopping List Title
              </label>
              <Input
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="Recipe Shopping List"
              />
            </div>

            <div className="flex-1 min-h-0">
              <label className="text-sm font-medium mb-2 block">
                Recipe Text
              </label>
              <Textarea
                value={recipeText}
                onChange={(e) => setRecipeText(e.target.value)}
                placeholder="Paste your recipe here...

Example:
- 2 cups flour
- 1 lb chicken breast  
- 3 large eggs
- 1/2 cup milk
- 2 tbsp olive oil
- 1 onion, diced
- Salt and pepper to taste"
                className="min-h-[300px] lg:min-h-[400px] font-mono text-sm resize-none"
              />
            </div>

            {isParsingRecipe && (
              <div className="text-sm text-muted-foreground">
                Parsing ingredients...
              </div>
            )}
          </div>

          {/* Right Panel - Parsed Ingredients */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Parsed Ingredients ({parsedIngredients.length})
              </label>
              {parsedIngredients.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Click items to edit
                </div>
              )}
            </div>

            <ScrollArea className="h-[400px] lg:h-[450px] rounded-md border">
              <div className="p-4 space-y-2">
                {parsedIngredients.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ChefHat className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Paste a recipe to see parsed ingredients</p>
                  </div>
                ) : (
                  parsedIngredients.map((ingredient, index) => (
                    <Card key={index} className="p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        {editingIndex === index ? (
                          // Edit mode
                          <div className="flex-1 space-y-2">
                            <Input
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="text-sm"
                            />
                            <Select value={editingCategory} onValueChange={setEditingCategory}>
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCategories.map(category => (
                                  <SelectItem key={category} value={category}>
                                    {category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={handleSaveEdit}
                                className="h-7"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={handleCancelEdit}
                                className="h-7"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // Display mode
                          <>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium mb-1">
                                {ingredient.text}
                              </div>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getCategoryColor(ingredient.category)}`}
                              >
                                {ingredient.category}
                              </Badge>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditIngredient(index)}
                                className="h-7 w-7 p-0"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteIngredient(index)}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {parsedIngredients.length > 0 && (
              `${parsedIngredients.length} ingredients ready for shopping list`
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateList}
              disabled={parsedIngredients.length === 0}
            >
              Create Shopping List
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecipeToShoppingDialog;