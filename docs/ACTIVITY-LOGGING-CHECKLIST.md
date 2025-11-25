# Activity Logging Implementation Checklist

This checklist tracks all areas of the EGDesk application that need activity logging for customer support and debugging purposes.

## ✅ Completed

### Core Infrastructure
- [x] Activity database schema (`activity.db`)
- [x] Activity manager (`SQLiteActivityManager`)
- [x] IPC handlers for activity logging
- [x] Log viewer in Support modal
- [x] Helper function pattern for logging

### EGBlogging Component
- [x] Component mount/initialization
- [x] Loading connections (WordPress, Naver, Tistory)
- [x] Viewing connections
- [x] Navigation between views
- [x] Testing connections
- [x] Editing/deleting connections
- [x] Dashboard refresh
- [x] Error handling for connection operations

## 🔲 Pending Implementation

### Scheduled Posts (High Priority)
- [ ] **ScheduledPostsTab.tsx** - Create scheduled post
  - [ ] Log when user creates a new scheduled post
  - [ ] Include: title, connection, topics, schedule time, frequency
  
- [ ] **ScheduledPostsTab.tsx** - Update scheduled post
  - [ ] Log when user edits/updates a scheduled post
  - [ ] Include: post ID, what changed (before/after)
  
- [ ] **ScheduledPostsTab.tsx** - Delete scheduled post
  - [ ] Log when user deletes a scheduled post
  - [ ] Include: post ID, title, connection
  
- [ ] **ScheduledPostsTab.tsx** - Toggle enable/disable
  - [ ] Log when user enables/disables a scheduled post
  - [ ] Include: post ID, new status
  
- [ ] **ScheduledPostsTab.tsx** - Run now (manual execution)
  - [ ] Log when user manually triggers execution
  - [ ] Include: post ID, title, connection, topics
  
- [ ] **scheduled-posts-executor.ts** - Automatic execution
  - [ ] Log when scheduled post starts executing
  - [ ] Log execution success/failure
  - [ ] Include: post ID, execution time, blog post URL (if successful), error details (if failed)
  
- [ ] **scheduled-posts-executor.ts** - Blog generation
  - [ ] Log blog content generation start/end
  - [ ] Include: word count, image count, topics used
  
- [ ] **scheduled-posts-executor.ts** - Blog upload
  - [ ] Log upload attempts
  - [ ] Include: connection type, success/failure, post URL

### Blog Connections (Medium Priority)
- [ ] **BlogConnector.tsx** - Create new connection
  - [ ] Log when user creates WordPress/Naver/Tistory connection
  - [ ] Include: connection type, name, URL (no passwords!)
  
- [ ] **BlogConnector.tsx** - Edit connection
  - [ ] Log connection updates
  - [ ] Include: connection ID, what changed
  
- [ ] **BlogConnector.tsx** - Delete connection
  - [ ] Log connection deletion
  - [ ] Include: connection ID, type, name
  
- [ ] **BlogConnector.tsx** - Test connection
  - [ ] Log connection test attempts
  - [ ] Include: connection ID, success/failure, error message

### Posts Management (Medium Priority)
- [ ] **PostsTab.tsx** - View posts
  - [ ] Log when user views posts list
  - [ ] Include: connection ID, filter/search terms
  
- [ ] **PostsTab.tsx** - Sync posts
  - [ ] Log when user triggers post sync
  - [ ] Include: connection ID, sync result (count of posts synced)
  
- [ ] **PostsTab.tsx** - Export posts
  - [ ] Log when user exports posts
  - [ ] Include: connection ID, export format, file path

### Media Management (Low Priority)
- [ ] **MediaTab.tsx** - View media
  - [ ] Log when user views media library
  - [ ] Include: connection ID
  
- [ ] **MediaTab.tsx** - Upload media
  - [ ] Log media uploads
  - [ ] Include: connection ID, file name, success/failure
  
- [ ] **MediaTab.tsx** - Delete media
  - [ ] Log media deletions
  - [ ] Include: connection ID, media ID

### Comments Management (Low Priority)
- [ ] **CommentsTab.tsx** - View comments
  - [ ] Log when user views comments
  - [ ] Include: connection ID, post ID (if filtered)
  
- [ ] **CommentsTab.tsx** - Approve/reject comments
  - [ ] Log comment status changes
  - [ ] Include: connection ID, comment ID, new status
  
- [ ] **CommentsTab.tsx** - Delete comments
  - [ ] Log comment deletions
  - [ ] Include: connection ID, comment ID

