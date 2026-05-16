import * as acme from 'acme-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { getStore } from '../storage';
import { randomUUID } from 'crypto';

export interface SSLCertificate {
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

export class SSLCertificateService {
  private static instance: SSLCertificateService | null = null;
  private store = getStore();
  private challengeStore = new Map<string, string>();

  private constructor() {}

  public static getInstance(): SSLCertificateService {
    if (!SSLCertificateService.instance) {
      SSLCertificateService.instance = new SSLCertificateService();
    }
    return SSLCertificateService.instance;
  }

  /**
   * Get the challenge response for a given token
   */
  public getChallengeResponse(token: string): string | undefined {
    return this.challengeStore.get(token);
  }

  /**
   * Generate a self-signed certificate for local use
   */
  public async generateSelfSigned(domain: string): Promise<SSLCertificate> {
    console.log(`🔐 Generating self-signed certificate for ${domain}...`);
    
    const tempDir = path.join(os.tmpdir(), 'egdesk-ssl-gen');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const keyPath = path.join(tempDir, 'server.key');
    const certPath = path.join(tempDir, 'server.crt');
    const configPath = path.join(tempDir, 'openssl.conf');

    // Create OpenSSL config for SAN (Subject Alternative Name) support
    // This allows the cert to work for both localhost and the local IP
    const networkInfo = await this.getLocalIPInfo();
    const localIP = networkInfo.localIP;

    const opensslConfig = `
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no
[req_distinguished_name]
CN = ${domain}
[v3_req]
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
[alt_names]
DNS.1 = localhost
DNS.2 = ${domain}
IP.1 = 127.0.0.1
${localIP !== 'localhost' ? `IP.2 = ${localIP}` : ''}
`.trim();

    fs.writeFileSync(configPath, opensslConfig);

    try {
      const { execSync } = require('child_process');
      // Generate key and self-signed cert in one command
      execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -config "${configPath}"`, { stdio: 'inherit' });

      const certificate = fs.readFileSync(certPath, 'utf8');
      const privateKey = fs.readFileSync(keyPath, 'utf8');

      const newCert: SSLCertificate = {
        id: randomUUID(),
        domain,
        certificate,
        privateKey,
        issuer: 'EGDesk Self-Signed CA',
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        isExpired: false,
      };

      this.saveCertificate(newCert);
      
      // Cleanup temp files
      fs.unlinkSync(keyPath);
      fs.unlinkSync(certPath);
      fs.unlinkSync(configPath);

      return newCert;
    } catch (error) {
      console.error('❌ Failed to generate self-signed certificate:', error);
      throw error;
    }
  }

  /**
   * Helper to get local IP info
   */
  private async getLocalIPInfo(): Promise<{ localIP: string }> {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return { localIP: iface.address };
        }
      }
    }
    return { localIP: 'localhost' };
  }

  /**
   * Generate a trusted local certificate using mkcert
   */
  public async generateTrustedLocal(domain: string): Promise<SSLCertificate> {
    console.log(`🔐 Generating trusted local certificate for ${domain} using mkcert...`);

    try {
      const { execSync } = require('child_process');
      const sudo = require('sudo-prompt');

      // 1. Check if mkcert is installed, install if missing via brew
      try {
        execSync('mkcert -version');
      } catch (e) {
        console.log('missing mkcert, attempting to install via brew using native prompt...');
        const osaScript = `do shell script "brew install mkcert" with administrator privileges`;
        try {
          execSync(`osascript -e '${osaScript}'`);
          console.log('✅ mkcert installed via brew');
        } catch (brewError: any) {
          console.error('Failed to install mkcert via brew:', brewError.message);
          throw new Error('mkcert not found and brew install failed');
        }
      }

      // 2. Ensure local CA is installed
      // We'll skip the direct execSync('mkcert -install') because it often triggers terminal sudo
      // Instead, we'll check if we have permissions to read the CA key first
      const mkcertDir = path.join(os.homedir(), 'Library/Application Support/mkcert');
      const rootCAKeyPath = path.join(mkcertDir, 'rootCA-key.pem');
      
      let needsInstall = false;
      try {
        if (!fs.existsSync(rootCAKeyPath)) {
          needsInstall = true;
        } else {
          // Try to read it to check permissions
          fs.accessSync(rootCAKeyPath, fs.constants.R_OK);
        }
      } catch (e) {
        needsInstall = true;
      }

      if (needsInstall) {
        console.log('🚀 mkcert needs installation or permission fix, triggering native prompt...');
        const user = os.userInfo().username;
        const shellCommand = [
          `mkdir -p "${mkcertDir}"`,
          `chown -R ${user} "${mkcertDir}"`,
          `chmod -R u+rw "${mkcertDir}"`,
          `mkcert -install`
        ].join(' && ');

        const osaScript = `do shell script "${shellCommand.replace(/"/g, '\\"')}" with administrator privileges`;
        
