/**
 * SkillsetLibrary - Main UI for managing website skillsets
 * Shows all explored websites and their health status
 */

import React, { useState, useEffect } from 'react';
import './SkillsetLibrary.css';

interface WebsiteSkillset {
  id: string;
  url: string;
  siteName: string;
  siteType?: string;
  overallConfidence: number;
  staleCount: number;
  explorationCount: number;
  usageCount: number;
  lastExploredAt?: string;
  lastUsedAt?: string;
}

interface WebsiteHealth {
  status: 'excellent' | 'good' | 'needs-update' | 'poor';
  overallConfidence: number;
  staleCount: number;
  lowConfidenceCount: number;
  recentFailures: number;
}

export const SkillsetLibrary: React.FC = () => {
  const [websites, setWebsites] = useState<WebsiteSkillset[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<string | null>(null);
  const [healthStatuses, setHealthStatuses] = useState<Record<string, WebsiteHealth>>({});
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    loadWebsites();
  }, []);

  const loadWebsites = async () => {
    try {
      setLoading(true);
      const result = await window.electron.ipcRenderer.invoke('skillset:list-websites');
      setWebsites(result || []);

      // Load health status for each website
      const healthPromises = result.map(async (website: WebsiteSkillset) => {
        const health = await window.electron.ipcRenderer.invoke(
          'skillset:get-website-health',
          website.id
        );
        return { websiteId: website.id, health };
      });

      const healthResults = await Promise.all(healthPromises);
      const healthMap: Record<string, WebsiteHealth> = {};
      healthResults.forEach(({ websiteId, health }) => {
        healthMap[websiteId] = health;
      });
      setHealthStatuses(healthMap);
    } catch (error) {
      console.error('Failed to load websites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWebsite = async (websiteId: string) => {
    if (!confirm('Are you sure you want to delete this website from your Skillset library?')) {
      return;
    }

    try {
      await window.electron.ipcRenderer.invoke('skillset:delete-website', websiteId);
      await loadWebsites();
    } catch (error) {
      console.error('Failed to delete website:', error);
      alert('Failed to delete website. Please try again.');
    }
  };

  const getHealthIcon = (status: string): string => {
    switch (status) {
      case 'excellent':
        return '⚡';
      case 'good':
        return '✓';
      case 'needs-update':
        return '⚠️';
      case 'poor':
        return '❌';
      default:
        return '?';
    }
  };

  const getHealthColor = (status: string): string => {
    switch (status) {
      case 'excellent':
        return '#4CAF50';
      case 'good':
        return '#8BC34A';
      case 'needs-update':
        return '#FF9800';
      case 'poor':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="skillset-library">
        <div className="skillset-header">
          <h2>🌐 Website Skillset Library</h2>
        </div>
        <div className="skillset-loading">Loading skillsets...</div>
      </div>
    );
  }

  if (websites.length === 0) {
    return (
      <div className="skillset-library">
        <div className="skillset-header">
          <h2>🌐 Website Skillset Library</h2>
        </div>
        <div className="skillset-empty">
          <p>No websites in your Skillset library yet.</p>
          <p>
            Explore a website in the ROOKIE workflow to add it to your library.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="skillset-library">
      <div className="skillset-header">
        <h2>🌐 Website Skillset Library</h2>
        <p className="skillset-subtitle">
          Explored Websites ({websites.length})
        </p>
      </div>

      <div className="skillset-list">
        {websites.map((website) => {
          const health = healthStatuses[website.id];
          const confidencePercent = Math.round(website.overallConfidence * 100);

          return (
            <div key={website.id} className="skillset-card">
              <div className="skillset-card-header">
                <div className="skillset-card-title">
                  <h3>{website.siteName}</h3>
                  {health && (
                    <span
                      className="skillset-health-badge"
                      style={{ color: getHealthColor(health.status) }}
                    >
                      {getHealthIcon(health.status)} {confidencePercent}%
                    </span>
                  )}
                </div>
                <div className="skillset-card-url">{website.url}</div>
              </div>

              <div className="skillset-card-stats">
                <div className="skillset-stat">
                  <strong>Last explored:</strong> {formatDate(website.lastExploredAt)}
                </div>
                <div className="skillset-stat">
                  <strong>Last used:</strong> {formatDate(website.lastUsedAt)}
                </div>
                <div className="skillset-stat">
                  <strong>Usage:</strong> {website.usageCount} reports
                </div>
                {health && health.status !== 'excellent' && (
                  <div className="skillset-issues">
                    {health.lowConfidenceCount > 0 && (
                      <div className="skillset-issue">
                        • {health.lowConfidenceCount} low confidence capabilities
                      </div>
                    )}
                    {health.staleCount > 0 && (
                      <div className="skillset-issue">
                        • {health.staleCount} stale capabilities
                      </div>
                    )}
                    {health.recentFailures > 0 && (
                      <div className="skillset-issue">
                        • {health.recentFailures} recent failures
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="skillset-card-actions">
                <button
                  className="skillset-btn skillset-btn-primary"
                  onClick={() => {
                    setSelectedWebsite(website.id);
                    setShowDetail(true);
                  }}
                >
                  View Details
                </button>
                <button
                  className="skillset-btn skillset-btn-danger"
                  onClick={() => handleDeleteWebsite(website.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showDetail && selectedWebsite && (
        <div className="skillset-modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="skillset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="skillset-modal-header">
              <h2>Website Details</h2>
              <button
                className="skillset-modal-close"
                onClick={() => setShowDetail(false)}
              >
                ×
              </button>
            </div>
            <div className="skillset-modal-content">
              <p>Detailed view coming soon...</p>
              <p>Website ID: {selectedWebsite}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
