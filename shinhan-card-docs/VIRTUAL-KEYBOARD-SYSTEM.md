# Virtual Keyboard System Analysis

## 📋 Overview

Shinhan Card implements a **scrambled virtual keyboard** system that allows users to input passwords by clicking on-screen buttons instead of using a physical keyboard.

This system is designed to:
- Prevent keyloggers from capturing passwords
- Provide an alternative to hardware keyboard input
- Change button positions each session (anti-screenshot protection)

---

## 🔄 System Flow

### 1. Initialization (Page Load)

**Browser → Shinhan Server:**
```
POST /nppfs.keypad.jsp
Parameters:
  - m=e (mode)
  - u=176965174957734 (session ID)
  - i=pwd (field name)
  - ui=pwd_useyn_toggle (toggle button ID)
  - ev=v4 (version)
  - w=1265, h=720 (browser dimensions)
  - il=20 (input length max)
```

**Shinhan Server → Browser:**
```json
{
  "info": {
    "keypadUuid": "cfa51a22c246",
    "type": "keyboard",
    "mode": "layer",
    "tw": 1470,
    "th": 566,
    "iw": 569,
    "ih": 278,
    "inputs": {
      "hash": "__KH_cfa51a22c246",
      "useyn": "__KU_cfa51a22c246",
      "info": "__KI_pwd"
    }
  },
  "items": [
    {
      "id": "lower",
      "buttons": [
        {
          "type": "data",
          "action": "data:4d567a87511f8a72976578b053603521b045f3ce:a",
          "coord": {"x1": 15, "y1": 123, "x2": 59, "y2": 157},
          "preCoord": {"x1": 584, "y1": 123, "x2": 628, "y2": 157}
        },
        ...
      ]
    },
    {
      "id": "upper",
      "buttons": [...]
    },
    {
      "id": "special",
      "buttons": [...]
    }
  ]
}
```

---

### 2. Keypad Rendering

**Browser receives:**
- **Keypad image:** Downloaded from `nppfs.keypad.jsp` (GET request)
- **Button coordinates:** From layout response
- **Image structure:** Sprite sheet (1138 × 834 pixels)

**Image Layout (Vertical Sprite):**
```
┌─────────────────────┐
│  Lower Layout       │  Y: 0-278px
│  (lowercase + num)  │
├─────────────────────┤
│  Upper Layout       │  Y: 278-556px
│  (uppercase + num)  │
├─────────────────────┤
│  Special Layout     │  Y: 556-834px
│  (symbols)          │
└─────────────────────┘
```

**Visible Area:** 569 × 278 pixels (shows one layout at a time)

**Layout switching** uses CSS margin-top offset:
- Show "lower": `margin-top: 0px`
- Show "upper": `margin-top: -278px`
- Show "special": `margin-top: -556px`

---

### 3. Button Click Event

**User clicks button on virtual keypad:**

**JavaScript captures click coordinates** → Finds matching button from layout data → Extracts action

**Action format:** `data:<hash>:<mask>`
- **Hash:** 40-character hex string (SHA1 length)
- **Mask:** Single character shown in visible field ('a', 'A', '1', '_')

**Example:**
```
User clicks button at (15, 123)
Action: data:4d567a87511f8a72976578b053603521b045f3ce:a

Extracted:
  - Hash: 4d567a87511f8a72976578b053603521b045f3ce
  - Mask: a (lowercase letter indicator)
```

---

### 4. Field Updates

