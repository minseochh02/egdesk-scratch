# NH Business Bank Virtual Keyboard Implementation

## Date: 2026-01-16

## Summary
Implemented AI-powered virtual keyboard automation for NH Business Bank (법인) certificate password entry using Gemini Vision API.

## Challenge

NH Business Bank uses **INItech certificate authentication** with a randomized virtual keyboard for security:
- Keyboard layout changes on each login
- Keys are displayed as an image (not HTML elements)
- Cannot use traditional Playwright `.fill()` or `.type()` methods
- Must click on exact pixel coordinates of each character

## Solution: Gemini Vision AI

We use Google's Gemini Vision API to analyze the keyboard image and extract key positions.

### Implementation

#### 1. New Methods Added (`NHBusinessBankAutomator.js`)

**A. `analyzeINItechKeyboard(page)`**
```javascript
async analyzeINItechKeyboard(page) {
  // 1. Locate keyboard element
  const keyboardSelector = '[id="ini_cert_pwd_imgTwin"]';
  const keyboardElement = page.locator(keyboardSelector);

  // 2. Wait for visibility
  await keyboardElement.waitFor({ state: 'visible', timeout: 5000 });

  // 3. Get keyboard bounds (for coordinate translation)
  const keyboardBox = await this.getElementBox(page, keyboardSelector);

  // 4. Take screenshot
  const screenshotPath = path.join(this.outputDir, `nh-business-keyboard-${timestamp}.png`);
  await keyboardElement.screenshot({ path: screenshotPath });

  // 5. Analyze with Gemini Vision
  const analysisResult = await analyzeKeyboardAndType(
    screenshotPath,
    geminiApiKey,
    keyboardBox,
    null, // Don't type yet
    null, // Don't pass page yet
    {}
  );

  // 6. Export JSON for debugging
  exportKeyboardJSON(analysisResult.keyboardKeys, jsonPath, null);

  return {
    success: true,
    keyboardKeys: analysisResult.keyboardKeys,
    screenshotPath,
    jsonPath
  };
}
```

**B. `typePasswordWithKeyboard(page, keyboardKeys, password)`**
```javascript
async typePasswordWithKeyboard(page, keyboardKeys, password) {
  const results = { success: true, typedChars: 0, failedChars: [] };

  for (let i = 0; i < password.length; i++) {
    const char = password[i];

    // Find key in keyboard mapping
    const keyData = Object.entries(keyboardKeys).find(([label]) => {
      return label === char || label.toLowerCase() === char.toLowerCase();
    });

    if (!keyData) {
      results.failedChars.push(char);
      results.success = false;
      continue;
    }

    const [label, data] = keyData;
    const { x, y } = data.position;

    // Click at exact coordinates
    await page.mouse.click(x, y);
    await page.waitForTimeout(this.config.delays.keyPress);
    results.typedChars++;
  }

  return results;
}
```

#### 2. Updated Certificate Login Flow

**Before (Placeholder):**
```javascript
// Step 6: Enter password via virtual keyboard clicks
for (let i = 0; i < certificatePassword.length; i++) {
  await page.locator(this.config.xpaths.certPasswordKeyboardKey).click();
  await page.waitForTimeout(this.config.delays.keyPress);
}
```

**After (AI-Powered):**
```javascript
// Step 6: Analyze virtual keyboard with Gemini
const keyboardAnalysis = await this.analyzeINItechKeyboard(page);

if (!keyboardAnalysis.success) {
  throw new Error(`Keyboard analysis failed: ${keyboardAnalysis.error}`);
}

// Step 7: Type password using analyzed keyboard coordinates
const typingResult = await this.typePasswordWithKeyboard(
  page,
  keyboardAnalysis.keyboardKeys,
  certificatePassword
);

if (!typingResult.success) {
  throw new Error(`Failed to type password. Failed characters: ${typingResult.failedChars.join(', ')}`);
}
```

## Workflow Diagram