        try {
          execSync(`osascript -e '${osaScript}'`);
          console.log('✅ Native macOS permission fix and mkcert -install succeeded');
        } catch (osaError: any) {
          console.error('❌ Native macOS prompt failed:', osaError.message);
          throw osaError;
        }
      }

      const tempDir = path.join(os.tmpdir(), 'egdesk-mkcert');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const keyPath = path.join(tempDir, `${domain}.key`);
      const certPath = path.join(tempDir, `${domain}.crt`);

      // 3. Generate certificate
      const networkInfo = await this.getLocalIPInfo();
      const localIP = networkInfo.localIP;
      const hosts = ['localhost', '127.0.0.1', domain];
      if (localIP !== 'localhost') hosts.push(localIP);

      try {
        execSync(`mkcert -key-file "${keyPath}" -cert-file "${certPath}" ${hosts.join(' ')}`);
      } catch (genError: any) {
        console.warn('mkcert generation failed, attempting with native macOS prompt...', genError.message);
        
        const shellCommand = `mkcert -key-file "${keyPath}" -cert-file "${certPath}" ${hosts.join(' ')}`;
        const osaScript = `do shell script "${shellCommand.replace(/"/g, '\\"')}" with administrator privileges`;
        
        try {
          execSync(`osascript -e '${osaScript}'`);
          console.log('✅ Native macOS certificate generation succeeded');
        } catch (osaError: any) {
          console.error('❌ Native macOS prompt for generation failed:', osaError.message);
          throw osaError;
        }
      }

      const certificate = fs.readFileSync(certPath, 'utf8');
      const privateKey = fs.readFileSync(keyPath, 'utf8');

      const newCert: SSLCertificate = {
        id: randomUUID(),
        domain,
        certificate,
        privateKey,
        issuer: 'mkcert development CA',
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        isExpired: false,
      };

      this.saveCertificate(newCert);

      // Cleanup
      if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
      if (fs.existsSync(certPath)) fs.unlinkSync(certPath);

