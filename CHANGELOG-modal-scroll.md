# Modal Scrolling Fix

## Date: 2026-01-16

## Issue
The submit button in the bank connection modal was not accessible because the modal content was too tall and there was no scrolling enabled. This particularly affected the corporate account (법인) login form which has additional UI elements.

## Root Cause
- The `.finance-hub__login-form` did not have `overflow-y: auto` enabled
- The form content could grow beyond the modal's `max-height: 85vh`
- The modal had `overflow: hidden` which prevented scrolling

## Solution

### 1. Added Scrolling to Login Form
Updated `.finance-hub__login-form` CSS:

```css
.finance-hub__login-form {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;              /* NEW - Enable vertical scrolling */
  flex: 1;                        /* NEW - Fill available space */
  max-height: calc(85vh - 90px);  /* NEW - Account for modal header */
}
```

**Calculation Breakdown:**
- Modal max-height: `85vh`
- Modal header height: ~`90px` (24px padding top + 24px padding bottom + ~42px content)
- Available space for form: `85vh - 90px`

### 2. Added Custom Scrollbar Styling
Applied consistent scrollbar styling to match the bank list:

```css
.finance-hub__login-form::-webkit-scrollbar {
  width: 8px;
}

.finance-hub__login-form::-webkit-scrollbar-track {
  background: var(--fh-bg-dark);
  border-radius: 4px;
}

.finance-hub__login-form::-webkit-scrollbar-thumb {
  background: var(--fh-border-light);
  border-radius: 4px;
}

.finance-hub__login-form::-webkit-scrollbar-thumb:hover {
  background: var(--fh-text-muted);
}
```

### 3. Mobile Responsive Adjustment
Updated mobile breakpoint (`@media (max-width: 768px)`):

```css
.finance-hub__login-form {
  max-height: calc(90vh - 80px); /* Adjust for mobile modal height */
}
```

**Mobile Calculation:**
- Modal max-height on mobile: `90vh`
- Modal header height on mobile: ~`80px` (slightly smaller)
- Available space for form: `90vh - 80px`

## User Experience Improvements

### Before Fix
```
┌─────────────────────────────┐
│ Modal Header                │ ← Visible
├─────────────────────────────┤
│ Bank Info                   │ ← Visible
│ Account Type (개인/법인)     │ ← Visible
│ Corporate Notice            │ ← Visible
│ Certificate Password        │ ← Visible
│ Save Checkbox               │ ← Partially visible
│ Security Notice             │ ← Cut off
│ [Submit Button]             │ ← NOT VISIBLE ❌
└─────────────────────────────┘
                No scroll available
```

### After Fix
```
┌─────────────────────────────┐
│ Modal Header                │ ← Fixed at top
├─────────────────────────────┤
│ Bank Info                   │ ↕
│ Account Type (개인/법인)     │ ↕
│ Corporate Notice            │ ↕ Scrollable
│ Certificate Password        │ ↕ Content
│ Save Checkbox               │ ↕
│ Security Notice             │ ↕
│ [Submit Button]             │ ✅ Accessible via scroll
└─────────────────────────────┘
                  │
                  ▼
            Scrollbar visible
```

## Testing Checklist

- [x] Desktop: Modal scrolls when content is tall
- [x] Desktop: Submit button is accessible via scroll
- [x] Desktop: Scrollbar is styled consistently
- [x] Mobile: Modal scrolls properly on small screens
- [x] Mobile: Submit button is accessible
- [x] Personal account form: Scrolls correctly (개인)
- [x] Corporate account form: Scrolls correctly (법인)
- [x] Form with certificate notice: All content accessible

## Edge Cases Handled

1. **Short content**: When content fits in viewport, no scrollbar appears
2. **Tall content**: When content exceeds viewport, scrollbar appears automatically
3. **Mobile devices**: Different max-height calculation for smaller screens
4. **Keyboard navigation**: Users can still navigate with Tab key to reach submit button
5. **Enter key**: Submit button can be triggered with Enter key in password field

## Browser Compatibility

- ✅ Chrome/Edge (Chromium) - webkit-scrollbar styling applies
- ✅ Firefox - Falls back to default scrollbar styling
- ✅ Safari - webkit-scrollbar styling applies
- ✅ Electron (used in this app) - webkit-scrollbar styling applies

## Files Modified

- `src/renderer/components/FinanceHub/FinanceHub.css` - Added scrolling styles

## Related Changes

This fix complements the certificate authentication UI update (CHANGELOG-certificate-auth.md) by ensuring all form content is accessible, particularly important for the corporate account flow which has more UI elements.

## Visual Indicators

The scrollbar provides visual feedback:
- **Track**: Dark background (`var(--fh-bg-dark)`)
- **Thumb**: Lighter color (`var(--fh-border-light)`)
- **Thumb (hover)**: Even lighter on hover (`var(--fh-text-muted)`)
- **Width**: 8px (subtle but usable)
- **Border radius**: 4px (matches design system)

## Performance Impact

- ✅ Minimal: Only CSS changes, no JavaScript overhead
- ✅ GPU accelerated: Scrolling uses browser's native scroll engine
- ✅ No layout shifts: Form height is constrained from initial render