```
┌─────────────────────────────────────────────┐
│ 1. User enters certificate password         │
│    Input: "MyP@ssw0rd123"                   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 2. Click virtual keyboard button            │
│    Selector: [id="ini_cert_pwd_tk_btn_..."] │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 3. Keyboard appears (randomized layout)     │
│    Element: [id="ini_cert_pwd_imgTwin"]     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 4. Take screenshot                           │
│    Output: nh-business-keyboard-[TIME].png  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 5. Send to Gemini Vision API                │
│    Request: "Analyze this keyboard image"   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 6. Gemini returns key positions              │
│    Result: {                                │
│      "M": { "position": { "x": 123, "y": 45 } },│
│      "y": { "position": { "x": 234, "y": 45 } },│
│      "P": { "position": { "x": 345, "y": 45 } },│
│      "@": { "position": { "x": 456, "y": 78 } },│
│      ...                                    │
│    }                                        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 7. Type password character by character     │
│    For "MyP@ssw0rd123":                     │
│    - Click "M" at (123, 45)                 │
│    - Click "y" at (234, 45)                 │
│    - Click "P" at (345, 45)                 │
│    - Click "@" at (456, 78)                 │
│    - ... (repeat for all characters)        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 8. Submit certificate                        │
│    Button: [id="INI_certSubmit"]            │
└─────────────────────────────────────────────┘
```

## Key Features

### ✅ Advantages
1. **Handles randomization** - Works with any keyboard layout
2. **AI-powered** - No manual mapping needed
3. **Automatic** - Detects all keys automatically
4. **Debuggable** - Saves screenshots and JSON for troubleshooting
5. **Reusable** - Can work with other INItech keyboards

### ⚠️ Requirements
- **Gemini API Key** - Must be set in environment (`GEMINI_API_KEY`)
- **Internet connection** - To call Gemini Vision API
- **Clear keyboard image** - Screenshot must be readable

### 🔧 Configuration
Located in `config.js`:
```javascript
delays: {
  keyPress: 200,      // Delay between key clicks
  keyboardUpdate: 1000, // Wait after keyboard updates
}
```

## Error Handling

### If Gemini Analysis Fails
```javascript
{
  success: false,
  error: "Keyboard analysis failed: [reason]"
}
```

**Possible causes:**
- GEMINI_API_KEY not set
- Network error
- Invalid keyboard screenshot
- Gemini API quota exceeded

### If Password Typing Fails
```javascript
{
  success: false,
  typedChars: 7,
  failedChars: ['@', '#'],
  details: [...]
}
```

**Possible causes:**
- Character not found in keyboard (special characters)
- Coordinate mismatch
- Page scrolled/moved during typing
- Keyboard layout changed unexpectedly

## Debugging

### Check Screenshot
```bash
open output/nh-business/nh-business-keyboard-TIMESTAMP.png
```

### Check Key Mappings
```bash
cat output/nh-business/nh-business-keyboard-layout-TIMESTAMP.json
```

### Example Debug Output
```json
{
  "0": { "position": { "x": 532, "y": 412 }, "confidence": 0.95 },
  "1": { "position": { "x": 488, "y": 412 }, "confidence": 0.97 },
  "2": { "position": { "x": 576, "y": 412 }, "confidence": 0.96 },
  ...
}
```

## Comparison: INItech vs NH Personal Keyboard

| Feature | NH Personal | NH Business (INItech) |
|---------|-------------|----------------------|
| **System** | NH Custom | **INItech Security** |
| **Layouts** | Lower + Upper (Shift) | **Single layout** |
| **Element** | `imgTwinLower/Upper` | `ini_cert_pwd_imgTwin` |
| **Randomization** | Yes | **Yes** |
| **Special chars** | Via Shift | **Built-in** |

## Performance

**Typical timing:**
- Screenshot capture: ~100ms
- Gemini API call: ~2-5 seconds
- Password typing (10 chars): ~2 seconds (200ms × 10)
- **Total overhead**: ~4-7 seconds (one-time per login)

## Next Steps