### Business Identity (High Priority)
- [ ] **BusinessIdentityTab.tsx** - Create snapshot
  - [ ] Log when user creates business identity snapshot
  - [ ] Include: brand key, URL
  
- [ ] **BusinessIdentityTab.tsx** - Run analysis
  - [ ] Log SEO/SSL analysis runs
  - [ ] Include: snapshot ID, analysis type, success/failure
  
- [ ] **BusinessIdentityTab.tsx** - Create SNS plan
  - [ ] Log when user creates SNS posting plan
  - [ ] Include: snapshot ID, plan details
  
- [ ] **BusinessIdentityTab.tsx** - Activate/deactivate plan
  - [ ] Log plan activation changes
  - [ ] Include: plan ID, new status

### Social Media (Medium Priority)
- [ ] **EGSocialMedia.tsx** - Create connection
  - [ ] Log social media connection creation
  - [ ] Include: platform type, connection name
  
- [ ] **EGSocialMedia.tsx** - Post to social media
  - [ ] Log social media posts
  - [ ] Include: platform, connection ID, success/failure
  
- [ ] **EGSocialMedia.tsx** - Schedule social media post
  - [ ] Log social media scheduling
  - [ ] Include: platform, scheduled time

### AI Operations (High Priority)
- [ ] **AI Blog Generation** - Generate blog content
  - [ ] Log when AI generates blog content
  - [ ] Include: AI key used, topics, word count, success/failure
  
- [ ] **AI Image Generation** - Generate images
  - [ ] Log image generation attempts
  - [ ] Include: prompt, success/failure, image count
  
- [ ] **AI Code Generation** - Generate code
  - [ ] Log code generation requests
  - [ ] Include: prompt, language, success/failure

### Authentication & User Management (Medium Priority)
- [ ] **SignInPage.tsx** - User login
  - [ ] Log login attempts
  - [ ] Include: success/failure (no passwords!)
  
- [ ] **SignInPage.tsx** - User logout
  - [ ] Log logout events
  
- [ ] **UserProfile.tsx** - Update profile
  - [ ] Log profile updates
  - [ ] Include: what changed (no sensitive data)

### Settings & Configuration (Low Priority)
- [ ] **SettingsTab.tsx** - Update settings
  - [ ] Log setting changes
  - [ ] Include: setting category, what changed
  
- [ ] **AIKeysManager.tsx** - Add/update AI key
  - [ ] Log AI key operations
  - [ ] Include: key name, provider (no actual keys!)
  
- [ ] **AIKeysManager.tsx** - Delete AI key
  - [ ] Log AI key deletion
  - [ ] Include: key name

### Error Handling (High Priority)
- [ ] **ErrorBoundary.tsx** - React errors
  - [ ] Log React component errors
  - [ ] Include: component name, error message, stack trace
  
- [ ] **Global error handlers** - Unhandled errors
  - [ ] Log unhandled promise rejections
  - [ ] Log window errors
  - [ ] Include: error message, stack trace, context

## 📝 Implementation Notes

### Best Practices
1. **Never log sensitive data**: passwords, API keys, tokens, full file contents
2. **Use consistent action names**: `create_scheduled_post`, `update_scheduled_post`, etc.
3. **Include context**: connection IDs, post IDs, user actions
4. **Log both success and failure**: helps identify patterns
5. **Use appropriate types**: `user`, `system`, `error`, `audit`

### Helper Function Pattern
```typescript
const logActivity = async (
  type: string,
  action: string,
  status: 'success' | 'failure' | 'pending' | 'info',
  options?: {
    target?: string;
    details?: any;
    errorMessage?: string;
  }
): Promise<void> => {
  try {
    if (window.electron?.invoke) {
      await window.electron.invoke('sqlite-activity-create', {
        type,
        action,
        status,
        target: options?.target,
        details: options?.details,
        errorMessage: options?.errorMessage,
      });
    }
  } catch (error) {
    console.warn('Failed to log activity:', error);
  }
};
```

### Priority Levels
- **High Priority**: Scheduled posts, Business Identity, AI operations, Error handling
- **Medium Priority**: Blog connections, Social media, Authentication
- **Low Priority**: Media, Comments, Settings

## 🎯 Next Steps

1. Start with **Scheduled Posts** (highest impact for customer support)
2. Add logging to **scheduled-posts-executor.ts** for execution tracking
3. Add logging to **ScheduledPostsTab.tsx** for user actions
4. Move to **Business Identity** operations
5. Add **Error handling** logging globally

