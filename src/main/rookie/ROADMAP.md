# Rookie Development Roadmap

## Current Status: System Design & Architecture Phase

**Last Updated:** 2024-02-04

We're currently in the planning phase, designing the system architecture and flow. No implementation yet - we're taking time to think through the design properly.

---

## What We've Completed So Far

### ✅ Phase 0: UI Foundation
**Status:** Complete

**Files Created:**
- `src/renderer/components/Rookie/RookiePage.tsx` - Main Rookie page with workflow list
- `src/renderer/components/Rookie/RookiePage.css` - Styling
- `src/renderer/components/Rookie/Analysis.tsx` - Workflow creation page (UI only)
- `src/renderer/components/Rookie/Analysis.css` - Styling

**Features Implemented:**
- ✅ Full-page Analysis component (not modal)
- ✅ File upload section with drag & drop
- ✅ Resource library with two-column selection (Available | Selected)
- ✅ Mock data for UI testing
- ✅ Smooth scroll logic and auto-scroll to next step
- ✅ Green-themed styling matching the app
- ✅ View-based navigation (list view ↔ analysis view)

**What Works:**
- User can click "Create New Rook" → opens Analysis page
- User can upload Excel/PDF files (mock)
- User can select resources from mock list
- User can navigate back to list view
- All UI interactions are smooth and polished

**What's NOT Implemented Yet:**
- ❌ No database integration
- ❌ No actual file processing
- ❌ No desktop recording
- ❌ No workflow execution
- ❌ "Start Recording" button just shows alert

---

## Research & Architecture Documents Created

### 📄 Architecture Documents

1. **`ARCHITECTURE.md`**
   - Database schema design (complete SQL)
   - Tables: rooks, rook_sessions, rook_session_logs, rook_schedules
   - Implementation phases (1-4)
   - Comparison with OpenClaw patterns

2. **`OPENCLAW_ANALYSIS.md`**
   - Deep dive into OpenClaw's agent management
   - How they use sub-agents instead of task lists
   - Memory system (MEMORY.md files)
   - System prompt structure
   - What we can apply to Rookie

3. **`OPENCLAW_TOOL_SYSTEM.md`**
   - How OpenClaw tells AI which tools it has
   - 7-layer policy filtering system
   - Tool groups and profiles
   - Configuration examples
   - What Rookie can learn from this

---

## Current Phase: System Flow Design

**Status:** 🚧 In Progress - Design & Planning

We need to think through the complete system flow before implementing anything. This is the critical design phase.

### Key Questions to Answer

#### 1. Recording System
- [ ] How do we capture screen recordings?
  - Built-in desktop recorder vs library
  - Video format (MP4, WebM?)
  - Screen region selection (full screen, window, custom area)
  - Mouse tracking (coordinates, clicks, movements)
  - Keyboard tracking (what was typed, where)

- [ ] What format should `.rook` files be?
  - JSON with embedded screenshots?
  - Binary format with metadata?
  - Separate video + JSON manifest?

- [ ] How granular should step recording be?
  - Every mouse move? (huge file size)
  - Just actions (click, type, navigate)?
  - Keyframes with interpolation?

#### 2. Playback/Execution System
- [ ] How do we replay recorded workflows?
  - Pixel-perfect coordinate replay? (breaks if UI changes)
  - Element-based selectors? (more robust but requires AI/CV)
  - Hybrid approach?

- [ ] Error handling during playback
  - What if a button moved?
  - What if website structure changed?
  - Retry logic? Human intervention?

- [ ] Speed/timing
  - Play at recorded speed?
  - Adjustable speed (faster for efficiency)?
  - Smart waiting (wait for elements to load)?

#### 3. Resource Management
- [ ] Credentials storage
  - How do we securely store bank/website credentials?
  - Encryption method (OS keychain, custom encryption)?
  - Per-rook credentials vs global?

- [ ] Resource detection
  - Auto-detect which websites/apps were used?
  - Manual resource tagging?
  - Resource versioning (if website changes)?

#### 4. AI Integration (Future)
- [ ] Do we use AI at all?
  - For error recovery? (if button moved, use AI to find it)
  - For workflow generation? (describe task → AI generates steps)
  - For optimization? (AI suggests better workflows)

- [ ] If yes, which AI?
  - Local models (privacy, cost)
  - Cloud APIs (Anthropic, OpenAI)
  - Hybrid approach