**Visible Password Field (#pwd):**
```
Updates with mask character:
  - Clicked lowercase letter → Shows "a"
  - Clicked uppercase letter → Shows "A"
  - Clicked number → Shows "1"
  - Clicked special char → Shows "_"
```

**Hidden Hash Field (__KH_<uuid>):**
```
Appends hash value (96 characters):
  - First click: 96 chars
  - Second click: 192 chars
  - Third click: 288 chars
  ...
```

**Hash Structure (96 chars = 48 bytes):**
- Not a standard hash algorithm (SHA256=64 chars, SHA384=96 chars but didn't match)
- Possibly: Original hash (40 chars) + session data + checksum = 96 chars
- Or: Double hash with metadata

---

### 5. Form Submission

**When user clicks login, browser sends:**

```
POST /CMMServiceMemLoginC.ajax
Data:
  - memid: "testuser"
  - pwd: "aaa111" (masked visible value)
  - __KH_cfa51a22c246: "96chars+96chars+96chars..." (concatenated hashes)
  - __KU_cfa51a22c246: "N" (keypad used flag)
  - __KI_pwd: "session_key..." (encryption key)
  - __E2E_UNIQUE__: "176965174957734" (session ID)
```

**Server verifies:**
- Decodes the __KH_ hashes
- Validates password
- Checks that keypad was used properly

---

## 🔑 Key Fields Explained

### Session-Level Fields (Set Once)

**`__E2E_UNIQUE__`:** Session correlation ID
- Example: "176965174957734"
- Used across all requests to link them to same session

**`__KI_pwd`:** Session encryption key
- Length: 192 chars (96 bytes)
- Retrieved from nppfs.key.jsp
- Used for encrypting/validating data

---

### Keypad-Specific Fields (Per Field)

**`__KH_<uuid>`:** Keypad hash field (DYNAMIC)
- Example field name: `__KH_cfa51a22c246`
- Contains concatenated button hashes (96 chars per click)
- Used when virtual keypad is used

**`__KU_<uuid>`:** Keypad usage flag
- Example: "N" or "Y"
- Indicates if virtual keypad was used

**`pwd__E2E__`:** Keyboard hash field (DYNAMIC)
- Contains hashes from HARDWARE keyboard (64 chars per keystroke)
- NOT used when virtual keypad is active
- Mutually exclusive with __KH_ field

---

## 🎯 Hardware Keyboard vs Virtual Keypad

| Aspect | Hardware Keyboard | Virtual Keypad |
|--------|------------------|----------------|
| **Input Method** | Physical HID keyboard | Mouse clicks on screen |
| **Hash Field** | `pwd__E2E__` | `__KH_<uuid>` |
| **Hash Length** | 64 chars/keystroke | 96 chars/click |
| **HID Detection** | ✅ Required | ❌ Not required |
| **Scrambling** | N/A | ✅ Scrambled per session |
| **Timing Captured** | Yes (via INCA) | No (click events) |
| **Mask Character** | 'a', '1', etc. | 'a', '1', etc. |

---

## 🧩 Coordinate Systems

### Two Coordinate Sets

**`coord`:** Position where user clicks (scrambled positions)
- Example: `{"x1": 15, "y1": 123, "x2": 59, "y2": 157}`
- These are the actual button positions on the scrambled keypad
- User clicks here

**`preCoord`:** Position on the sprite sheet image
- Example: `{"x1": 584, "y1": 123, "x2": 628, "y2": 157}`
- These are positions on the source image
- Used for rendering/preview?

**Theory:**
- Left side of sprite (0-569px): Scrambled layout (using `coord`)
- Right side of sprite (569-1138px): Unscrambled preview (using `preCoord`)
- Or: `preCoord` is for hover/preview overlay

---

## 🔐 Security Mechanisms

### 1. Per-Session Scrambling

**Each session gets different button positions:**
```
Session 1: "a" button at (15, 123)
Session 2: "a" button at (420, 193)  (different!)
Session 3: "a" button at (82, 471)   (different!)
```

**Prevents:**
- Pre-recorded click bots
- Screenshot analysis
- Position-based automation

---

### 2. Hash Obfuscation

**Button action only reveals:**
- Hash: `4d567a87511f8a72976578b053603521b045f3ce`
- Mask type: `:a` (lowercase), `:1` (number), etc.

**Does NOT reveal:**
- Which specific character (only the category)
- "a" vs "b" vs "c" (all show `:a`)
- "1" vs "2" vs "3" (all show `:1`)

**User must visually identify** the character on the button image.

---

### 3. Multi-Layout System

**Three layouts in one sprite:**
- **lower:** Lowercase letters + numbers
- **upper:** Uppercase letters + numbers
- **special:** Special characters

**User switches layouts** using control buttons:
- `action:show:upper` → Switch to uppercase
- `action:show:special` → Switch to special chars
- `action:show:lower` → Back to lowercase

---

## 🚨 Current Understanding Gaps

### ❓ Unresolved Questions

1. **What are coord vs preCoord exactly?**
   - Why two coordinate sets?
   - Which one is used for click detection?
   - Which one maps to the sprite sheet positions?

2. **Why do bounding boxes overlap in our visualization?**
   - Are we using the wrong coordinates?
   - Wrong Y offset calculation?
   - Misunderstanding the sprite layout?

3. **What is the 96-character hash structure?**
   - 40 chars (original hash) + 56 chars (???)
   - Custom concatenation?
   - Encrypted/encoded format?

4. **How does click detection work?**
   - Does browser use `coord` for hit detection?
   - Does it use invisible <div> overlays?
   - JavaScript event handlers on specific positions?

---

## 🧪 Test Results Summary

### Test 1: Virtual Keypad Field Discovery
**Result:** ✅ Confirmed virtual keypad uses `__KH_` fields
- Clicking virtual keypad → `__KH_b3c17f82febd` populated
- Length: 96 chars per click
- Different from hardware keyboard's `pwd__E2E__` (64 chars)

### Test 2: Keypad Layout Capture
**Result:** ✅ Successfully intercepted layout response
- Captured button coordinates
- Extracted hashes and mask characters
- Downloaded keypad sprite image

### Test 3: Visualization Attempt
**Result:** ⚠️ Bounding boxes overlap
- Issue: Uncertain which coordinates to use (coord vs preCoord)
- Issue: Y offset calculation might be wrong
- Need to understand sprite sheet structure better

---

## 💡 Exploitation Potential

### Theoretical Bypass Method

**If we can map characters to hashes:**

```javascript
// 1. Get keypad layout for session
const layout = await getKeypadLayout(sessionID);

// 2. Build character → hash mapping
// (User-assisted or automated learning)
const mapping = buildMapping(layout);

// 3. For password "test123":
const password = "test123";
let khField = "";

for (char of password) {
  const hash = mapping[char].hash;
  khField += hash;  // Concatenate 96-char hashes
}

// 4. Submit form
submitLogin({
  __KH_cfa51a22c246: khField,
  __E2E_UNIQUE__: sessionID,
  // ... other fields
});
```

**Advantages:**
- ✅ Bypasses HID detection (using virtual keypad as intended)
- ✅ No hardware keyboard needed
- ✅ Works with browser automation

**Limitations:**
- ❌ Keypad scrambles each session (need new mapping)
- ❌ Must identify characters visually (OCR or user-assisted)
- ❌ Hash generation algorithm unknown (can't predict without layout)

---

## 🎯 Next Steps

### Priority 1: Understand Coordinate System
- Test which coordinates (coord vs preCoord) match the visible buttons
- Fix visualization to show boxes in correct positions
- Confirm sprite sheet structure

### Priority 2: Character Mapping
- Once visualization is correct, manually map characters
- Build lookup table: char → hash for current session
- Test if we can inject hashes directly into __KH_ field

### Priority 3: Automation
- Automate the mapping process (click all buttons, learn mapping)
- Automate password entry using learned mapping
- Test if server accepts our injected __KH_ values

### Priority 4: OCR Integration
- Implement OCR to read characters from keypad image
- Fully automate the mapping process
- No manual intervention needed

---

## 📊 Architecture Diagram

```
[User Opens Page]
        ↓
[Browser] → POST /nppfs.keypad.jsp (session_id, field_name)
        ↓
[Shinhan Server]
        ├─ Generates scrambled keypad layout
        ├─ Creates button hash mappings
        └─ Responds with layout JSON + image URL
        ↓
[Browser Receives]
        ├─ Layout JSON (buttons, coords, hashes, actions)
        └─ Image URL → GET /nppfs.keypad.jsp?k=...
        ↓
[Browser Renders]
        ├─ Downloads sprite sheet image (1138×834px)
        ├─ Creates clickable areas at specified coordinates
        └─ Shows one layout at a time (569×278 visible area)
        ↓
[User Clicks Button]
        ├─ JavaScript detects click at (x, y)
        ├─ Finds matching button from layout data
        └─ Executes button action: "data:<hash>:<mask>"
        ↓
[Browser Updates Fields]
        ├─ Visible field (#pwd): Appends mask char ("a", "1", etc.)
        └─ Hidden field (__KH_uuid): Appends 96-char hash
        ↓
[User Clicks Login]
        ↓
[Browser] → POST /CMMServiceMemLoginC.ajax
        ├─ pwd: "aaa111" (masked visible)
        ├─ __KH_<uuid>: "96chars+96chars+..." (virtual keypad hashes)
        └─ __E2E_UNIQUE__: session_id
        ↓
[Shinhan Server]
        ├─ Validates __KH_ hashes
        ├─ Decodes password
        └─ Returns success/failure
```

---

## 🔬 Technical Details

### Sprite Sheet Structure

**Full Image:** 1138 × 834 pixels

**Composition:**
- **Horizontal:** Two sections?
  - Left (0-569px): Scrambled keypad?
  - Right (569-1138px): Preview/unscrambled?
- **Vertical:** Three layouts stacked
  - Top (0-278px): "lower" layout
  - Middle (278-556px): "upper" layout
  - Bottom (556-834px): "special" layout

**Viewport:** Shows 569 × 278 (one layout at a time)

---

### Button Data Structure

```json
{
  "type": "data",
  "label": "",
  "coord": {
    "x1": 15,
    "y1": 123,
    "x2": 59,
    "y2": 157
  },
  "preCoord": {
    "x1": 584,
    "y1": 123,
    "x2": 628,
    "y2": 157
  },
  "action": "data:4d567a87511f8a72976578b053603521b045f3ce:a"
}
```

**Fields:**
- `type`: "data" (character) or "cmd" (control button)
- `coord`: Button position (purpose unclear - scrambled? visible?)
- `preCoord`: Alternate position (purpose unclear - preview? unscrambled?)
- `action`: Action to execute on click

---

### Action Types

**1. Character Input (type: "data")**
```
Format: data:<hash>:<mask>

Examples:
  - data:4d567a87...:a → Some lowercase letter (shows "a")
  - data:5d61a971...:1 → Some number (shows "1")
  - data:308e4854...:A → Some uppercase letter (shows "A")
  - data:ead0ef39...:_ → Some special char (shows "_")
```

**2. Control Actions (type: "cmd")**
```
action:close          → Close keypad
action:show:upper     → Switch to uppercase layout
action:show:lower     → Switch to lowercase layout
action:show:special   → Switch to special chars layout
action:delete         → Backspace (delete last character)
action:clear          → Clear entire field
action:enter          → Submit/Enter
action:refresh:lower  → Refresh/rescramble keypad
```

---

## 🔐 Hash System

### Virtual Keypad Hash (96 characters)

**From button action:** 40 hex chars (SHA1 length)
```
Example: 4d567a87511f8a72976578b053603521b045f3ce
```

**Stored in __KH_ field:** 96 hex chars
```
Example: 1d0dc15daaf3a23609163268896ecbb5fc8faa885aea26044e...
```

**Questions:**
- Is the 40-char hash transformed into 96 chars?
- Is additional data appended (timestamp, position, session data)?
- What algorithm produces the final 96-char value?

---

### Comparison: Hardware vs Virtual

**Hardware Keyboard:**
```
Input: User types "a"
Hash: SHA256-like, 64 hex chars
Field: pwd__E2E__
Hash includes: session_key + char + position + timestamp?
```

**Virtual Keypad:**
```
Input: User clicks button with hash "4d567a87..."
Hash: Custom format, 96 hex chars
Field: __KH_<uuid>
Hash includes: button_hash + ??? (additional 56 chars)
```

---

## 🎨 Coordinate Mystery

### The Overlapping Box Problem

**Observation:** Drawing boxes using either `coord` or `preCoord` causes overlaps

**Possible explanations:**

**Theory 1: Horizontal split**
- Left half (0-569px): Uses `coord` (scrambled positions)
- Right half (569-1138px): Uses `preCoord` (unscrambled/preview)

**Theory 2: Different purposes**
- `coord`: Hit detection (where user clicks)
- `preCoord`: Image crop position (where to show from sprite)

**Theory 3: Dynamic positioning**
- `coord`: Relative to visible keypad (569×278)
- `preCoord`: Absolute position on full sprite (1138×834)

**Need to test:** Examine actual HTML/CSS to see how browser renders the keypad

---

## 🚀 Exploitation Strategy

### Current Approach: User-Assisted Mapping

**Step 1: Capture keypad layout**
```bash
node visualize-keypad-mapping.js
```
- Gets layout JSON
- Downloads keypad image
- Creates annotated image (once coord issue fixed)

**Step 2: Manual character identification**
```
User looks at keypad image
Identifies: Box at (x,y) with hash "4d567a87..." = "a"
Builds mapping: {"a": "4d567a87...", "b": "361f8aba...", ...}
```

**Step 3: Automated clicking**
```javascript
// For password "test123"
for (char of "test123") {
  const button = mapping[char];
  await page.click(`coordinates: ${button.coord.x1}, ${button.coord.y1}`);
}
```

**Step 4: Submit form**
```javascript
// __KH_ field now contains concatenated hashes
// Submit login form
// Bypasses HID detection!
```

---

### Future Approach: Fully Automated

**With OCR:**
1. Capture keypad image
2. OCR to read all button labels
3. Automatically build char → hash mapping
4. No manual intervention needed

**With Pattern Recognition:**
1. Analyze multiple sessions
2. Find patterns in scrambling algorithm
3. Predict button positions without layout response
4. Pre-compute mappings

---

## 📁 Key Files

**Data Files:**
- `keypad-button-data.json` → Captured layout with all button data
- `keypad-image.png` → Downloaded sprite sheet
- `keypad-annotated.png` → Annotated with bounding boxes (needs fixing)
- `learned-keypad-mapping.json` → User click test results
- `virtual-keypad-fields.json` → Field discovery test results

**Scripts:**
- `visualize-keypad-mapping.js` → Capture & visualize keypad
- `learn-keypad-mapping.js` → User-assisted character learning
- `analyze-keypad-structure.js` → Parse layout structure
- `find-virtual-keypad-fields.js` → Discover which fields update

---

## 🎓 Conclusion

The virtual keypad system is a sophisticated anti-keylogging mechanism that:

✅ **Successfully prevents:**
- Hardware keyloggers
- Keyboard input automation
- Simple replay attacks

⚠️ **Potentially vulnerable to:**
- User-assisted mapping (manual character identification)
- OCR-based character recognition
- Browser automation with learned mappings
- Direct hash injection into __KH_ fields

❓ **Still investigating:**
- Coordinate system (coord vs preCoord)
- 96-character hash generation
- Sprite sheet rendering logic
- Whether hash injection works without actual clicks

---

*Last Updated: 2026-01-29*
*Analysis based on network traffic capture and UI inspection*
