// Theme utility functions for consistent styling
export const themeStyles = {
  // Background styles
  bg: {
    primary: { backgroundColor: "var(--bg-primary)" },
    secondary: { backgroundColor: "var(--bg-secondary)" },
    tertiary: { backgroundColor: "var(--bg-tertiary)" },
  },

  // Text styles
  text: {
    primary: { color: "var(--text-primary)" },
    secondary: { color: "var(--text-secondary)" },
    tertiary: { color: "var(--text-tertiary)" },
  },

  // Border styles
  border: {
    primary: { borderColor: "var(--border-primary)" },
    secondary: { borderColor: "var(--border-secondary)" },
  },

  // Card styles
  card: {
    base: {
      backgroundColor: "var(--bg-primary)",
      border: "1px solid var(--border-primary)",
      boxShadow: "var(--shadow)",
    },
  },

  // Form styles
  form: {
    input: {
      backgroundColor: "var(--bg-primary)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-secondary)",
    },
    label: {
      color: "var(--text-secondary)",
    },
  },

  // Button styles
  button: {
    secondary: {
      backgroundColor: "var(--bg-primary)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border-secondary)",
    },
  },
};

// Helper function to merge theme styles with existing styles
export const mergeThemeStyles = (
  baseStyles: React.CSSProperties,
  themeStyles: React.CSSProperties
): React.CSSProperties => {
  return { ...baseStyles, ...themeStyles };
};
