# Browser Recorder: Self-Healing & Validation System

This document outlines the implementation plan for adding a robust validation layer to the Browser Recorder's replay engine. The goal is to prevent "silent failures" where the engine clicks the wrong element due to UI shifts (e.g., an element changing its index or position).

## 1. The Problem: Structural Instability
Currently, the replay engine uses a chain of strategies (Semantic → CSS → XPath). If a CSS selector like `button[1]` is used, the engine will click whatever is at that index. If the UI has changed and `button[1]` is now a "Delete" button instead of the recorded "조회" button, the script will proceed incorrectly without throwing an error.

## 2. The Solution: Pre-Action Validation
Before performing any interaction (click, fill, etc.), the engine should validate that the target element matches the metadata captured during recording.

### Key Metadata for Validation:
- `innerText`: Does the element contain the expected text?
- `role`: Is it still a "button", "link", or "input"?
- `ariaLabel`: Does the accessibility label match?

## 3. Implementation Plan

### Step 1: Create a Validation Helper
Add a `validateElement` function to `egdesk-scratch/src/main/browser-recording-locator-strategies.ts`.

```typescript
async function validateElement(locator: Locator, action: RecordedActionLocatorFields): Promise<boolean> {
  try {
    // 1. Text Validation
    if (action.innerText) {
      const actualText = await locator.innerText();
      if (!actualText.trim().includes(action.innerText.trim())) {
        return false;
      }
    }

    // 2. Role/Tag Validation
    if (action.role) {
      const actualRole = await locator.getAttribute('role');
      const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
      if (actualRole !== action.role && tagName !== action.role) {
        return false;
      }
    }

    return true;
  } catch (e) {
    return false; // Element not ready or detached
  }
}
```

### Step 2: Integrate into Strategy Loop
Modify `clickWithOrderedStrategies` to invoke validation for structural selectors (CSS/XPath).

```typescript
// Inside clickWithOrderedStrategies loop
for (const strategy of order) {
  try {
    const locator = getLocatorForStrategy(strategy);
    
    // Validate structural strategies
    if (strategy === 'css' || strategy === 'xpath') {
      const isValid = await validateElement(locator, action);
      if (!isValid) {
        throw new Error(`Validation failed for ${strategy} strategy`);
      }
    }

    await locator.click({ timeout: 5000 });
    return strategy;
  } catch (e) {
    // Fallback to next strategy in the chain
  }
}
```

### Step 3: Spatial Recovery (Optional Enhancement)
If validation fails for the primary index (e.g., `button[1]`), the engine can automatically scan neighboring indices (`button[0]`, `button[2]`) to see if the target element has shifted.

```typescript
async function trySpatialRecovery(root, selector, expectedText) {
  const match = selector.match(/(.*)\[(\d+)\]/);
  if (!match) return null;

  const [_, base, index] = match;
  for (const offset of [-1, 1]) {
    const candidate = root.locator(`${base}[${parseInt(index) + offset}]`);
    if (await validateElement(candidate, { innerText: expectedText })) {
      return candidate;
    }
  }
  return null;
}
```

## 4. Benefits
- **Self-Healing**: Scripts automatically adapt to minor UI changes by falling back to semantic or spatial matches.
- **High Fidelity**: Guarantees that the automation interacts with the exact same logical element the user intended.
- **Better Debugging**: Failures occur at the point of mismatch, providing clear logs about what changed in the UI.