      return newCert;
    } catch (error) {
      console.error('❌ Failed to generate trusted local certificate:', error);
      throw error;
    }
  }

  public async autoInitialize(): Promise<void> {
    const certs = this.listCertificates();
    console.log(`🔍 SSL: autoInitialize checking certificates (count: ${certs.length})`);
    if (certs.length === 0) {
      console.log('🚀 No SSL certificates found. Auto-generating trusted local certificate...');
      try {
        await this.generateTrustedLocal('egdesk.local');
        console.log('✅ Auto-generated initial trusted local certificate');
      } catch (error) {
        console.error('❌ Failed to auto-initialize SSL with mkcert, falling back to self-signed:', error);
        try {
          // If mkcert fails, we MUST fallback to self-signed so the app can start
          await this.generateSelfSigned('egdesk.local');
          console.log('✅ Fallback: Auto-generated initial self-signed certificate');
        } catch (fallbackError) {
          console.error('❌ CRITICAL: Failed fallback auto-initialization:', fallbackError);
        }
      }
    } else {
      const activeId = this.getActiveCertificateId();
      console.log(`ℹ️ SSL: Certificates already exist. Active ID: ${activeId}`);
    }
  }

  /**
   * Generate a Let's Encrypt certificate
   */
  public async generateCertificate(domain: string, email?: string): Promise<SSLCertificate> {
    console.log(`🔐 Generating Let's Encrypt certificate for ${domain}...`);

    try {
      // 1. Initialize ACME client
      const client = new acme.Client({
        directoryUrl: acme.directory.letsencrypt.production,
        accountKey: await acme.crypto.createPrivateKey(),
      });

      // 2. Create account
      await client.createAccount({
        termsOfServiceAgreed: true,
        contact: email ? [`mailto:${email}`] : [],
      });

      // 3. Create order
      const order = await client.createOrder({
        identifiers: [{ type: 'dns', value: domain }],
      });

      // 4. Get authorizations
      const authorizations = await client.getAuthorizations(order);
      const auth = authorizations[0];
      const challenge = auth.challenges.find((c) => c.type === 'http-01');

      if (!challenge) {
        throw new Error('HTTP-01 challenge not found');
      }

      // 5. Prepare challenge response
      const keyAuthorization = await client.getChallengeKeyAuthorization(challenge);
      this.challengeStore.set(challenge.token, keyAuthorization);

      console.log(`📝 Challenge prepared for ${domain}. Token: ${challenge.token}`);

      // 6. Notify ACME server that challenge is ready
      // Note: The caller (LocalServerManager) must be serving /.well-known/acme-challenge/
      await client.completeChallenge(challenge);

      // 7. Wait for validation
      await client.waitForValidStatus(challenge);
      console.log(`✅ Challenge validated for ${domain}`);

      // 8. Finalize order
      const [key, csr] = await acme.crypto.createCsr({
        commonName: domain,
      });

      const finalized = await client.finalizeOrder(order, csr);
      const cert = await client.getCertificate(finalized);

      // 9. Parse certificate info
      const certInfo = acme.crypto.readCertificateInfo(cert);
      
      const newCert: SSLCertificate = {
        id: randomUUID(),
        domain,
        certificate: cert.toString(),
        privateKey: key.toString(),
        issuer: certInfo.issuer.commonName || 'Let\'s Encrypt',
        validFrom: certInfo.notBefore.toISOString(),
        validTo: certInfo.notAfter.toISOString(),
        createdAt: new Date().toISOString(),
        isExpired: false,
      };

      // 10. Save to store
      this.saveCertificate(newCert);
      
      // Set as active by default if it's the first one or if requested
      const currentActive = this.getActiveCertificateId();
      if (!currentActive) {
        this.setActiveCertificateId(newCert.id);
        console.log(`✨ Set ${domain} as the active certificate by default`);
      }
      
      // Cleanup challenge
      this.challengeStore.delete(challenge.token);

      return newCert;
    } catch (error) {
      console.error(`❌ Failed to generate certificate for ${domain}:`, error);
      throw error;
    }
  }

  private saveCertificate(cert: SSLCertificate): void {
    const certs = this.store.get('sslCertificates', []) as SSLCertificate[];
    certs.push(cert);
    this.store.set('sslCertificates', certs);
  }

  public listCertificates(): SSLCertificate[] {
    const certs = this.store.get('sslCertificates', []) as SSLCertificate[];
    const now = new Date();
    return certs.map(c => ({
      ...c,
      isExpired: new Date(c.validTo) < now
    }));
  }

  public getCertificate(id: string): SSLCertificate | undefined {
    const certs = this.listCertificates();
    return certs.find(c => c.id === id);
  }

  public deleteCertificate(id: string): void {
    const certs = this.listCertificates();
    const filtered = certs.filter(c => c.id !== id);
    this.store.set('sslCertificates', filtered);
    
    // Clear active ID if it was deleted
    if (this.getActiveCertificateId() === id) {
      this.setActiveCertificateId(null);
    }
  }

  public getActiveCertificateId(): string | null {
    const activeId = this.store.get('activeSSLCertificateId') as string | null;
    if (activeId) return activeId;

    // If no active ID but certificates exist, pick the first valid one
    const certs = this.listCertificates();
    const firstValid = certs.find(c => !c.isExpired);
    if (firstValid) {
      this.setActiveCertificateId(firstValid.id);
      return firstValid.id;
    }

    return null;
  }

  public setActiveCertificateId(id: string | null): void {
    this.store.set('activeSSLCertificateId', id);
  }
}
