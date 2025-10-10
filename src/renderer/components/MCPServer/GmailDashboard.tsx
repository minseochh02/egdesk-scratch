import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faArrowRight, faSpinner, faCircleCheck, faCircleXmark, faTriangleExclamation, faChartBar, faUsers, faUser, faKey, faTimes, faSearch, faRefresh, faCalendarAlt } from '../../utils/fontAwesomeIcons';
import './GmailDashboard.css';

interface DomainUser {
  id: string;
  email: string;
  name: string;
  displayName: string;
  isAdmin: boolean;
  isSuspended: boolean;
  lastLoginTime?: string;
}

interface GmailConnection {
  id: string;
  name: string;
  email: string;
  adminEmail: string;
  serviceAccountKey: any;
  createdAt: string;
  updatedAt: string;
  type: 'gmail';
  status: 'online' | 'offline' | 'error' | 'checking';
}

interface GmailDashboardProps {
  connection: GmailConnection;
  onBack?: () => void;
  onRefresh?: () => void;
}

const GmailDashboard: React.FC<GmailDashboardProps> = ({ connection, onBack, onRefresh }) => {
  const [users, setUsers] = useState<DomainUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<DomainUser | null>(null);

  useEffect(() => {
    loadDomainUsers();
  }, [connection]);

  const loadDomainUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch domain users from Gmail MCP API
      const usersResult = await (window.electron as any).gmailMCP.fetchDomainUsers(connection.id);

      if (!usersResult.success) {
        throw new Error(usersResult.error || 'Failed to fetch domain users');
      }

      setUsers(usersResult.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domain users');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadDomainUsers();
    onRefresh?.();
  };

  const handleUserClick = (user: DomainUser) => {
    setSelectedUser(user);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'admin' && user.isAdmin) ||
                         (filterStatus === 'suspended' && user.isSuspended) ||
                         (filterStatus === 'active' && !user.isSuspended);
    
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'offline':
        return 'error';
      case 'error':
        return 'error';
      case 'checking':
      default:
        return 'warning';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return faCircleCheck;
      case 'offline':
        return faCircleXmark;
      case 'error':
        return faTriangleExclamation;
      case 'checking':
      default:
        return faSpinner;
    }
  };

  if (loading) {
    return (
      <div className="gmail-dashboard">
        <div className="gmail-dashboard-loading">
          <div className="gmail-dashboard-spinner"></div>
          <p>Loading domain users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gmail-dashboard">
        <div className="gmail-dashboard-error">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <h3>Error Loading Domain Users</h3>
          <p>{error}</p>
          <button onClick={handleRefresh} className="gmail-dashboard-retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gmail-dashboard">
      {/* Header */}
      <div className="gmail-dashboard-header">
        <div className="gmail-dashboard-header-left">
          {onBack && (
            <button className="gmail-dashboard-back-btn" onClick={onBack}>
              <FontAwesomeIcon icon={faArrowRight} />
              <span>Back to MCP Tools</span>
            </button>
          )}
          <div className="gmail-dashboard-title">
            <div className="gmail-dashboard-icon">
              <FontAwesomeIcon icon={faUsers} />
            </div>
            <div>
              <h2>Domain Users Dashboard</h2>
              <p>quus.cloud domain users</p>
            </div>
          </div>
        </div>
        <div className="gmail-dashboard-header-right">
          <div className="gmail-dashboard-status">
            <span className={`gmail-dashboard-status-indicator gmail-dashboard-status-indicator-${getStatusColor(connection.status)}`}>
              <FontAwesomeIcon 
                icon={getStatusIcon(connection.status)} 
                className={connection.status === 'checking' ? 'gmail-dashboard-spinning' : ''}
              />
            </span>
            <span className="gmail-dashboard-status-text">
              {connection.status === 'checking' ? 'Checking...' : connection.status}
            </span>
          </div>
          <button className="gmail-dashboard-refresh-btn" onClick={handleRefresh}>
            <FontAwesomeIcon icon={faRefresh} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="gmail-dashboard-stats">
        <div className="gmail-dashboard-stat-card">
          <div className="gmail-dashboard-stat-icon">
            <FontAwesomeIcon icon={faUsers} />
          </div>
          <div className="gmail-dashboard-stat-content">
            <div className="gmail-dashboard-stat-number">{users.length}</div>
            <div className="gmail-dashboard-stat-label">Total Users</div>
          </div>
        </div>
        <div className="gmail-dashboard-stat-card">
          <div className="gmail-dashboard-stat-icon">
            <FontAwesomeIcon icon={faKey} />
          </div>
          <div className="gmail-dashboard-stat-content">
            <div className="gmail-dashboard-stat-number">{users.filter(u => u.isAdmin).length}</div>
            <div className="gmail-dashboard-stat-label">Admins</div>
          </div>
        </div>
        <div className="gmail-dashboard-stat-card">
          <div className="gmail-dashboard-stat-icon">
            <FontAwesomeIcon icon={faUser} />
          </div>
          <div className="gmail-dashboard-stat-content">
            <div className="gmail-dashboard-stat-number">{users.filter(u => !u.isSuspended).length}</div>
            <div className="gmail-dashboard-stat-label">Active</div>
          </div>
        </div>
        <div className="gmail-dashboard-stat-card">
          <div className="gmail-dashboard-stat-icon">
            <FontAwesomeIcon icon={faTimes} />
          </div>
          <div className="gmail-dashboard-stat-content">
            <div className="gmail-dashboard-stat-number">{users.filter(u => u.isSuspended).length}</div>
            <div className="gmail-dashboard-stat-label">Suspended</div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="gmail-dashboard-controls">
        <div className="gmail-dashboard-search">
          <FontAwesomeIcon icon={faSearch} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="gmail-dashboard-filter">
          <FontAwesomeIcon icon={faChartBar} />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Users</option>
            <option value="admin">Admins</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users List */}
      <div className="gmail-dashboard-messages">
        {filteredUsers.length === 0 ? (
          <div className="gmail-dashboard-empty">
            <FontAwesomeIcon icon={faUsers} />
            <h3>No Users Found</h3>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="gmail-dashboard-messages-list">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`gmail-dashboard-message ${user.isAdmin ? 'admin' : ''} ${user.isSuspended ? 'suspended' : ''}`}
                onClick={() => handleUserClick(user)}
              >
                <div className="gmail-dashboard-message-header">
                  <div className="gmail-dashboard-message-from">
                    <FontAwesomeIcon icon={user.isAdmin ? faKey : faUser} />
                    {user.displayName || user.name}
                  </div>
                  <div className="gmail-dashboard-message-date">
                    {formatDate(user.lastLoginTime)}
                  </div>
                </div>
                <div className="gmail-dashboard-message-subject">
                  {user.email}
                </div>
                <div className="gmail-dashboard-message-snippet">
                  {user.isAdmin ? 'Administrator' : 'User'} • {user.isSuspended ? 'Suspended' : 'Active'}
                </div>
                <div className="gmail-dashboard-message-labels">
                  {user.isAdmin && (
                    <span className="gmail-dashboard-message-label admin">Admin</span>
                  )}
                  {user.isSuspended && (
                    <span className="gmail-dashboard-message-label suspended">Suspended</span>
                  )}
                  {!user.isSuspended && (
                    <span className="gmail-dashboard-message-label active">Active</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="gmail-dashboard-modal">
          <div className="gmail-dashboard-modal-content">
            <div className="gmail-dashboard-modal-header">
              <h3>{selectedUser.displayName || selectedUser.name}</h3>
              <button
                className="gmail-dashboard-modal-close"
                onClick={() => setSelectedUser(null)}
              >
                ×
              </button>
            </div>
            <div className="gmail-dashboard-modal-body">
              <div className="gmail-dashboard-modal-meta">
                <div><strong>Email:</strong> {selectedUser.email}</div>
                <div><strong>Name:</strong> {selectedUser.name}</div>
                <div><strong>Display Name:</strong> {selectedUser.displayName}</div>
                <div><strong>Role:</strong> {selectedUser.isAdmin ? 'Administrator' : 'User'}</div>
                <div><strong>Status:</strong> {selectedUser.isSuspended ? 'Suspended' : 'Active'}</div>
                <div><strong>Last Login:</strong> {formatDate(selectedUser.lastLoginTime)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GmailDashboard;
