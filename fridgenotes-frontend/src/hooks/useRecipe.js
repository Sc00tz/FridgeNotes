/**
 * Recipe Integration Hook
 * 
 * Provides functionality to parse recipes and convert ingredients into
 * shopping list items with smart categorization.
 * 
 * Features:
 * - Parse recipe text to extract ingredients
 * - Smart quantity and unit extraction
 * - Automatic categorization by ingredient type
 * - Multiple recipe format support
 * - Ingredient deduplication and consolidation
 */

import { useState, useCallback } from 'react';

// Store category mapping for common ingredients
const INGREDIENT_CATEGORIES = {
  // Produce
  'apple': 'Produce', 'apples': 'Produce', 'banana': 'Produce', 'bananas': 'Produce',
  'orange': 'Produce', 'oranges': 'Produce', 'lemon': 'Produce', 'lemons': 'Produce',
  'lime': 'Produce', 'limes': 'Produce', 'grape': 'Produce', 'grapes': 'Produce',
  'strawberry': 'Produce', 'strawberries': 'Produce', 'blueberry': 'Produce', 'blueberries': 'Produce',
  'tomato': 'Produce', 'tomatoes': 'Produce', 'onion': 'Produce', 'onions': 'Produce',
  'garlic': 'Produce', 'potato': 'Produce', 'potatoes': 'Produce', 'carrot': 'Produce', 'carrots': 'Produce',
  'celery': 'Produce', 'bell pepper': 'Produce', 'peppers': 'Produce', 'broccoli': 'Produce',
  'spinach': 'Produce', 'lettuce': 'Produce', 'cucumber': 'Produce', 'avocado': 'Produce', 'avocados': 'Produce',
  'mushroom': 'Produce', 'mushrooms': 'Produce', 'zucchini': 'Produce', 'green beans': 'Produce',
  'basil': 'Produce', 'cilantro': 'Produce', 'parsley': 'Produce', 'mint': 'Produce',
  
  // Dairy & Eggs
  'milk': 'Dairy', 'egg': 'Dairy', 'eggs': 'Dairy', 'butter': 'Dairy', 'cheese': 'Dairy',
  'yogurt': 'Dairy', 'cream cheese': 'Dairy', 'sour cream': 'Dairy', 'heavy cream': 'Dairy',
  'cream': 'Dairy', 'mozzarella': 'Dairy', 'cheddar': 'Dairy', 'parmesan': 'Dairy',
  
  // Meat & Seafood
  'chicken': 'Meat & Seafood', 'beef': 'Meat & Seafood', 'pork': 'Meat & Seafood',
  'salmon': 'Meat & Seafood', 'shrimp': 'Meat & Seafood', 'bacon': 'Meat & Seafood',
  'ham': 'Meat & Seafood', 'turkey': 'Meat & Seafood', 'fish': 'Meat & Seafood',
  'ground beef': 'Meat & Seafood', 'chicken breast': 'Meat & Seafood',
  
  // Pantry/Dry Goods
  'flour': 'Pantry', 'sugar': 'Pantry', 'salt': 'Pantry', 'pepper': 'Pantry',
  'olive oil': 'Pantry', 'vegetable oil': 'Pantry', 'vinegar': 'Pantry', 'baking soda': 'Pantry',
  'baking powder': 'Pantry', 'vanilla': 'Pantry', 'honey': 'Pantry', 'rice': 'Pantry',
  'pasta': 'Pantry', 'bread': 'Bakery', 'oats': 'Pantry', 'quinoa': 'Pantry',
  
  // Canned/Packaged
  'canned tomatoes': 'Canned Goods', 'chicken broth': 'Canned Goods', 'vegetable broth': 'Canned Goods',
  'beans': 'Canned Goods', 'tuna': 'Canned Goods', 'coconut milk': 'Canned Goods',
  
  // Frozen
  'frozen vegetables': 'Frozen', 'frozen berries': 'Frozen', 'ice cream': 'Frozen',
  'frozen chicken': 'Frozen', 'frozen fish': 'Frozen',
  
  // Beverages
  'coffee': 'Beverages', 'tea': 'Beverages', 'juice': 'Beverages', 'wine': 'Beverages', 'beer': 'Beverages',
  
  // Spices & Seasonings
  'paprika': 'Spices', 'cumin': 'Spices', 'oregano': 'Spices', 'thyme': 'Spices', 'rosemary': 'Spices',
  'bay leaves': 'Spices', 'cinnamon': 'Spices', 'nutmeg': 'Spices', 'ginger': 'Spices'
};

// Common measurement units
const MEASUREMENT_UNITS = [
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces', 'g', 'gram', 'grams',
  'kg', 'kilogram', 'kilograms', 'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters',
  'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons', 'clove', 'cloves',
  'slice', 'slices', 'piece', 'pieces', 'bunch', 'head', 'can', 'cans', 'bottle', 'bottles',
  'package', 'packages', 'bag', 'bags', 'box', 'boxes'
];

