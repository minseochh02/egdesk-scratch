import React, { useState, useEffect } from 'react';
import type { CompanyResearchRecord } from '../../main/sqlite/company-research';
import './CompanyResearchPage.css';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        sendMessage(channel: string, ...args: any[]): void;
        on(channel: string, listener: (...args: any[]) => void): () => void;
        once(channel: string, listener: (...args: any[]) => void): void;
      };
      invoke(channel: string, ...args: any[]): Promise<any>;
      web: {
        fetchContent: (url: string) => Promise<any>;
        crawlHomepage: (url: string) => Promise<any>;
        crawlMultiplePages: (url: string, options?: any) => Promise<any>;
        generateBusinessIdentity: (text: string, rootUrl?: string, lang?: string) => Promise<any>;
        generateSnsPlan: (identity: any) => Promise<any>;
        fullResearch: (domain: string, inquiryData?: any, options?: any) => Promise<any>;
        db: {
          save: (record: any) => Promise<any>;
          getAll: () => Promise<any>;
          getById: (id: string) => Promise<any>;
          update: (id: string, updates: any) => Promise<any>;
          delete: (id: string) => Promise<any>;
          findByDomain: (domain: string) => Promise<any>;
          hasRecent: (domain: string, hoursAgo?: number) => Promise<any>;
          getLatestCompleted: (domain: string) => Promise<any>;
        };
      };
    };
  }
}

interface ResearchedCompanyPageProps {
  onLoadResearch: (record: CompanyResearchRecord) => void;
}

const ResearchedCompanyPage: React.FC<ResearchedCompanyPageProps> = ({ onLoadResearch }) => {
  const [history, setHistory] = useState<CompanyResearchRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  const fetchHistory = async () => {
    try {
      const response = await window.electron.web.db.getAll();
      if (response.success) {
        setHistory(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch research history:', error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const deleteResearch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this research record?')) return;
    
    try {
      const response = await window.electron.web.db.delete(id);
      if (response.success) {
        fetchHistory();
      }
    } catch (error) {
      console.error('Failed to delete research:', error);
    }
  };

  const filteredHistory = history
    .filter(item => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.companyName?.toLowerCase().includes(query) ||
        item.domain?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return (a.companyName || a.domain).localeCompare(b.companyName || b.domain);
    });

  const getStatusColor = (status: string) => {
    if (status === 'completed') return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' };
    if (status === 'error') return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' };
    return { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="rcp-container">
      <div className="rcp-header">
        <h2 className="rcp-title">📚 Past Research</h2>
        <p className="rcp-subtitle">
          {history.length} {history.length === 1 ? 'company' : 'companies'} researched
        </p>
      </div>

      {history.length > 0 && (
        <div className="rcp-controls">
          <div className="rcp-search">
            <span className="rcp-search-icon">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search companies..."
              className="rcp-search-input"
            />
          </div>
          <div className="rcp-sort">
            <button
              className={`rcp-sort-btn ${sortBy === 'date' ? 'active' : ''}`}
              onClick={() => setSortBy('date')}
            >
              Recent
            </button>
            <button
              className={`rcp-sort-btn ${sortBy === 'name' ? 'active' : ''}`}
              onClick={() => setSortBy('name')}
            >
              A-Z
            </button>
          </div>
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="rcp-empty">
          {searchQuery ? (
            <>
              <span className="rcp-empty-icon">🔍</span>
              <p>No companies matching "{searchQuery}"</p>
            </>
          ) : (
            <>
              <span className="rcp-empty-icon">📋</span>
              <p>No research history yet</p>
              <span className="rcp-empty-hint">Start by researching a company above</span>
            </>
          )}
        </div>
      ) : (
        <div className="rcp-grid">
          {filteredHistory.map((item) => {
            const statusStyle = getStatusColor(item.status);
            return (
              <div
                key={item.id}
                className="rcp-card"
                onClick={() => onLoadResearch(item)}
              >
                <button
                  className="rcp-delete"
                  onClick={(e) => deleteResearch(item.id, e)}
                  title="Delete"
                >
                  ×
                </button>
                
                <div className="rcp-card-avatar">
                  {(item.companyName || item.domain).charAt(0).toUpperCase()}
                </div>
                
                <div className="rcp-card-content">
                  <h3 className="rcp-card-name">
                    {item.companyName || item.domain}
                  </h3>
                  <p className="rcp-card-domain">{item.domain}</p>
                </div>

                <div className="rcp-card-footer">
                  <span
                    className="rcp-status"
                    style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                  >
                    {item.status === 'completed' ? '✓ Complete' : item.status}
                  </span>
                  <span className="rcp-date">{formatDate(item.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .rcp-container {
          margin-bottom: 32px;
        }

        .rcp-header {
          margin-bottom: 24px;
        }

        .rcp-title {
          margin: 0 0 4px;
          font-size: 24px;
          font-weight: 700;
          color: #fff;
        }

        .rcp-subtitle {
          margin: 0;
          font-size: 14px;
          color: #64748b;
        }

        .rcp-controls {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .rcp-search {
          flex: 1;
          min-width: 200px;
          position: relative;
          display: flex;
          align-items: center;
        }

        .rcp-search-icon {
          position: absolute;
          left: 14px;
          font-size: 14px;
        }

        .rcp-search-input {
          width: 100%;
          padding: 12px 16px 12px 42px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          font-size: 14px;
          color: #fff;
          transition: all 0.2s ease;
        }

        .rcp-search-input::placeholder {
          color: #64748b;
        }

        .rcp-search-input:focus {
          outline: none;
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.05);
        }

        .rcp-sort {
          display: flex;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 4px;
        }

        .rcp-sort-btn {
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: #64748b;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .rcp-sort-btn:hover {
          color: #94a3b8;
        }

        .rcp-sort-btn.active {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }

        .rcp-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          text-align: center;
        }

        .rcp-empty-icon {
          font-size: 36px;
          margin-bottom: 12px;
        }

        .rcp-empty p {
          margin: 0;
          font-size: 15px;
          color: #94a3b8;
        }

        .rcp-empty-hint {
          margin-top: 8px;
          font-size: 13px;
          color: #64748b;
        }

        .rcp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .rcp-card {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .rcp-card:hover {
          background: rgba(255, 255, 255, 0.06);
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
        }

        .rcp-delete {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(239, 68, 68, 0.1);
          border: none;
          border-radius: 8px;
          color: #f87171;
          font-size: 18px;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s ease;
        }

        .rcp-card:hover .rcp-delete {
          opacity: 1;
        }

        .rcp-delete:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .rcp-card-avatar {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          border-radius: 12px;
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 16px;
        }

        .rcp-card-content {
          flex: 1;
          margin-bottom: 16px;
        }

        .rcp-card-name {
          margin: 0 0 4px;
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          line-height: 1.3;
        }

        .rcp-card-domain {
          margin: 0;
          font-size: 13px;
          color: #64748b;
        }

        .rcp-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .rcp-status {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }

        .rcp-date {
          font-size: 12px;
          color: #64748b;
        }

        @media (max-width: 640px) {
          .rcp-controls {
            flex-direction: column;
          }

          .rcp-search {
            min-width: 100%;
          }

          .rcp-sort {
            justify-content: center;
          }

          .rcp-grid {
            grid-template-columns: 1fr;
          }

          .rcp-delete {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default ResearchedCompanyPage;