# InviteManager Component

A comprehensive React component for managing email-based permissions and invitations for MCP servers.

## Features

✅ **Add Multiple Emails** - Add permissions for multiple users at once  
✅ **Access Level Control** - Read-only, Read/Write, or Admin access  
✅ **Real-time Status** - See who's active, pending, or revoked  
✅ **Edit Permissions** - Update access levels and notes inline  
✅ **Revoke Access** - Remove permissions and automatically terminate sessions  
✅ **IP-based Auth** - No tokens required, uses your IP automatically  
✅ **Beautiful UI** - Modern, responsive design with smooth animations

## Usage

```tsx
import InviteManager from './components/MCPServer/InviteManager';

function MyComponent() {
  return (
    <InviteManager 
      serverKey="my-server" 
      serverName="My MCP Server"
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `serverKey` | string | ✅ | The unique server key identifier |
| `serverName` | string | ✅ | Display name of the server |

## Permission States

### **Active** 🟢
- User has connected and is authorized
- Can access the server
- Sessions are active

### **Pending** 🟡
- Email has been added to allowlist
- User hasn't connected yet
- Waiting for first connection

### **Revoked** 🔴
- Access has been removed
- Active sessions terminated
- User can no longer connect

## Access Levels

### **Read Only**
- Can view resources
- Cannot modify data
- Limited tool access

### **Read & Write**
- Full read access
- Can modify data
- Standard tool access

### **Admin**
- Full permissions
- Can manage server settings
- Elevated privileges

## Features

### Add People
1. Click "Add People" button
2. Enter email addresses (one per line or comma-separated)
3. Select access level
4. Add optional notes
5. Click "Add Permissions"

**Example Input:**
```
alice@company.com, bob@company.com
charlie@company.com
```

### Edit Permission
1. Click edit button (✏️) on any permission card
2. Change access level or notes
3. Click save (✓) or cancel (✗)

### Revoke Access
1. Click revoke button (🗑️) on any permission card
2. Confirm the action
3. Permission is revoked and sessions terminated

## IPC Calls

The component uses these IPC channels:

- `mcp-permissions-get` - Load all permissions for a server
- `mcp-permissions-add` - Add new permissions
- `mcp-permissions-update` - Update existing permission
- `mcp-permissions-revoke` - Revoke permission and terminate sessions

## Styling

The component comes with comprehensive CSS (`InviteManager.css`) featuring:
- Modern card-based layout
- Smooth transitions and hover effects
- Responsive design (mobile-friendly)
- Status-based color coding
- Professional typography

## Example Integration

```tsx
import { useState } from 'react';
import InviteManager from './components/MCPServer/InviteManager';

function MCPServerDashboard() {
  const [selectedServer, setSelectedServer] = useState({
    key: 'my-server',
    name: 'My MCP Server'
  });

  return (
    <div>
      <h1>MCP Server Dashboard</h1>
      
      <InviteManager 
        serverKey={selectedServer.key}
        serverName={selectedServer.name}
      />
    </div>
  );
}
```

## Error Handling

The component includes comprehensive error handling:
- Network errors
- Invalid inputs
- Permission conflicts
- API failures

Errors are displayed in a dismissible banner at the top of the component.

## Responsive Design

The component is fully responsive:
- **Desktop**: Side-by-side layout with all features
- **Tablet**: Stacked layout with adjusted spacing
- **Mobile**: Single column, full-width buttons

## Accessibility

- Semantic HTML structure
- Clear button labels
- Color contrast meets WCAG AA
- Keyboard navigation support
- Screen reader friendly

## Performance

- Efficient re-renders using React hooks
- Lazy loading of permissions
- Optimistic UI updates
- Minimal re-fetches

## Future Enhancements

Potential improvements:
- [ ] Bulk operations (select multiple, revoke all)
- [ ] Export permissions to CSV
- [ ] Permission templates
- [ ] Email notifications
- [ ] Activity timeline
- [ ] Search and filter
- [ ] Domain-based invites (e.g., `*@company.com`)