#### 5. Scheduling System
- [ ] How does scheduling work?
  - Cron-like expressions? (technical users)
  - Visual scheduler? (calendar UI)
  - Triggered events? (file appears, email received)

- [ ] Execution context
  - User must be logged in? (for desktop automation)
  - Background execution possible?
  - Headless mode?

#### 6. Data Flow
```
User uploads goal file (Excel/PDF)
    ↓
User selects resources (websites/apps)
    ↓
User clicks "Start Recording"
    ↓
??? What happens here ???
    ↓
Recording is saved as .rook file
    ↓
User can replay the workflow
    ↓
Output file is generated
```

**Current Gap:** We haven't defined the middle steps!

---

## Proposed System Flow (Draft - Needs Discussion)

### Option A: Pure Recording/Playback (No AI)

```
1. User Setup
   ├─ Upload goal file (template Excel/PDF)
   ├─ Select resources (websites, apps)
   └─ Name the workflow

2. Recording Phase
   ├─ User clicks "Start Recording"
   ├─ Desktop recorder launches
   ├─ User performs task manually
   │   ├─ Opens websites
   │   ├─ Logs in
   │   ├─ Navigates, clicks, types
   │   ├─ Downloads data
   │   ├─ Opens Excel, processes data
   │   └─ Saves output
   ├─ User clicks "Stop Recording"
   └─ Recording saved as .rook file
       ├─ Video of screen
       ├─ JSON manifest with steps
       │   └─ Each step: { action, timestamp, coordinates, screenshot }
       └─ Metadata (duration, resources used)

3. Playback Phase
   ├─ User clicks "Run Workflow"
   ├─ Desktop automation engine starts
   ├─ Reads .rook file
   ├─ Replays each step
   │   ├─ Opens same apps/websites
   │   ├─ Clicks at recorded coordinates
   │   ├─ Types recorded text
   │   ├─ Waits for elements
   │   └─ Handles errors (retry, skip, alert user)
   ├─ Generates output file
   └─ Session logged to database
```

**Pros:**
- Simple, no AI needed
- Clear recording/playback model
- User has full control

**Cons:**
- Brittle (breaks if UI changes)
- Requires exact screen resolution
- No intelligence/adaptation

---

### Option B: Hybrid (Recording + AI-Assisted Playback)

```
1. Recording Phase (same as Option A)
   ├─ User performs task
   └─ Saves .rook file with screenshots at each step

2. Analysis Phase (NEW)
   ├─ AI analyzes the .rook file
   ├─ Generates semantic step descriptions
   │   └─ "Click login button" (not "Click at 450, 320")
   ├─ Identifies UI elements
   │   └─ "Username field", "Submit button", etc.
   └─ Creates robust workflow definition

3. Playback Phase
   ├─ Desktop automation uses semantic steps
   ├─ If UI changed, AI finds the element
   │   └─ Uses screenshot matching or element detection
   ├─ Handles variations gracefully
   └─ Only alerts user if critical failure
```

**Pros:**
- More robust to UI changes
- Intelligent error recovery
- Can adapt to variations

**Cons:**
- Complex implementation
- Requires AI integration (cost, latency)
- Harder to debug

---

### Option C: Template-Based (No Recording)

```
1. Template Phase
   ├─ User describes workflow in UI
   ├─ Selects actions from dropdown
   │   ├─ "Navigate to URL"
   │   ├─ "Click element with text 'Login'"
   │   ├─ "Type into field 'username'"
   │   └─ "Download file"
   └─ Builds workflow JSON manually

2. Execution Phase
   ├─ Desktop automation executes steps
   └─ No recording needed
```

**Pros:**
- No recording overhead
- Portable/versionable (JSON)
- Easier to edit workflows

**Cons:**
- Steep learning curve
- Time-consuming to create
- Less intuitive for non-technical users

---

## Next Steps (To Decide Together)

### Immediate Decisions Needed

1. **Which approach do we want?**
   - [ ] Option A: Pure Recording/Playback
   - [ ] Option B: Recording + AI
   - [ ] Option C: Template-Based
   - [ ] Hybrid of A + C (record first, can edit later)

