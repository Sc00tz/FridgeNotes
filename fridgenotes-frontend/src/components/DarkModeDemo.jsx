import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sun, Moon, Monitor, Palette, Eye } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../hooks/useTheme.jsx';
import { NOTE_COLORS, getThemeAwareColorConfig } from '../utils/colors';

/**
 * Demo component showcasing dark mode implementation
 */
const DarkModeDemo = () => {
  const { theme, isDark, toggleTheme, setLightTheme, setDarkTheme } = useTheme();

  // Sample notes with different colors
  const sampleNotes = [
    { color: 'default', title: 'Default Note', content: 'This is the default note color' },
    { color: 'coral', title: 'Coral Note', content: 'A warm coral-colored note' },
    { color: 'mint', title: 'Mint Note', content: 'A fresh mint-colored note' },
    { color: 'fog', title: 'Fog Note', content: 'A calm fog-colored note' }
  ];

  const colorKeys = Object.keys(NOTE_COLORS).slice(0, 8); // Show first 8 colors

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🌙 Dark Mode Implementation</h1>
        <p className="text-muted-foreground">Complete theme switching with note color adaptation</p>
      </div>

      {/* Theme Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Current Theme:</span>
            <Badge variant={isDark ? "default" : "secondary"} className="flex items-center gap-1">
              {isDark ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={!isDark ? "default" : "outline"}
              size="sm"
              onClick={setLightTheme}
              className="flex items-center gap-2"
            >
              <Sun className="h-4 w-4" />
              Light Mode
            </Button>
            
            <Button
              variant={isDark ? "default" : "outline"}
              size="sm"
              onClick={setDarkTheme}
              className="flex items-center gap-2"
            >
              <Moon className="h-4 w-4" />
              Dark Mode
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="flex items-center gap-2"
            >
              <Monitor className="h-4 w-4" />
              Toggle Theme
            </Button>

            <ThemeToggle showLabel={true} />
          </div>

          <div className="text-sm text-muted-foreground">
            💡 Theme preference is automatically saved to localStorage and respects system preferences
          </div>
        </CardContent>
      </Card>

      {/* Sample Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Note Color Adaptation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sampleNotes.map((note, index) => {
              const colorConfig = getThemeAwareColorConfig(note.color, isDark);
              return (
                <div
                  key={index}
                  className="p-4 rounded-lg border-2 transition-all duration-200"
                  style={{
                    backgroundColor: colorConfig.background,
                    borderColor: colorConfig.border,
                    color: colorConfig.text
                  }}
                >
                  <h4 className="font-semibold mb-2">{note.title}</h4>
                  <p className="text-sm opacity-80">{note.content}</p>
                  <div className="mt-2 text-xs opacity-60">
                    Color: {note.color}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Color Palette Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Color Palette Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {colorKeys.map((colorKey) => {
              const colorConfig = getThemeAwareColorConfig(colorKey, isDark);
              const lightConfig = getThemeAwareColorConfig(colorKey, false);
              const darkConfig = getThemeAwareColorConfig(colorKey, true);

              return (
                <div key={colorKey} className="space-y-2">
                  <div className="text-center">
                    <div className="text-xs font-medium mb-1 capitalize">
                      {NOTE_COLORS[colorKey].name}
                    </div>
                    
                    {/* Current theme color */}
                    <div
                      className="w-full h-12 rounded border-2 mb-1"
                      style={{
                        backgroundColor: colorConfig.background,
                        borderColor: colorConfig.border
                      }}
                    />
                    
                    {/* Light/Dark comparison */}
                    <div className="flex rounded overflow-hidden">
                      <div
                        className="flex-1 h-6 flex items-center justify-center"
                        style={{ backgroundColor: lightConfig.background }}
                        title="Light mode"
                      >
                        <Sun className="h-3 w-3 text-gray-600" />
                      </div>
                      <div
                        className="flex-1 h-6 flex items-center justify-center"
                        style={{ backgroundColor: darkConfig.background }}
                        title="Dark mode"
                      >
                        <Moon className="h-3 w-3 text-gray-200" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Implementation Details */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">✨ Theme Persistence</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Saves to localStorage</li>
                <li>• Respects system preference</li>
                <li>• Instant switching</li>
                <li>• No flash of wrong theme</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">🎨 Color Adaptation</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Theme-aware note colors</li>
                <li>• Automatic contrast adjustment</li>
                <li>• Readable text in all modes</li>
                <li>• Smooth color transitions</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">🔧 Developer Experience</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• useTheme() hook</li>
                <li>• CSS custom properties</li>
                <li>• Tailwind dark: classes</li>
                <li>• Easy component integration</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Using the Theme Hook</h4>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`import { useTheme } from './hooks/useTheme';

function MyComponent() {
  const { isDark, toggleTheme, theme } = useTheme();
  
  return (
    <div className={isDark ? 'dark-styles' : 'light-styles'}>
      Current theme: {theme}
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
}`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Theme-Aware Colors</h4>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`import { getThemeAwareColorConfig } from './utils/colors';

const colorConfig = getThemeAwareColorConfig('coral', isDark);
// Returns appropriate colors for current theme`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold mb-2">CSS Dark Mode Classes</h4>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`/* Tailwind CSS */
<div className="bg-white dark:bg-gray-800 text-black dark:text-white">
  Automatically adapts to theme
</div>

/* Custom CSS */
.my-component {
  background: white;
}
.dark .my-component {
  background: #1f2937;
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DarkModeDemo;