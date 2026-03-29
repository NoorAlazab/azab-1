# QA CaseForge Brand Colors

## Primary Brand Colors

### Brand Primary
- **Token**: `--brand`
- **Value**: `hsl(265, 85%, 56%)`
- **Hex**: `#8B5CF6`
- **Usage**: Primary buttons, links, brand elements, active states

### Brand Foreground
- **Token**: `--brand-foreground`
- **Value**: `hsl(0, 0%, 100%)`
- **Hex**: `#FFFFFF`
- **Usage**: Text on brand-colored backgrounds

## Neutral Palette

### Light Mode
- **Background**: `hsl(0, 0%, 100%)` - Main app background
- **Foreground**: `hsl(222.2, 84%, 4.9%)` - Primary text
- **Card**: `hsl(0, 0%, 100%)` - Card backgrounds
- **Card Foreground**: `hsl(222.2, 84%, 4.9%)` - Text on cards
- **Muted**: `hsl(210, 40%, 96%)` - Subtle backgrounds
- **Muted Foreground**: `hsl(215.4, 16.3%, 46.9%)` - Secondary text
- **Border**: `hsl(214.3, 31.8%, 91.4%)` - Borders and dividers

### Dark Mode
- **Background**: `hsl(222.2, 84%, 4.9%)` - Main app background
- **Foreground**: `hsl(210, 40%, 98%)` - Primary text
- **Card**: `hsl(222.2, 84%, 4.9%)` - Card backgrounds
- **Card Foreground**: `hsl(210, 40%, 98%)` - Text on cards
- **Muted**: `hsl(217.2, 32.6%, 17.5%)` - Subtle backgrounds
- **Muted Foreground**: `hsl(215, 20.2%, 65.1%)` - Secondary text
- **Border**: `hsl(217.2, 32.6%, 17.5%)` - Borders and dividers

## Semantic Colors

### Success
- **Light**: `hsl(142, 76%, 36%)` - Success states, connected indicators
- **Dark**: `hsl(142, 71%, 45%)` - Success states in dark mode

### Warning
- **Light**: `hsl(38, 92%, 50%)` - Warning states, pending actions
- **Dark**: `hsl(38, 92%, 60%)` - Warning states in dark mode

### Destructive
- **Light**: `hsl(0, 84.2%, 60.2%)` - Error states, disconnect actions
- **Dark**: `hsl(0, 62.8%, 30.6%)` - Error states in dark mode

## Usage Guidelines

### Brand Color Usage
- Use `--brand` for primary CTAs, active navigation, and key brand moments
- Reserve for important actions: "Connect Jira", "Generate Tests"
- Use sparingly to maintain impact and hierarchy

### Neutral Usage
- `--muted` for subtle backgrounds, disabled states
- `--muted-foreground` for secondary text, metadata
- `--border` for all dividers and input borders

### Accessibility
- All color combinations meet WCAG 2.1 AA contrast requirements
- Interactive elements have distinct focus states
- Color is never the only way to convey information

### Dark Mode
- Automatically switches based on user preference
- All custom colors have dark mode variants
- Test in both modes during development

## Implementation

Colors are implemented as CSS custom properties in `app/globals.css`:

```css
:root {
  --brand: 265 85% 56%;
  --brand-foreground: 0 0% 100%;
  /* ... other tokens */
}

.dark {
  --brand: 265 85% 56%; /* Brand colors remain consistent */
  /* ... dark variants */
}
```

Use in Tailwind: `bg-brand`, `text-brand-foreground`, etc.