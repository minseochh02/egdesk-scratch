import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLock, 
  faShieldAlt, 
  faSpinner, 
  faCheckCircle, 
  faExclamationTriangle,
  faTrash,
  faPlus,
  faGlobe,
  faPlay
} from '../../utils/fontAwesomeIcons';

interface SSLCertificate {
  id: string;
  domain: string;
  certificate: string;
  privateKey: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  createdAt: string;
  isExpired: boolean;
}

const SSLCertificateSection: React.FC = () => {
  const [certificates, setCertificates] = useState<SSLCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCertificates();
  }, []);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const result = await (window as any).electron.sslCertificate.list();
      if (result.success) {
        setCertificates(result.certificates);
      }
    } catch (err) {
      console.error('Failed to load certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!domain) {
      alert('Please enter a domain name');
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      
      const result = await (window as any).electron.sslCertificate.generate({
        domain,
        email
      });

      if (result.success) {
        alert(`✅ SSL Certificate generated successfully for ${domain}!`);
        setDomain('');
        setEmail('');
        await loadCertificates();
      } else {
        setError(result.error || 'Failed to generate certificate');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateLocal = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      const result = await (window as any).electron.invoke('ssl-certificate-generate-local', {
        domain: domain || 'egdesk.local'
      });

      if (result.success) {
        alert(`✅ Locally trusted certificate generated!`);
        setDomain('');
        await loadCertificates();
      } else {
        setError(result.error || 'Failed to generate local certificate');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this certificate?')) return;

    try {
      const result = await (window as any).electron.sslCertificate.delete(id);
      if (result.success) {
        await loadCertificates();
      }
    } catch (err) {
      console.error('Failed to delete certificate:', err);
    }
  };

  const handleUseCertificate = async (id: string) => {
    try {
      // Set as active certificate for dev servers
      await (window as any).electron.invoke('ssl-certificate:set-active', id);

      // First stop the server if it's running
      await (window as any).electron.httpsServer.stop();
      
      // Start with the selected certificate
      const result = await (window as any).electron.httpsServer.start({
        port: 8080,
        useHTTPS: true,
        certificateId: id
      });

      if (result.success) {
        alert('✅ Server restarted with SSL certificate! Project servers will now also use this certificate.');
      } else {
        alert(`❌ Failed to start HTTPS server: ${result.error}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="ssl-certificate-section">
      <div className="section-header">
        <div className="header-icon">
          <FontAwesomeIcon icon={faShieldAlt} />
        </div>
        <div className="header-text">
          <h3>SSL Certificates (Let's Encrypt)</h3>
          <p>Generate and manage free SSL certificates for your custom domains</p>
        </div>
      </div>

      <div className="generate-form">
        <div className="form-row">
          <div className="form-group">
            <label>Domain Name</label>
            <div className="input-with-icon">
              <FontAwesomeIcon icon={faGlobe} />
              <input 
                type="text" 
                placeholder="e.g. yourdomain.com" 
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={generating}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Email (Optional)</label>
            <div className="input-with-icon">
              <FontAwesomeIcon icon={faPlus} />
              <input 
                type="email" 
                placeholder="email@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={generating}
              />
            </div>
          </div>
          <button 
            className="generate-btn" 
            onClick={handleGenerate}
            disabled={generating || !domain}
          >
            {generating ? (
              <><FontAwesomeIcon icon={faSpinner} spin /> Generating...</>
            ) : (
              <><FontAwesomeIcon icon={faLock} /> Generate Certificate</>
            )}
          </button>
          <button 
            className="generate-btn secondary" 
            onClick={handleGenerateLocal}
            disabled={generating}
          >
            {generating ? (
              <><FontAwesomeIcon icon={faSpinner} spin /> Generating...</>
            ) : (
              <><FontAwesomeIcon icon={faShieldAlt} /> Generate Local Trusted</>
            )}
          </button>
        </div>
        
        {error && (
          <div className="error-message">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <span>{error}</span>
          </div>
        )}
        
        <div className="info-note">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <p>Note: Let's Encrypt requires your domain to be publicly accessible via the EGDesk tunnel for verification.</p>
        </div>
      </div>

      <div className="certificates-list">
        <h4>Your Certificates</h4>
        {loading ? (
          <div className="loading-state">
            <FontAwesomeIcon icon={faSpinner} spin />
            <p>Loading certificates...</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="empty-state">
            <p>No certificates generated yet.</p>
          </div>
        ) : (
          <div className="cert-grid">
            {certificates.map(cert => (
              <div key={cert.id} className={`cert-card ${cert.isExpired ? 'expired' : ''}`}>
                <div className="cert-header">
                  <span className="cert-domain">{cert.domain}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {cert.issuer.includes('Self-Signed') && (
                      <span className="cert-type-badge">Self-Signed</span>
                    )}
                    <span className={`cert-status ${cert.isExpired ? 'expired' : 'valid'}`}>
                      {cert.isExpired ? 'Expired' : 'Valid'}
                    </span>
                  </div>
                </div>
                <div className="cert-details">
                  <div className="detail-item">
                    <span className="label">Issuer:</span>
                    <span className="value">{cert.issuer}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Expires:</span>
                    <span className="value">{new Date(cert.validTo).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="cert-actions">
                  <button className="use-btn" onClick={() => handleUseCertificate(cert.id)}>
                    <FontAwesomeIcon icon={faPlay} /> Use
                  </button>
                  <button className="delete-btn" onClick={() => handleDelete(cert.id)}>
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ssl-certificate-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          margin-top: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          color: #1a1a1a;
        }
        .section-header {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          align-items: center;
        }
        .header-icon {
          width: 48px;
          height: 48px;
          background: #eff6ff;
          color: #3b82f6;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        .header-text h3 { margin: 0; font-size: 18px; font-weight: 700; }
        .header-text p { margin: 4px 0 0 0; font-size: 14px; color: #6b7280; }
        
        .generate-form {
          background: #f9fafb;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 24px;
        }
        .form-row {
          display: flex;
          gap: 16px;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        .form-group {
          flex: 1;
          min-width: 200px;
        }
        .form-group label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #4b5563;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-with-icon svg {
          position: absolute;
          left: 12px;
          color: #9ca3af;
        }
        .input-with-icon input {
          width: 100%;
          padding: 10px 12px 10px 36px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
        }
        .generate-btn {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          height: 40px;
        }
        .generate-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .generate-btn.secondary {
          background: #10b981;
        }
        .generate-btn.secondary:hover:not(:disabled) {
          background: #059669;
        }
        
        .error-message {
          margin-top: 12px;
          color: #dc2626;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .info-note {
          margin-top: 16px;
          display: flex;
          gap: 8px;
          font-size: 12px;
          color: #6b7280;
          background: #fffbeb;
          padding: 10px;
          border-radius: 6px;
          border-left: 4px solid #f59e0b;
        }
        .info-note p { margin: 0; }
        
        .certificates-list h4 { margin: 0 0 16px 0; font-size: 16px; }
        .cert-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .cert-card {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          position: relative;
        }
        .cert-card.expired { border-color: #fecaca; background: #fffafb; }
        .cert-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .cert-domain { font-weight: 700; font-size: 15px; }
        .cert-status {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          text-transform: uppercase;
          font-weight: 700;
        }
        .cert-status.valid { background: #d1fae5; color: #065f46; }
        .cert-status.expired { background: #fee2e2; color: #991b1b; }
        .cert-type-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          background: #f3f4f6;
          color: #4b5563;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .detail-item { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
        .detail-item .label { color: #6b7280; }
        .cert-actions {
          margin-top: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .use-btn {
          background: #10b981;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .use-btn:hover { background: #059669; }
        .cert-actions .delete-btn {
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          transition: color 0.2s;
        }
        .cert-actions .delete-btn:hover { color: #dc2626; }
      `}} />
    </div>
  );
};

export default SSLCertificateSection;
