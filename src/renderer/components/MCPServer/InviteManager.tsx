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
    if (!newEmails.trim()) {
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
        return <FontAwesomeIcon icon={faCircleCheck} className="status-icon status-active" style={{ fontSize: '10px' }} />;
      case 'pending':
        return <FontAwesomeIcon icon={faClock} className="status-icon status-pending" style={{ fontSize: '10px' }} />;
      case 'revoked':
        return <FontAwesomeIcon icon={faCircleXmark} className="status-icon status-revoked" style={{ fontSize: '10px' }} />;
      case 'expired':
        return <FontAwesomeIcon icon={faExclamationTriangle} className="status-icon status-expired" style={{ fontSize: '10px' }} />;
      default:
        return null;
    }
  };

  // Simplified badge for compact view
  const getAccessLevelBadge = (level: string) => {
    const labels = {
      admin: 'Admin',
      read_write: 'R/W',
      read_only: 'Read'
    };
    const colors = {
      admin: '#ef4444',
      read_write: '#10b981',
      read_only: '#3b82f6'
    };
    
    return (
      <span style={{ 
        fontSize: '10px', 
        padding: '2px 6px', 
        borderRadius: '4px', 
        backgroundColor: `${colors[level as keyof typeof colors]}20`,
        color: colors[level as keyof typeof colors],
        fontWeight: '600',
        textTransform: 'uppercase'
      }}>
        {labels[level as keyof typeof labels] || level}
      </span>
    );
  };

  // Group permissions by status
  const activePermissions = permissions.filter(p => p.status === 'active');
  const pendingPermissions = permissions.filter(p => p.status === 'pending');
  // Revoked permissions are hidden by default in compact view to save space

  return (
    <div className="invite-manager compact" style={{ fontSize: '13px' }}>
      <div className="invite-manager-header" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="header-content">
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FontAwesomeIcon icon={faUsers} style={{ color: '#3b82f6' }} />
            Manage Access
          </h4>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn-refresh" 
            onClick={loadPermissions}
            disabled={loading}
            style={{ background: 'transparent', border: 'none', color: 'white', opacity: 0.7, cursor: 'pointer', padding: '4px' }}
            title="Refresh list"
          >
            <FontAwesomeIcon icon={faRefresh} spin={loading} />
          </button>
          <button 
            className="btn-add-permission" 
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ 
              background: 'rgba(59, 130, 246, 0.2)', 
              border: 'none', 
              color: '#3b82f6', 
              cursor: 'pointer', 
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FontAwesomeIcon icon={showAddForm ? faTimes : faUserPlus} />
            {showAddForm ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ 
          padding: '8px', 
          background: 'rgba(239, 68, 68, 0.1)', 
          borderRadius: '6px', 
          color: '#ef4444', 
          marginBottom: '12px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="add-permission-form" style={{ 
          background: 'rgba(0, 0, 0, 0.2)', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <textarea
              placeholder="Enter emails (comma separated)..."
              value={newEmails}
              onChange={(e) => setNewEmails(e.target.value)}
              rows={2}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                background: 'rgba(255, 255, 255, 0.9)', 
                color: '#1f2937',
                border: 'none',
                resize: 'vertical',
                fontSize: '13px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <select
                value={newAccessLevel}
                onChange={(e) => setNewAccessLevel(e.target.value as any)}
                style={{ 
                  width: '100%', 
                  padding: '6px', 
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  fontSize: '12px'
                }}
              >
                <option value="read_only">Read Only</option>
                <option value="read_write">Read & Write</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button 
              onClick={handleAddPermissions}
              disabled={addingPermissions}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: addingPermissions ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                opacity: addingPermissions ? 0.7 : 1,
                whiteSpace: 'nowrap'
              }}
            >
              {addingPermissions ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Invite'}
            </button>
          </div>
        </div>
      )}

      {loading && permissions.length === 0 ? (
        <div className="loading-state" style={{ textAlign: 'center', padding: '12px', opacity: 0.7, fontSize: '12px' }}>
          <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
          Loading...
        </div>
      ) : permissions.length === 0 && !showAddForm ? (
        <div className="empty-state" style={{ textAlign: 'center', padding: '12px', opacity: 0.5, fontSize: '12px' }}>
          No permissions set
        </div>
      ) : (
        <div className="permissions-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Active & Pending List Mixed (sorted by status/name) */}
          {[...activePermissions, ...pendingPermissions].map(permission => (
            <div key={permission.id} className="permission-item" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
                  {editingId === permission.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>{permission.allowed_email}</div>
                          <select
                            value={editAccessLevel}
                            onChange={(e) => setEditAccessLevel(e.target.value as any)}
                      style={{ 
                        width: '100%', 
                        padding: '4px', 
                        fontSize: '11px',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '4px'
                      }}
                          >
                            <option value="read_only">Read Only</option>
                            <option value="read_write">Read & Write</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                  <button onClick={() => handleUpdatePermission(permission.id)} style={{ background: '#10b981', border: 'none', borderRadius: '4px', padding: '4px', color: 'white', cursor: 'pointer' }}>
                    <FontAwesomeIcon icon={faCheck} size="xs" />
                        </button>
                  <button onClick={cancelEditing} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', padding: '4px', color: 'white', cursor: 'pointer' }}>
                    <FontAwesomeIcon icon={faTimes} size="xs" />
                        </button>
                    </div>
                  ) : (
                    <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                          {getStatusIcon(permission.status)}
                    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      <div style={{ fontSize: '12px', fontWeight: '500' }}>{permission.allowed_email}</div>
                      {permission.status === 'pending' && (
                        <div style={{ fontSize: '10px', opacity: 0.5 }}>Pending invitation</div>
                          )}
                        </div>
                      </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getAccessLevelBadge(permission.access_level)}
                        <button 
                          onClick={() => startEditing(permission)}
                      style={{ background: 'transparent', border: 'none', color: 'white', opacity: 0.5, cursor: 'pointer', padding: '2px' }}
                          title="Edit"
                        >
                      <FontAwesomeIcon icon={faEdit} size="xs" />
                        </button>
                        <button 
                          onClick={() => handleRevokePermission(permission.id, permission.allowed_email)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', opacity: 0.7, cursor: 'pointer', padding: '2px' }}
                          title="Revoke"
                        >
                      <FontAwesomeIcon icon={faTrash} size="xs" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
        </div>
      )}
    </div>
  );
};

export default InviteManager;
