# AI Event Types Analysis

## Overview
This document analyzes the event handling system in the EGDesk AI Chat component, identifying all event types and their handling patterns.

## Event Types Defined in AI Types

### 1. AIEventType Enum (from `ai-types.ts`)
```typescript
export enum AIEventType {
  Content = 'content',                    // AI response content
  ToolCallRequest = 'tool_call_request',  // Tool execution request
  ToolCallResponse = 'tool_call_response', // Tool execution response
  ToolCallConfirmation = 'tool_call_confirmation', // Tool confirmation (unused)
  Thought = 'thought',                    // AI internal thoughts
  Error = 'error',                       // Error events
  Finished = 'finished',                 // Conversation completion
  UserCancelled = 'user_cancelled',      // User cancellation
  LoopDetected = 'loop_detected',        // Infinite loop detection
  TurnStarted = 'turn_started',          // New conversation turn
  TurnCompleted = 'turn_completed'       // Turn completion
}
```

## Events Actually Emitted by Autonomous Client

### 1. Content Events
- **Type**: `AIEventType.Content`
- **Purpose**: Stream AI response text content
- **Emission**: In `streamTextContent()` method
- **Structure**: 
  ```typescript
  {
    type: AIEventType.Content,
    content: string,  // Chunk of text
    timestamp: Date
  }
  ```

### 2. Tool Call Request Events
- **Type**: `AIEventType.ToolCallRequest`
- **Purpose**: Notify when AI wants to execute a tool
- **Emission**: In `conversationLoop()` when `part.functionCall` is detected
- **Structure**:
  ```typescript
  {
    type: AIEventType.ToolCallRequest,
    toolCall: ToolCallRequestInfo,
    timestamp: Date
  }
  ```

### 3. Tool Call Response Events
- **Type**: `AIEventType.ToolCallResponse`
- **Purpose**: Notify when tool execution completes
- **Emission**: In `conversationLoop()` after tool execution
- **Structure**:
  ```typescript
  {
    type: AIEventType.ToolCallResponse,
    response: ToolCallResponseInfo,
    timestamp: Date
  }
  ```

### 4. Turn Events
- **TurnStarted**: `AIEventType.TurnStarted`
  - **Purpose**: Signal start of new conversation turn
  - **Emission**: At beginning of each turn in conversation loop
  - **Structure**:
    ```typescript
    {
      type: AIEventType.TurnStarted,
      turnNumber: number,
      timestamp: Date
    }
    ```

- **TurnCompleted**: `AIEventType.TurnCompleted`
  - **Purpose**: Signal completion of conversation turn
  - **Emission**: At end of each turn in conversation loop
  - **Structure**:
    ```typescript
    {
      type: AIEventType.TurnCompleted,
      turnNumber: number,
      timestamp: Date
    }
    ```

### 5. Error Events
- **Type**: `AIEventType.Error`
- **Purpose**: Report errors during conversation
- **Emission**: In multiple places when errors occur
- **Structure**:
  ```typescript
  {
    type: AIEventType.Error,
    error: {
      message: string,
      recoverable: boolean
    },
    timestamp: Date
  }
  ```

### 6. Loop Detection Events
- **Type**: `AIEventType.LoopDetected`
- **Purpose**: Detect and report infinite loops
- **Emission**: When repetitive patterns are detected
- **Structure**:
  ```typescript
  {
    type: AIEventType.LoopDetected,
    pattern: string,
    timestamp: Date
  }
  ```

### 7. Finished Events
- **Type**: `AIEventType.Finished`
- **Purpose**: Signal conversation completion
- **Emission**: At end of conversation loop
- **Structure**:
  ```typescript
  {
    type: AIEventType.Finished,
    reason: 'tool_calls_complete' | 'max_turns' | 'user_cancelled' | 'timeout',
    timestamp: Date
  }
  ```

### 8. User Cancelled Events
- **Type**: `AIEventType.UserCancelled`
- **Purpose**: Signal user cancellation
- **Emission**: When abort controller is triggered
- **Structure**:
  ```typescript
  {
    type: AIEventType.UserCancelled,
    timestamp: Date
  }
  ```

## Events NOT Currently Emitted

### 1. Thought Events
- **Type**: `AIEventType.Thought`
- **Status**: Defined but not implemented in autonomous client
- **Purpose**: Would show AI internal reasoning

### 2. Tool Call Confirmation Events
- **Type**: `AIEventType.ToolCallConfirmation`
- **Status**: Defined but not implemented
- **Purpose**: Would ask user to confirm tool execution

## Event Handling Issues in AIChat.tsx

### 1. Content Event Handling
**Problem**: The content event handling has issues with live typing effect:
- Multiple content events create multiple messages instead of appending to existing one
- The `startLiveTyping` function creates new messages when it should append to existing ones
- Buffer timeout logic may interfere with content streaming

**Current Logic**:
```typescript
case AIEventType.Content:
  const newContent = contentEvent.content || contentEvent.data || '';
  if (newContent) {
    startLiveTyping(newContent);
  }
```

### 2. Unknown Event Handling
**Problem**: The default case tries to handle unknown events as content:
```typescript
default:
  const unknownEvent = event as any;
  if (unknownEvent.content || unknownEvent.data || unknownEvent.text) {
    // Treats as content event
  }
```

### 3. Message Creation Logic
**Problem**: The `shouldCreateNewMessage` logic is complex and may create unnecessary messages:
```typescript
const shouldCreateNewMessage = !isTyping && (
  (lastMessage && lastMessage.toolCallId) ||
  (lastMessage && lastMessage.parts[0]?.text?.startsWith('🔧')) ||
  // ... more conditions
);
```

## Recommended Fixes

### 1. Fix Content Event Handling
- Ensure content events append to existing message instead of creating new ones
- Improve the live typing effect to handle streaming content properly
- Fix buffer timeout logic

### 2. Simplify Message Creation Logic
- Reduce complexity of `shouldCreateNewMessage` logic
- Ensure proper message lifecycle management

### 3. Add Missing Event Handlers
- Implement proper handling for all defined event types
- Add fallback handling for unknown events

### 4. Improve Error Handling
- Better error recovery mechanisms
- More informative error messages

## Event Flow Diagram

```
User Input
    ↓
TurnStarted Event
    ↓
Content Events (streaming)
    ↓
ToolCallRequest Event (if tools needed)
    ↓
ToolCallResponse Event (after execution)
    ↓
TurnCompleted Event
    ↓
Finished Event (if conversation complete)
```

## Debugging Tips

1. **Check console logs**: The autonomous client logs all events with `📤 BufferEvent called:`
2. **Monitor event types**: Look for unexpected event types in the switch statement
3. **Verify content streaming**: Ensure content events are properly accumulated
4. **Check tool execution**: Verify tool call request/response pairs are handled correctly
