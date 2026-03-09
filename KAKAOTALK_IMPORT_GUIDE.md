# KakaoTalk Chat Data Import Guide

## ✅ Completed Steps

1. **CSV Parsing** - Parsed 905 chat messages from `KakaoTalk_Chat_EGdesk-PM_2026-03-08-18-20-48.csv`
2. **SQL Generation** - Created `kakaotalk-import.sql` with table schema and INSERT statements

## 📋 Data Summary

- **Total Messages**: 905
- **Date Range**: 2025-06-21 to 2026-03-07
- **Table Name**: `kakaotalk_egdesk_pm`
- **Display Name**: "KakaoTalk - EGdesk PM Team Chat"
- **Columns**:
  - `chat_date` (TEXT) - Message timestamp
  - `user_name` (TEXT) - Sender name
  - `message` (TEXT) - Message content (Korean/English, multiline supported)

## 🚀 Next Steps: Import SQL into EGDesk App

### Step 1: Start the EGDesk App

```bash
npm run start
```

Wait for the app to launch and fully load.

### Step 2: Navigate to User Data Page

1. In the EGDesk app, find and click on **"User Data"** in the navigation menu
2. You should see the User Data management interface

### Step 3: Import the SQL File

**Option A: Using the UI (Recommended)**

1. Look for an **"Import SQL"** button in the User Data page
2. Click the button
3. Select the file: `kakaotalk-import.sql` (located in the project root)
4. Wait for the import to complete
5. You should see a success message with import statistics

**Option B: Using Developer Tools (Alternative)**

If there's no Import SQL button in the UI:

1. Open Developer Tools in the app (usually `Cmd+Option+I` on macOS)
2. Go to the Console tab
3. Run this command:

```javascript
// Import SQL file using IPC
require('electron').ipcRenderer.invoke('user-data:import-sql')
  .then(result => {
    console.log('Import result:', result);
    if (result.success) {
      alert(`Import successful!
Tables registered: ${result.data.tablesRegistered}
Statements executed: ${result.data.statementsExecuted}
Errors: ${result.data.errorCount}`);
    } else {
      alert('Import failed: ' + result.error);
    }
  });
```

4. A file picker dialog will appear - select `kakaotalk-import.sql`
5. Check the console for import results

### Step 4: Verify the Import

After import completes, you should see:

1. **New table in the list**: "KakaoTalk - EGdesk PM Team Chat"
2. **Table metadata**:
   - Table name: `kakaotalk_egdesk_pm`
   - Row count: ~905 rows
   - Columns: 3 (chat_date, user_name, message)

Click on the table to view the data and verify messages are displayed correctly.

## 🔍 Step 5: Create Embeddings for Semantic Search

### 5.1 Start Embedding Process

1. In the table view, find the **"Embed Table"** button
2. Click it to open the embedding configuration dialog
3. Select the column to embed: **`message`**
   - This is the main content column for semantic search
4. Review the cost estimate:
   - ~905 rows × 1 column × avg 100 chars/message
   - Estimated cost: ~$0.001 USD (very low cost)
5. Click **"Start Embedding"**

### 5.2 Monitor Progress

- Watch the progress bar as embeddings are generated
- Expected time: ~1-2 minutes for 905 messages
- Progress updates will show:
  - Current batch being processed
  - Percentage complete
  - ETA

### 5.3 Verify Embeddings

After completion, check the **Stats Panel**:

- ✅ Total embeddings: 905
- ✅ Embedded columns: message
- ✅ Model: text-embedding-004
- ✅ Dimensions: 768
- ✅ Cost: ~$0.001 USD

## 🧪 Step 6: Test Semantic Search

Now test the semantic search feature with Korean queries!

### Test Case 1: Meeting Coordination (Korean)

**Query**: `회의 일정`
- **Translation**: "meeting schedule"
- **Expected**: Should find messages about meeting dates, times, and locations
- **Search mode**: Semantic
- **Threshold**: 0.7

**Sample expected results**:
- "토요일날 뵙겠습니다" (See you on Saturday)
- "오늘 1020쯤 도착할듯 합니다" (Will arrive around 10:20 today)
- Date/time coordination messages

### Test Case 2: Coffee Orders

**Query**: `커피`
- **Translation**: "coffee"
- **Expected**: Should find coffee-related messages
- **Threshold**: 0.7

