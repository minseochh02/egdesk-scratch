## Business Identity → SNS Automation Overview

1. **Establish Business Identity**
   - Input: flagship URL, manual copy, or uploaded brief.
   - Output: structured JSON (source + identity attributes + recommended actions).
   - Storage: persist latest identity snapshot per workspace/brand, including metadata (timestamp, URL, AI model, raw response).

2. **Generate SNS Marketing Plan**
   - Inputs: identity snapshot, campaign goals, selected channels.
   - Flow:
     - AI performs supporting research (web search, competitor scans) similar to blog generation.
     - Draft recurring cadences (e.g., Instagram carousel Wednesdays, Twitter tips Thursdays) plus one-off campaigns.
     - Attach creative direction (storyboard, caption tone, asset needs) per task.
   - Storage: plan entries saved in SQLite (mirroring `scheduled_posts` but extended with channel/type/asset requirements).

3. **Connect SNS Accounts**
   - For each platform (Instagram, Twitter/X, LinkedIn, etc.) store authentication context (Playwright profile path or API tokens).
   - Provide validation UI similar to EG Blog connection settings (status check, last refreshed).

4. **Scheduling & Execution**
   - Reuse scheduler service:
     - queue tasks from SNS plan table.
     - For each run: fetch identity + plan entry + channel credentials.
     - Generation pipeline:
       1. Topic/context assembly (AI research / identity cues).
       2. Content + media generation (images/video prompts).
       3. Channel-specific formatter (caption length, hashtags, asset aspect ratio).
     - Execution via platform-specific automation (Playwright flows or API).
   - Update run stats, store published URLs, and surface history in UI.

5. **UI Surfaces**
   - Business Identity tab:
     - Stepper: Identity → SNS Plan → Account Linking.
     - Visual planner (cards/timeline) for upcoming SNS tasks.
     - Manual “Run now” + edit tools per task.

6. **Next Steps**
   - Define SQLite schema for identity snapshots & SNS plans.
   - Extend scheduler executor with SNS channel handlers.
   - Build account linking + validation flows.
   - Integrate new UI components (identity status, plan editor, account manager, execution history).