2. **Desktop automation library?**
   - [ ] Research: Puppeteer (web only)
   - [ ] Research: Playwright (web + desktop)
   - [ ] Research: RobotJS (coordinates-based)
   - [ ] Research: NUT.js (cross-platform automation)
   - [ ] Build custom solution

3. **Recording library?**
   - [ ] Research: Electron's desktopCapturer API
   - [ ] Research: RecordRTC
   - [ ] Research: MediaRecorder API
   - [ ] Build custom solution

4. **Database implementation?**
   - [ ] Use proposed schema as-is
   - [ ] Modify based on chosen approach
   - [ ] Start with simple version (minimal tables)

---

## Future Phases (Not Started)

### Phase 1: Core Data Models
- [ ] Create Supabase migrations
- [ ] Add TypeScript types matching schema
- [ ] Create CRUD operations for rooks
- [ ] IPC handlers for frontend ↔ backend

### Phase 2: Recording Integration
- [ ] Desktop recorder implementation
- [ ] Screen capture + mouse tracking
- [ ] Save recordings to `.rook` files
- [ ] Associate recordings with rook_sessions
- [ ] Screenshot capture at each step

### Phase 3: Playback Engine
- [ ] Parse `.rook` recording files
- [ ] Desktop automation manager
- [ ] Step-by-step execution with error handling
- [ ] Real-time progress updates to UI
- [ ] Session logging to database

### Phase 4: Scheduler & Monitoring
- [ ] Cron-based scheduler implementation
- [ ] Session monitoring dashboard
- [ ] Error reporting & retry logic
- [ ] Success/failure notifications
- [ ] Analytics and insights

### Phase 5: Advanced Features (Future)
- [ ] AI-assisted error recovery
- [ ] Workflow editing UI
- [ ] Multi-step workflows (sub-workflows)
- [ ] Credential management (secure storage)
- [ ] Cloud sync (optional)
- [ ] Workflow marketplace (share workflows)

---

## Technical Debt & Notes

### Known Issues
- Analysis.tsx has minor lint warnings (alerts for unimplemented features)
- No error boundaries in React components yet
- Need to add loading states for async operations

### Design Decisions to Document
- Why green theme? (matches existing app)
- Why full page instead of modal? (better UX for complex forms)
- Why mock data? (UI testing without backend)

### Open Questions
1. Should workflows be sharable between users?
2. Do we need workflow versioning (v1, v2, etc.)?
3. Should we support workflow templates/marketplace?
4. Multi-user support? (team plans, permissions)
5. Cloud vs local-only storage?

---

## Resources & References

### OpenClaw Learnings
- Session-based execution (running → completed/failed)
- Metadata tracking (duration, errors, usage)
- Sub-agent pattern for complex tasks
- System prompt sections (compact, clear)
- Tool policy system (7-layer filtering)

### Libraries to Research
- **Desktop Automation:**
  - NUT.js - https://nutjs.dev/
  - RobotJS - http://robotjs.io/
  - Playwright - https://playwright.dev/

- **Screen Recording:**
  - Electron desktopCapturer - https://www.electronjs.org/docs/latest/api/desktop-capturer
  - RecordRTC - https://recordrtc.org/
  - MediaRecorder - https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder

- **Computer Vision (if needed):**
  - OpenCV.js - https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html
  - Tesseract.js (OCR) - https://tesseract.projectnaptha.com/

---

## Team Notes

**For Future Me/Contributors:**

- Take your time on system design - this is the foundation
- Don't rush to implementation until we're confident in the approach
- Test each component in isolation before integration
- Keep UI and backend concerns separated
- Document design decisions as we make them
- Ask questions when uncertain - better to clarify now than refactor later

**Current Focus:**
We're in the "think deeply, move slowly" phase. The UI is done (looks great!), but we need to nail down the system flow before writing any backend code.

**Philosophy:**
Rookie should be:
- **Simple** - Easy for non-technical users
- **Reliable** - Workflows should "just work"
- **Secure** - Credentials must be protected
- **Fast** - Execution should be quick
- **Debuggable** - Users should understand what went wrong

---

## Contact & Collaboration

This is a living document. Update it as we make decisions and progress through implementation.

**Next Meeting Topics:**
1. Choose system approach (A, B, C, or hybrid)
2. Discuss desktop automation library options
3. Review database schema one more time
4. Plan Phase 1 implementation sprint

---

**Remember:** We're building this right, not fast. Take time to think through each decision.
