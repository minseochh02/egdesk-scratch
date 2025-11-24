import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserPlus,
  faUsers,
  faTrash,
  faEdit,
  faCheck,
  faTimes,
  faSpinner,
  faEnvelope,
  faShieldAlt,
  faClock,
  faCircleCheck,
  faCircleXmark,
  faRefresh,
  faExclamationTriangle
} from '../../utils/fontAwesomeIcons';
import './InviteManager.css';

interface Permission {
  id: string;
  server_id: string;
  allowed_email: string;
  user_id: string | null;
  status: 'pending' | 'active' | 'revoked' | 'expired';
  access_level: 'read_only' | 'read_write' | 'admin';
  granted_at: string;
  granted_by_ip: string;
  activated_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  notes: string | null;
}

interface InviteManagerProps {
  serverKey: string;
  serverName: string;
}

const InviteManager: React.FC<InviteManagerProps> = ({ serverKey, serverName }) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Add permission form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmails, setNewEmails] = useState('');
  const [newAccessLevel, setNewAccessLevel] = useState<'read_only' | 'read_write' | 'admin'>('read_write');
  const [newNotes, setNewNotes] = useState('');
  const [addingPermissions, setAddingPermissions] = useState(false);
  
  // Edit permission state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAccessLevel, setEditAccessLevel] = useState<'read_only' | 'read_write' | 'admin'>('read_write');
  const [editNotes, setEditNotes] = useState('');

  // Load permissions on mount
  useEffect(() => {
    loadPermissions();
  }, [serverKey]);

  const loadPermissions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electron.permissions.get(serverKey);
      
      if (result.success) {
        setPermissions(result.permissions || []);
      } else {
        setError(result.error || 'Failed to load permissions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPermissions = async () => {
    console.log('🔍 handleAddPermissions called');
    console.log('🔍 newEmails value:', newEmails);
    console.log('🔍 newEmails.trim():', newEmails.trim());
    console.log('🔍 newEmails length:', newEmails.length);
    
    if (!newEmails.trim()) {
      console.log('❌ Validation failed: empty email field');
      setError('Please enter at least one email address');
      return;
    }

    setAddingPermissions(true);
    setError(null);

    try {
      // Split emails by comma or newline and clean them
      const emailList = newEmails
        .split(/[,\n]+/)
        .map(email => email.trim().toLowerCase())
        .filter(email => email.length > 0 && email.includes('@'));

      console.log('📧 Parsed email list:', emailList);

      if (emailList.length === 0) {
        setError('Please enter valid email addresses');
        return;
      }

      const result = await window.electron.permissions.add({
        server_key: serverKey,
        emails: emailList,
        access_level: newAccessLevel,
        notes: newNotes || undefined
      });

      if (result.success) {
        setNewEmails('');
        setNewNotes('');
        setShowAddForm(false);
        await loadPermissions();
      } else {
        setError(result.error || 'Failed to add permissions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAddingPermissions(false);
    }
  };

  const handleUpdatePermission = async (permissionId: string) => {
    try {
      const result = await window.electron.permissions.update(permissionId, {
        access_level: editAccessLevel,
        notes: editNotes || undefined
      });

      if (result.success) {
        setEditingId(null);
        await loadPermissions();
      } else {
        setError(result.error || 'Failed to update permission');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleRevokePermission = async (permissionId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to revoke access for ${email}?`)) {
      return;
    }

    try {
      const result = await window.electron.permissions.revoke(permissionId);

      if (result.success) {
        await loadPermissions();
      } else {
        setError(result.error || 'Failed to revoke permission');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const startEditing = (permission: Permission) => {
    setEditingId(permission.id);
    setEditAccessLevel(permission.access_level);
    setEditNotes(permission.notes || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditAccessLevel('read_write');
    setEditNotes('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <FontAwesomeIcon icon={faCircleCheck} className="status-icon status-active" />;
      case 'pending':
        return <FontAwesomeIcon icon={faClock} className="status-icon status-pending" />;
      case 'revoked':
        return <FontAwesomeIcon icon={faCircleXmark} className="status-icon status-revoked" />;
      case 'expired':
        return <FontAwesomeIcon icon={faExclamationTriangle} className="status-icon status-expired" />;
      default:
        return null;
    }
  };

  const getAccessLevelBadge = (level: string) => {
    const badges = {
      admin: <span className="access-badge access-admin">Admin</span>,
      read_write: <span className="access-badge access-read-write">Read/Write</span>,
      read_only: <span className="access-badge access-read-only">Read Only</span>
    };
    return badges[level as keyof typeof badges] || null;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  // Group permissions by status
  const activePermissions = permissions.filter(p => p.status === 'active');
  const pendingPermissions = permissions.filter(p => p.status === 'pending');
  const revokedPermissions = permissions.filter(p => p.status === 'revoked');

  return (
    <div className="invite-manager">
      <div className="invite-manager-header">
        <div className="header-content">
          <h2>
            <FontAwesomeIcon icon={faUsers} />
            Manage Invitations
          </h2>
          <p className="header-subtitle">Control who can access {serverName}</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn-refresh" 
            onClick={loadPermissions}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faRefresh} spin={loading} />
            Refresh
          </button>
          <button 
            className="btn-add-permission" 
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <FontAwesomeIcon icon={faUserPlus} />
            Add People
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          {error}
          <button onClick={() => setError(null)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="add-permission-form">
          <h3>Add New People</h3>
          <div className="form-group">
            <label>Email Addresses (Current value: "{newEmails}")</label>
            <textarea
              placeholder="Enter email addresses (one per line or comma-separated)
Example:
alice@company.com, bob@company.com
charlie@company.com"
              value={newEmails}
              onChange={(e) => {
                console.log('📝 Textarea onChange fired, value:', e.target.value);
                setNewEmails(e.target.value);
              }}
              onFocus={() => console.log('📝 Textarea focused')}
              onBlur={() => console.log('📝 Textarea blurred')}
              rows={4}
              style={{ backgroundColor: 'white', cursor: 'text' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Access Level</label>
              <select
                value={newAccessLevel}
                onChange={(e) => setNewAccessLevel(e.target.value as any)}
              >
                <option value="read_only">Read Only</option>
                <option value="read_write">Read & Write</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g., Team members, External contractors..."
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button 
              className="btn-cancel" 
              onClick={() => {
                setShowAddForm(false);
                setNewEmails('');
                setNewNotes('');
              }}
              disabled={addingPermissions}
            >
              <FontAwesomeIcon icon={faTimes} />
              Cancel
            </button>
            <button 
              className="btn-submit" 
              onClick={handleAddPermissions}
              disabled={addingPermissions}
            >
              {addingPermissions ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin />
                  Adding...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheck} />
                  Add Permissions
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {loading && permissions.length === 0 ? (
        <div className="loading-state">
          <FontAwesomeIcon icon={faSpinner} spin />
          Loading permissions...
        </div>
      ) : permissions.length === 0 ? (
        <div className="empty-state">
          <FontAwesomeIcon icon={faUsers} />
          <h3>No permissions yet</h3>
          <p>Add people to grant them access to this server</p>
          <button onClick={() => setShowAddForm(true)}>
            <FontAwesomeIcon icon={faUserPlus} />
            Add First Person
          </button>
        </div>
      ) : (
        <div className="permissions-list">
          {/* Active Permissions */}
          {activePermissions.length > 0 && (
            <div className="permissions-section">
              <h3 className="section-title">
                <FontAwesomeIcon icon={faCircleCheck} />
                Active ({activePermissions.length})
              </h3>
              {activePermissions.map(permission => (
                <div key={permission.id} className="permission-card">
                  {editingId === permission.id ? (
                    <div className="permission-edit-form">
                      <div className="edit-header">
                        <FontAwesomeIcon icon={faEnvelope} />
                        <span className="email">{permission.allowed_email}</span>
                      </div>
                      <div className="edit-fields">
                        <div className="form-group">
                          <label>Access Level</label>
                          <select
                            value={editAccessLevel}
                            onChange={(e) => setEditAccessLevel(e.target.value as any)}
                          >
                            <option value="read_only">Read Only</option>
                            <option value="read_write">Read & Write</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Notes</label>
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Add notes..."
                          />
                        </div>
                      </div>
                      <div className="edit-actions">
                        <button onClick={cancelEditing} className="btn-cancel-edit">
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                        <button onClick={() => handleUpdatePermission(permission.id)} className="btn-save-edit">
                          <FontAwesomeIcon icon={faCheck} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="permission-info">
                        <div className="permission-header">
                          {getStatusIcon(permission.status)}
                          <FontAwesomeIcon icon={faEnvelope} className="email-icon" />
                          <span className="email">{permission.allowed_email}</span>
                          {getAccessLevelBadge(permission.access_level)}
                        </div>
                        {permission.notes && (
                          <div className="permission-notes">{permission.notes}</div>
                        )}
                        <div className="permission-meta">
                          <span>Added: {formatDate(permission.granted_at)}</span>
                          {permission.activated_at && (
                            <span>Activated: {formatDate(permission.activated_at)}</span>
                          )}
                        </div>
                      </div>
                      <div className="permission-actions">
                        <button 
                          onClick={() => startEditing(permission)}
                          className="btn-edit"
                          title="Edit"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button 
                          onClick={() => handleRevokePermission(permission.id, permission.allowed_email)}
                          className="btn-revoke"
                          title="Revoke"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pending Permissions */}
          {pendingPermissions.length > 0 && (
            <div className="permissions-section">
              <h3 className="section-title">
                <FontAwesomeIcon icon={faClock} />
                Pending ({pendingPermissions.length})
              </h3>
              {pendingPermissions.map(permission => (
                <div key={permission.id} className="permission-card permission-pending">
                  <div className="permission-info">
                    <div className="permission-header">
                      {getStatusIcon(permission.status)}
                      <FontAwesomeIcon icon={faEnvelope} className="email-icon" />
                      <span className="email">{permission.allowed_email}</span>
                      {getAccessLevelBadge(permission.access_level)}
                    </div>
                    {permission.notes && (
                      <div className="permission-notes">{permission.notes}</div>
                    )}
                    <div className="permission-meta">
                      <span>Added: {formatDate(permission.granted_at)}</span>
                      <span className="pending-note">Waiting for user to connect</span>
                    </div>
                  </div>
                  <div className="permission-actions">
                    <button 
                      onClick={() => handleRevokePermission(permission.id, permission.allowed_email)}
                      className="btn-revoke"
                      title="Revoke"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Revoked Permissions */}
          {revokedPermissions.length > 0 && (
            <div className="permissions-section permissions-revoked">
              <h3 className="section-title">
                <FontAwesomeIcon icon={faCircleXmark} />
                Revoked ({revokedPermissions.length})
              </h3>
              {revokedPermissions.map(permission => (
                <div key={permission.id} className="permission-card permission-revoked">
                  <div className="permission-info">
                    <div className="permission-header">
                      {getStatusIcon(permission.status)}
                      <FontAwesomeIcon icon={faEnvelope} className="email-icon" />
                      <span className="email">{permission.allowed_email}</span>
                      {getAccessLevelBadge(permission.access_level)}
                    </div>
                    <div className="permission-meta">
                      <span>Revoked: {formatDate(permission.revoked_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InviteManager;

