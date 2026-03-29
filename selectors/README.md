# Selector Repository

This directory contains CSS selector mappings for UI elements across different pages of the application. These mappings are used by the exploration testing system to reliably locate and interact with elements.

## Directory Structure

```
selectors/
├── README.md           # This file
├── schema.json         # JSON schema for validation
├── common.json         # Shared elements (header, nav, footer)
└── pages/              # Page-specific selector mappings
    ├── login.json      # Login page elements
    ├── dashboard.json  # Dashboard page elements
    └── ...             # Other page mappings
```

## Purpose

Instead of guessing selectors during test execution, we maintain a repository of verified, reliable selectors. This dramatically improves test accuracy from ~30% to ~95%+.

## How to Add Selectors

### Method 1: Using Playwright Codegen (Recommended)

1. Run the recording tool:
   ```bash
   npm run codegen https://your-website.com
   ```

2. Interact with your website (click buttons, fill forms, etc.)

3. Copy the generated code and use the converter:
   ```bash
   npm run record-selectors -- pageName
   ```

4. The tool will parse the code and create a JSON file in `selectors/pages/`

### Method 2: Manual Extraction

1. Open Chrome DevTools on your target page
2. Right-click elements and select "Inspect"
3. Find reliable selectors (data-testid, unique IDs, ARIA labels)
4. Create a JSON file following the schema in `schema.json`

## Selector Format

Each selector file follows this structure:

```json
{
  "page": "/page-path",
  "description": "Description of this page",
  "elements": {
    "elementKey": {
      "key": "elementKey",
      "primary": "button[data-testid='submit']",
      "fallbacks": [
        "button[type='submit']",
        "button:has-text('Submit')"
      ],
      "metadata": {
        "type": "button",
        "text": "Submit",
        "label": "Submit form",
        "description": "Primary submit button for the form"
      },
      "context": {
        "nearElement": "input[name='email']",
        "insideContainer": "form.login-form"
      }
    }
  }
}
```

## Best Practices

### 1. Use Descriptive Element Keys
- ✅ Good: `loginButton`, `usernameField`, `submitFormButton`
- ❌ Bad: `btn1`, `input2`, `element`

### 2. Provide Multiple Fallback Selectors
Always provide 2-3 fallback selectors in order of reliability:
1. **Primary**: Most specific and reliable (data-testid, unique ID)
2. **Fallback 1**: Semantic selector (aria-label, type)
3. **Fallback 2**: Text-based selector (has-text)

### 3. Prefer Stable Selectors
Good (stable):
- `[data-testid='login']` - Intentional test attribute
- `#username` - Unique ID
- `input[type='email']` - Semantic attribute
- `button[aria-label='Submit']` - Accessibility attribute

Bad (fragile):
- `.css-abc123` - Generated class names
- `div > div > button` - Structural (breaks if HTML changes)
- `.btn-primary.btn-lg` - Multiple classes (order matters)

### 4. Add Metadata
Always include metadata to help future developers understand:
- `type`: Element type (button, input, link, select, text)
- `text`: Visible text on the element
- `label`: ARIA label or associated label
- `description`: What this element does

### 5. Use Context When Needed
For ambiguous elements (e.g., multiple submit buttons), use context:
```json
{
  "context": {
    "insideContainer": "form.checkout-form",
    "nearElement": "input[name='credit-card']"
  }
}
```

## Validation

Validate your selector files:

```bash
npm run validate-selectors
```

Check if selectors still work on live website:

```bash
npm run check-selectors -- https://your-website.com
```

## Maintenance

- **Update selectors** when UI changes
- **Run health checks** regularly to catch broken selectors
- **Remove obsolete selectors** for deleted pages/features
- **Document major changes** in git commits

## Common Element Types

- `button`: Buttons, submit buttons
- `input`: Text inputs, email inputs, password fields
- `select`: Dropdown menus
- `checkbox`: Checkboxes
- `radio`: Radio buttons
- `link`: Anchor tags, navigation links
- `text`: Static text elements to verify
- `container`: Divs, sections used for context

## Examples

See `common.json` and `pages/login.json` for complete examples.