export const useRecipe = () => {
  const [isParsingRecipe, setIsParsingRecipe] = useState(false);
  const [parsedIngredients, setParsedIngredients] = useState([]);

  const parseRecipeText = useCallback((recipeText) => {
    setIsParsingRecipe(true);
    
    try {
      // Split text into lines and clean them
      const lines = recipeText
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const ingredients = [];

      for (let line of lines) {
        // Skip obvious non-ingredient lines
        if (isNonIngredientLine(line)) {
          continue;
        }

        const parsed = parseIngredientLine(line);
        if (parsed) {
          ingredients.push(parsed);
        }
      }

      // Consolidate duplicate ingredients
      const consolidated = consolidateIngredients(ingredients);
      
      setParsedIngredients(consolidated);
      return consolidated;

    } catch (error) {
      console.error('Error parsing recipe:', error);
      return [];
    } finally {
      setIsParsingRecipe(false);
    }
  }, []);

  const parseIngredientLine = (line) => {
    // Remove bullets, numbers, and common prefixes
    let cleanLine = line
      .replace(/^[-•*]\s*/, '')           // Remove bullets
      .replace(/^\d+\.\s*/, '')          // Remove numbered lists
      .replace(/^ingredients?:?\s*/i, '') // Remove "Ingredients:" header
      .trim();

    if (!cleanLine) return null;

    // Extract quantity and unit
    const quantityMatch = cleanLine.match(/^(\d+(?:\/\d+)?(?:\.\d+)?(?:\s*-\s*\d+(?:\/\d+)?(?:\.\d+)?)?)\s+/);
    let quantity = '';
    let unit = '';
    let ingredient = cleanLine;

    if (quantityMatch) {
      quantity = quantityMatch[1];
      ingredient = cleanLine.replace(quantityMatch[0], '');
      
      // Extract unit
      const unitPattern = new RegExp(`^(${MEASUREMENT_UNITS.join('|')})\\s+`, 'i');
      const unitMatch = ingredient.match(unitPattern);
      
      if (unitMatch) {
        unit = unitMatch[1];
        ingredient = ingredient.replace(unitMatch[0], '');
      }
    }

    // Clean up ingredient name
    ingredient = ingredient
      .replace(/,.*$/, '')                    // Remove everything after comma
      .replace(/\(.*\)/, '')                  // Remove parenthetical notes
      .replace(/\s+/g, ' ')                   // Normalize whitespace
      .trim();

    if (!ingredient) return null;

    // Determine category
    const category = determineCategory(ingredient);

    // Format the final text
    let text = '';
    if (quantity) {
      text += quantity;
      if (unit) text += ` ${unit}`;
      text += ' ';
    }
    text += ingredient;

    return {
      text: text.trim(),
      category,
      originalIngredient: ingredient.toLowerCase(),
      quantity,
      unit
    };
  };

  const isNonIngredientLine = (line) => {
    const lowerLine = line.toLowerCase();
    
    // Skip common non-ingredient patterns
    const skipPatterns = [
      /^instructions?:?/i,
      /^directions?:?/i,
      /^method:?/i,
      /^steps?:?/i,
      /^preparation:?/i,
      /^cook(ing)?:?/i,
      /^bake:?/i,
      /^serves?\s+\d+/i,
      /^yield:?/i,
      /^prep time:?/i,
      /^cook time:?/i,
      /^total time:?/i,
      /^\d+\s+(minutes?|mins?|hours?|hrs?)/i,
      /^preheat/i,
      /^heat\s/i,
      /^in\s+a\s/i,
      /^mix\s/i,
      /^add\s/i,
      /^stir\s/i,
      /^combine\s/i,
      /^whisk\s/i,
      /^pour\s/i,
      /^place\s/i,
      /^put\s/i
    ];

    return skipPatterns.some(pattern => pattern.test(line));
  };

  const determineCategory = (ingredient) => {
    const lowerIngredient = ingredient.toLowerCase();
    
    // Direct lookup first
    if (INGREDIENT_CATEGORIES[lowerIngredient]) {
      return INGREDIENT_CATEGORIES[lowerIngredient];
    }

    // Check for partial matches
    for (const [key, category] of Object.entries(INGREDIENT_CATEGORIES)) {
      if (lowerIngredient.includes(key) || key.includes(lowerIngredient)) {
        return category;
      }
    }

    // Default category based on common patterns
    if (lowerIngredient.includes('cheese') || lowerIngredient.includes('milk') || lowerIngredient.includes('cream')) {
      return 'Dairy';
    }
    if (lowerIngredient.includes('chicken') || lowerIngredient.includes('beef') || lowerIngredient.includes('pork') || 
        lowerIngredient.includes('fish') || lowerIngredient.includes('meat')) {
      return 'Meat & Seafood';
    }
    if (lowerIngredient.includes('oil') || lowerIngredient.includes('flour') || lowerIngredient.includes('sugar') || 
        lowerIngredient.includes('salt') || lowerIngredient.includes('spice')) {
      return 'Pantry';
    }
    if (lowerIngredient.includes('can') || lowerIngredient.includes('jar')) {
      return 'Canned Goods';
    }
    if (lowerIngredient.includes('frozen')) {
      return 'Frozen';
    }

    return 'Other';
  };

  const consolidateIngredients = (ingredients) => {
    const consolidated = {};

    for (const ingredient of ingredients) {
      const key = ingredient.originalIngredient;
      
      if (consolidated[key]) {
        // If we already have this ingredient, we could combine quantities
        // For now, we'll just keep the first one
        continue;
      }

      consolidated[key] = ingredient;
    }

    return Object.values(consolidated);
  };

  const createShoppingListFromRecipe = useCallback((ingredients, noteTitle = 'Recipe Shopping List') => {
    // Convert parsed ingredients to checklist items format
    const checklistItems = ingredients.map((ingredient, index) => ({
      text: ingredient.text,
      completed: false,
      order: index,
      category: ingredient.category
    }));

    return {
      title: noteTitle,
      note_type: 'checklist',
      color: 'default',
      checklist_items: checklistItems
    };
  }, []);

  const clearParsedIngredients = useCallback(() => {
    setParsedIngredients([]);
  }, []);

  return {
    parseRecipeText,
    createShoppingListFromRecipe,
    parsedIngredients,
    isParsingRecipe,
    clearParsedIngredients,
    
    // Utility function for external use
    getIngredientCategory: determineCategory,
    
    // Available categories for UI
    availableCategories: [...new Set(Object.values(INGREDIENT_CATEGORIES))].sort()
  };
};