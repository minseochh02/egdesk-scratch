# Business Identity SNS Plan → Scheduled Posts Compatibility

## Current State

### AI-Generated SNS Plan Format
```typescript
{
  channel: "WordPress" | "Naver Blog" | "Tistory" | "Instagram" | ...
  title: string
  summary: string
  cadence: {
    type: "daily" | "weekly" | "monthly" | "custom"
    dayOfWeek: number | null
    dayOfMonth: number | null
    customDays: number | null
    time: "HH:mm"
  }
  topics: string[]
  assets: { ... }
}
```

### Scheduler Expected Format
```typescript
{
  connectionId: string        // Required: ID of blog connection
  connectionName: string      // Required: Name of blog connection
  connectionType: "wordpress" | "naver" | "Naver Blog"  // Lowercase or "Naver Blog"
  scheduledTime: "HH:mm"
  frequencyType: "daily" | "weekly" | "monthly" | "custom"
  frequencyValue: number
  weeklyDay?: number
  monthlyDay?: number
  topics: string[]
}
```

## Compatibility Issues

### ❌ NOT Directly Compatible

1. **Channel Name Mismatch**:
   - AI generates: `"WordPress"`, `"Naver Blog"`, `"Tistory"`
   - Scheduler expects: `"wordpress"` (lowercase) or `"naver"`/`"Naver Blog"`

2. **Missing Connection Info**:
   - AI output has no `connectionId` or `connectionName`
   - Scheduler requires these to link to actual blog connections

3. **Cadence vs Frequency**:
   - AI uses: `cadence.type`, `cadence.dayOfWeek`, `cadence.dayOfMonth`, `cadence.customDays`
   - Scheduler uses: `frequencyType`, `frequencyValue`, `weeklyDay`, `monthlyDay`

## Solution: Conversion Utility

Created `snsPlanToScheduledPost.ts` with conversion functions:

1. **`mapChannelToConnectionType()`**: Maps AI channel names to scheduler connection types
   - "WordPress" → "wordpress"
   - "Naver Blog" → "naver"
   - "Tistory" → "tistory"

2. **`mapCadenceToFrequency()`**: Converts cadence format to frequency format

3. **`convertSnsPlanToScheduledPost()`**: Full conversion from SNS plan to scheduled post format
   - Requires matching the channel to an actual blog connection
   - Returns `null` if no matching connection found

4. **`getBlogConnectionsForChannel()`**: Fetches available blog connections for a channel

## Next Steps

To make them fully compatible, we need to:

1. **UI Flow**: When user wants to activate an SNS plan for a blog platform:
   - Show available blog connections for that channel
   - Let user select which connection to use
   - Convert SNS plan to scheduled post using the selected connection

2. **Auto-Matching**: If only one connection exists for a channel, auto-select it

3. **Validation**: Check if channel matches available blog platforms before allowing conversion

