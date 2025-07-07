import React from 'react';
import { useThemeStore } from '../store/theme';
import { Sun, Moon, Monitor } from 'lucide-react';
import type { Theme } from '../store/theme';

interface ThemeToggleProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Helper function to predict theme appearance without causing re-renders
const calculateIsDark = (theme: Theme): boolean => {
  if (theme === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false; // Default for server-side rendering or environments without window
  }
  return theme === 'dark';
};

export function ThemeToggle({ showLabel = false, size = 'md' }: ThemeToggleProps) {
  const { theme, setTheme } = useThemeStore();

  const themes: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const buttonSizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  if (showLabel) {
    return (
      <div className="flex items-center space-x-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        {themes.map(({ value, label, icon: Icon }) => {
          const isActive = theme === value;
          return (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`
                flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${isActive 
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
              title={`Switch to ${label.toLowerCase()} mode`}
            >
              <Icon className={sizeClasses[size]} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Simple toggle button
  const currentTheme = themes.find(t => t.value === theme) || themes[0];
  const Icon = currentTheme.icon;

  return (
    <button
      onClick={() => {
        const currentIndex = themes.findIndex(t => t.value === theme);
        let nextIndex = (currentIndex + 1) % themes.length;

        // If the next theme in the cycle has the same appearance, skip it.
        // This prevents "dead clicks" where the theme name changes but the UI doesn't.
        if (calculateIsDark(themes[nextIndex].value) === isDark) {
          nextIndex = (nextIndex + 1) % themes.length;
        }
        
        setTheme(themes[nextIndex].value);
      }}
      className={`
        ${buttonSizeClasses[size]} rounded-lg transition-all duration-200
        bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700
        text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100
        border border-gray-200 dark:border-gray-700
      `}
      title={`Current: ${currentTheme.label} mode. Click to cycle themes.`}
    >
      <Icon className={sizeClasses[size]} />
    </button>
  );
}

// Compact version for header
export function HeaderThemeToggle() {
  return <ThemeToggle size="md" />;
}

// Full version for settings
export function SettingsThemeToggle() {
  return (
    <div>
      <label className="label">Theme Preference</label>
      <ThemeToggle showLabel size="md" />
      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
        System mode automatically follows your device's theme preference
      </p>
    </div>
  );
} 