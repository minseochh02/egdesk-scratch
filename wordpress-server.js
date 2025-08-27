const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class WordPressServer {
  constructor(options = {}) {
    this.port = options.port || 8000;
    this.host = options.host || 'localhost';
    this.root = options.root || this.detectWordPressRoot();
    this.phpPath = options.phpPath || '/opt/homebrew/bin/php';
    this.server = null;
  }

  detectWordPressRoot() {
    // Look for common WordPress folder structures
    const possibleRoots = [
      '/Users/minseocha/Desktop/projects/태화트랜스',  // Your actual PHP server files
      path.join(__dirname, 'www'),           // Your FTP structure
      path.join(__dirname, 'wordpress'),    // Standard WordPress folder
      path.join(__dirname, 'public_html'),  // Common hosting structure
      path.join(__dirname, 'public'),       // Alternative hosting structure
      path.join(__dirname, 'htdocs'),       // XAMPP structure
      __dirname                             // Current directory
    ];

    for (const root of possibleRoots) {
      if (this.isWordPressRoot(root)) {
        console.log(`Detected WordPress root: ${root}`);
        return root;
      }
    }

    // Default fallback
    console.log('No WordPress structure detected, using default');
    return path.join(__dirname, 'wordpress');
  }

  isWordPressRoot(dirPath) {
    if (!fs.existsSync(dirPath)) {
      return false;
    }

    // Check for WordPress core files
    const wordpressFiles = [
      'wp-config.php',
      'wp-config-sample.php',
      'wp-load.php',
      'wp-blog-header.php',
      'index.php'
    ];

    // Check for WordPress directories
    const wordpressDirs = [
      'wp-admin',
      'wp-content',
      'wp-includes'
    ];

    // Check for HTML files in www folder (your structure)
    const wwwFiles = fs.readdirSync(dirPath).filter(file => 
      file.endsWith('.html') || file.endsWith('.htm')
    );

    // If it's a www folder with HTML files, it's likely your structure
    if (dirPath.includes('www') && wwwFiles.length > 0) {
      console.log(`Found www folder with ${wwwFiles.length} HTML files`);
      return true;
    }

    // Check for WordPress core files
    const hasWordPressFiles = wordpressFiles.some(file => 
      fs.existsSync(path.join(dirPath, file))
    );

    // Check for WordPress directories
    const hasWordPressDirs = wordpressDirs.some(dir => 
      fs.existsSync(path.join(dirPath, dir))
    );

    return hasWordPressFiles || hasWordPressDirs;
  }

  start() {
    console.log(`Starting WordPress server on http://${this.host}:${this.port}`);
    console.log(`Serving from: ${this.root}`);
    
    // Check what we're serving
    if (fs.existsSync(this.root)) {
      const files = fs.readdirSync(this.root);
      const htmlFiles = files.filter(f => f.endsWith('.html') || f.endsWith('.htm'));
      const phpFiles = files.filter(f => f.endsWith('.php'));
      const folders = files.filter(f => fs.statSync(path.join(this.root, f)).isDirectory());
      
      console.log(`Found ${files.length} total files/directories`);
      if (htmlFiles.length > 0) console.log(`HTML files: ${htmlFiles.length}`);
      if (phpFiles.length > 0) console.log(`PHP files: ${phpFiles.length}`);
      if (folders.length > 0) console.log(`Folders: ${folders.join(', ')}`);
      
      // If it's a www folder with HTML files, show the main entry points
      if (this.root.includes('www') && htmlFiles.length > 0) {
        console.log(`\n🌐 Main HTML files available:`);
        htmlFiles.forEach(file => {
          console.log(`   http://${this.host}:${this.port}/${file}`);
        });
      }
    } else {
      console.log('Root directory not found, creating sample structure...');
      this.createSampleWordPress();
    }

    // Start PHP server
    this.server = spawn(this.phpPath, [
      '-S', 
      `${this.host}:${this.port}`,
      '-t', 
      this.root
    ]);

    this.server.stdout.on('data', (data) => {
      console.log(`WordPress Server: ${data}`);
    });

    this.server.stderr.on('data', (data) => {
      console.error(`WordPress Server Error: ${data}`);
    });

    this.server.on('close', (code) => {
      console.log(`WordPress Server stopped with code ${code}`);
    });

    return this.server;
  }

  stop() {
    if (this.server) {
      this.server.kill();
      this.server = null;
      console.log('WordPress server stopped');
    }
  }

  createSampleWordPress() {
    // Create a basic structure that matches your www folder approach
    const dirs = [
      'www',
      'www/css',
      'www/js',
      'www/images'
    ];

    dirs.forEach(dir => {
      const fullPath = path.join(__dirname, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });

    // Create a sample index.html in www folder
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WordPress Server - www Folder</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            margin: 0; 
            padding: 0; 
            background: #f1f1f1; 
        }
        .container { 
            max-width: 800px; 
            margin: 50px auto; 
            padding: 20px; 
        }
        .header { 
            background: #0073aa; 
            color: white; 
            padding: 30px 20px; 
            border-radius: 8px; 
            margin-bottom: 30px; 
            text-align: center; 
        }
        .content { 
            background: white; 
            padding: 30px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .file-list {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .file-item {
            padding: 10px;
            border-bottom: 1px solid #dee2e6;
        }
        .file-item:last-child {
            border-bottom: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌐 WordPress Server Running</h1>
            <p>PHP server is successfully serving from www folder</p>
        </div>
        <div class="content">
            <h2>Server Information</h2>
            <p><strong>Server Time:</strong> <span id="server-time"></span></p>
            <p><strong>Document Root:</strong> <span id="doc-root"></span></p>
            
            <div class="file-list">
                <h3>📁 Available Files</h3>
                <div class="file-item">index.html - This file</div>
                <div class="file-item">css/ - Stylesheets</div>
                <div class="file-item">js/ - JavaScript files</div>
                <div class="file-item">images/ - Image files</div>
            </div>
            
            <p><strong>💡 Tip:</strong> Place your WordPress HTML files in the www folder to serve them.</p>
        </div>
    </div>
    
    <script>
        document.getElementById('server-time').textContent = new Date().toLocaleString();
        document.getElementById('doc-root').textContent = window.location.origin;
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(__dirname, 'www', 'index.html'), indexHtml);

    console.log('Sample www folder structure created with index.html');
  }
}

module.exports = WordPressServer;

// If run directly
if (require.main === module) {
  const server = new WordPressServer();
  server.start();
  
  process.on('SIGINT', () => {
    console.log('\nShutting down WordPress server...');
    server.stop();
    process.exit(0);
  });
}
