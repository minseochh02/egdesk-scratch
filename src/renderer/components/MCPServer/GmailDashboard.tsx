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

interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  isRead: boolean;
  isImportant: boolean;
  labels: string[];
  threadId: string;
}

interface GmailStats {
  totalMessages: number;
  unreadMessages: number;
  importantMessages: number;
  sentMessages: number;
  recentActivity: number;
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
  const [userMessages, setUserMessages] = useState<GmailMessage[]>([]);
  const [userStats, setUserStats] = useState<GmailStats | null>(null);
  const [loadingUserData, setLoadingUserData] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'users' | 'gmail'>('users');

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

  const handleUserClick = async (user: DomainUser) => {
    setSelectedUser(user);
    setViewMode('gmail');
    await loadUserGmailData(user.email);
  };

  const loadUserGmailData = async (userEmail: string) => {
    try {
      setLoadingUserData(true);
      setError(null);
      
      // Fetch user's Gmail messages and stats
      const [messagesResult, statsResult] = await Promise.all([
        (window.electron as any).gmailMCP.fetchUserMessages(connection.id, userEmail, { maxResults: 50 }),
        (window.electron as any).gmailMCP.fetchUserStats(connection.id, userEmail)
      ]);

      if (!messagesResult.success) {
        throw new Error(messagesResult.error || 'Failed to fetch user messages');
      }

      if (!statsResult.success) {
        throw new Error(statsResult.error || 'Failed to fetch user stats');
      }

      const messages = messagesResult.messages || [];
      const stats = statsResult.stats || {
        totalMessages: 0,
        unreadMessages: 0,
        importantMessages: 0,
        sentMessages: 0,
        recentActivity: 0
      };

      setUserMessages(messages);
      setUserStats(stats);

      // Save to SQLite database
      try {
        await saveUserDataToDatabase(userEmail, messages, stats);
        console.log(`Successfully saved Gmail data for ${userEmail} to SQLite database`);
      } catch (dbError) {
        console.error('Error saving to database:', dbError);
        // Don't throw error - just log it, as the main functionality still works
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user Gmail data');
    } finally {
      setLoadingUserData(false);
    }
  };

  const saveUserDataToDatabase = async (userEmail: string, messages: GmailMessage[], stats: GmailStats) => {
    try {
      // Save user messages to database
      const messageRecords = messages.map(message => ({
        id: message.id,
        userEmail: userEmail,
        subject: message.subject,
        from: message.from,
        to: message.to,
        date: message.date,
        snippet: message.snippet,
        isRead: message.isRead,
        isImportant: message.isImportant,
        labels: JSON.stringify(message.labels),
        threadId: message.threadId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      // Save user stats to database
      const statsRecord = {
        id: `stats-${userEmail}-${Date.now()}`,
        userEmail: userEmail,
        totalMessages: stats.totalMessages,
        unreadMessages: stats.unreadMessages,
        importantMessages: stats.importantMessages,
        sentMessages: stats.sentMessages,
        recentActivity: stats.recentActivity,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Call the database save API
      await (window.electron as any).gmailMCP.saveUserDataToDatabase(userEmail, messageRecords, statsRecord);
    } catch (error) {
      console.error('Error saving user data to database:', error);
      throw error;
    }
  };

  const handleBackToUsers = () => {
    setViewMode('users');
    setSelectedUser(null);
    setUserMessages([]);
    setUserStats(null);
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
          {viewMode === 'gmail' ? (
            <button className="gmail-dashboard-back-btn" onClick={handleBackToUsers}>
              <FontAwesomeIcon icon={faArrowRight} />
              <span>Back to Users</span>
            </button>
          ) : onBack ? (
            <button className="gmail-dashboard-back-btn" onClick={onBack}>
              <FontAwesomeIcon icon={faArrowRight} />
              <span>Back to MCP Tools</span>
            </button>
          ) : null}
          <div className="gmail-dashboard-title">
            <div className="gmail-dashboard-icon">
              <FontAwesomeIcon icon={viewMode === 'gmail' ? faEnvelope : faUsers} />
            </div>
            <div>
              <h2>{viewMode === 'gmail' ? `${selectedUser?.displayName || selectedUser?.name}'s Gmail` : 'Domain Users Dashboard'}</h2>
              <p>{viewMode === 'gmail' ? selectedUser?.email : 'quus.cloud domain users'}</p>
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
        {viewMode === 'users' ? (
          <>
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
          </>
        ) : userStats ? (
          <>
            <div className="gmail-dashboard-stat-card">
              <div className="gmail-dashboard-stat-icon">
                <FontAwesomeIcon icon={faEnvelope} />
              </div>
              <div className="gmail-dashboard-stat-content">
                <div className="gmail-dashboard-stat-number">{userStats.totalMessages}</div>
                <div className="gmail-dashboard-stat-label">Total Messages</div>
              </div>
            </div>
            <div className="gmail-dashboard-stat-card">
              <div className="gmail-dashboard-stat-icon">
                <FontAwesomeIcon icon={faEnvelope} />
              </div>
              <div className="gmail-dashboard-stat-content">
                <div className="gmail-dashboard-stat-number">{userStats.unreadMessages}</div>
                <div className="gmail-dashboard-stat-label">Unread</div>
              </div>
            </div>
            <div className="gmail-dashboard-stat-card">
              <div className="gmail-dashboard-stat-icon">
                <FontAwesomeIcon icon={faTriangleExclamation} />
              </div>
              <div className="gmail-dashboard-stat-content">
                <div className="gmail-dashboard-stat-number">{userStats.importantMessages}</div>
                <div className="gmail-dashboard-stat-label">Important</div>
              </div>
            </div>
            <div className="gmail-dashboard-stat-card">
              <div className="gmail-dashboard-stat-icon">
                <FontAwesomeIcon icon={faEnvelope} />
              </div>
              <div className="gmail-dashboard-stat-content">
                <div className="gmail-dashboard-stat-number">{userStats.sentMessages}</div>
                <div className="gmail-dashboard-stat-label">Sent</div>
              </div>
            </div>
          </>
        ) : null}
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

      {/* Content Area */}
      <div className="gmail-dashboard-messages">
        {viewMode === 'users' ? (
          // Users List
          filteredUsers.length === 0 ? (
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
          )
        ) : (
          // Gmail Messages
          loadingUserData ? (
            <div className="gmail-dashboard-loading">
              <div className="gmail-dashboard-spinner"></div>
              <p>Loading Gmail data...</p>
            </div>
          ) : userMessages.length === 0 ? (
            <div className="gmail-dashboard-empty">
              <FontAwesomeIcon icon={faEnvelope} />
              <h3>No Messages Found</h3>
              <p>This user has no Gmail messages.</p>
            </div>
          ) : (
            <div className="gmail-dashboard-messages-list">
              {userMessages.map((message) => (
                <div
                  key={message.id}
                  className={`gmail-dashboard-message ${!message.isRead ? 'unread' : ''} ${message.isImportant ? 'important' : ''}`}
                >
                  <div className="gmail-dashboard-message-header">
                    <div className="gmail-dashboard-message-from">
                      {message.from}
                    </div>
                    <div className="gmail-dashboard-message-date">
                      {formatDate(message.date)}
                    </div>
                  </div>
                  <div className="gmail-dashboard-message-subject">
                    {message.subject}
                  </div>
                  <div className="gmail-dashboard-message-snippet">
                    {message.snippet}
                  </div>
                  <div className="gmail-dashboard-message-labels">
                    {message.labels.map((label, index) => (
                      <span key={index} className="gmail-dashboard-message-label">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
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