**Sample expected results**:
- "커피 사가지고 올라갑니다" (I'll bring coffee)
- "커피 주문 받습니다" (Taking coffee orders)

### Test Case 3: Technical Questions

**Query**: `웹 개발 질문`
- **Translation**: "web development questions"
- **Expected**: Should find technical discussions
- **Threshold**: 0.7

**Sample expected results**:
- Messages with code snippets
- Technical questions about web development
- Programming-related discussions

### Test Case 4: Greetings

**Query**: `인사`
- **Translation**: "greetings"
- **Expected**: Should find hello/goodbye messages
- **Threshold**: 0.7

**Sample expected results**:
- "안녕하세요" (Hello)
- Greeting messages

### Test Case 5: Late/Tardiness Notifications

**Query**: `늦을 것 같습니다`
- **Translation**: "running late"
- **Expected**: Should find tardiness notifications
- **Threshold**: 0.7

**Sample expected results**:
- "10분 15분이면 도착합니다" (Will arrive in 10-15 minutes)
- Late arrival notifications

### Threshold Testing

Try the same query with different thresholds to see the difference:

- **0.85 (strict)**: Only very close semantic matches
- **0.7 (balanced)**: Good balance of precision and recall
- **0.6 (loose)**: More results, some may be less relevant

### Compare Keyword vs Semantic Search

1. Switch to **Keyword** search mode
2. Try query: `설 명절` (Lunar New Year holiday)
3. **Keyword results**: Only exact matches of "설 명절"
4. Switch to **Semantic** search mode
5. **Semantic results**: Should also find:
   - Holiday greetings
   - Vacation messages
   - Related seasonal content

This demonstrates the power of semantic search for understanding context and intent!

## 📊 Expected Results Summary

### Data Verification
- ✅ Table created with 905 rows
- ✅ All 3 columns present (chat_date, user_name, message)
- ✅ Korean text displays correctly
- ✅ Multiline messages preserved

### Embedding Verification
- ✅ 905 embeddings created for `message` column
- ✅ Stats panel shows correct counts
- ✅ Model: text-embedding-004 (Gemini)
- ✅ Dimensions: 768
- ✅ Total cost: < $0.01 USD

### Semantic Search Verification
- ✅ Korean queries work correctly
- ✅ Topic-based search works (finds related concepts)
- ✅ Intent-based search works (understands user intent)
- ✅ Similarity scores in expected range (0.65-0.90)
- ✅ Threshold slider affects results
- ✅ Keyword vs Semantic toggle shows clear difference

## 🎯 Success Criteria

All of the following should be true:

1. ✅ Table imported successfully (905 rows)
2. ✅ Korean text displays correctly in table view
3. ✅ Embeddings complete without errors
4. ✅ Stats panel shows 905 embeddings
5. ✅ Semantic search returns relevant results
6. ✅ Korean queries find semantically similar messages
7. ✅ Topic queries work ("회의" finds meetings)
8. ✅ Intent queries work ("늦을 것" finds tardiness)
9. ✅ Threshold changes affect result count
10. ✅ Semantic mode finds more than keyword mode

## 🐛 Troubleshooting

### Import Fails

**Error**: "Table already exists"
- **Solution**: Delete the existing table first or use a different table name

**Error**: "SQL syntax error"
- **Solution**: Check the `kakaotalk-import.sql` file for any malformed SQL

### Embedding Fails

**Error**: "API key not found"
- **Solution**: Configure Gemini API key in app settings

**Error**: "Rate limit exceeded"
- **Solution**: Wait a few minutes and try again with smaller batch size

### Search Returns No Results

**Issue**: Semantic search returns 0 results
- **Solution**: Lower the threshold (try 0.6 or 0.5)
- **Check**: Verify embeddings were created (check stats panel)

### Korean Text Not Displaying

**Issue**: Korean characters show as boxes or ���
- **Solution**: Check database encoding is UTF-8
- **Verify**: CSV was parsed with correct encoding

## 📝 Files Generated

1. ✅ `kakaotalk-parsed.json` - Parsed chat messages (905 entries)
2. ✅ `kakaotalk-import.sql` - SQL import file (225 KB, 906 statements)
3. ✅ `import-kakaotalk.js` - CSV parser script
4. ✅ `generate-kakaotalk-sql.js` - SQL generator script

## 🧹 Cleanup (Optional)

After successful testing, you can:

1. Delete embeddings only: Stats panel → "Delete Embeddings"
2. Delete entire table: User Data page → Select table → "Delete Table"
3. Re-import anytime: Use the SQL file generated

## 📚 Additional Test Queries

Here are more Korean queries to test:

- `프로젝트 진행` (project progress)
- `질문` (question)
- `도움` (help)
- `감사` (thanks)
- `확인` (confirm)
- `수정` (fix/modify)
- `문제` (problem)
- `테스트` (test)

Try both exact queries and paraphrased versions to see how semantic search handles variations!
