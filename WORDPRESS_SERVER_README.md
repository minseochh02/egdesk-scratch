# WordPress Server Setup

This project includes a PHP server configuration to serve WordPress files alongside your Electron application.

## Prerequisites

1. **PHP**: Make sure PHP is installed on your system
   - macOS: `brew install php` or download from php.net
   - Windows: Download from php.net or use XAMPP/WAMP
   - Linux: `sudo apt-get install php` (Ubuntu/Debian) or `sudo yum install php` (CentOS/RHEL)

2. **Node.js**: Already included in this project

## Available Scripts

### Start WordPress Server Only
```bash
npm run wordpress:server
```
This starts a PHP server on port 8000 serving files from the `www/` directory.

### Start WordPress Server + Full Electron App
```bash
npm run wordpress:start
```
This starts both the WordPress server and the full Electron application concurrently.

### Start WordPress Server + Renderer Only
```bash
npm run wordpress:dev
```
This starts the WordPress server and only the renderer process for development.

## Directory Structure

The server will automatically detect and serve from the appropriate directory. It prioritizes:

1. **`www/` folder** - Your FTP WordPress structure (HTML files)
2. **`wordpress/` folder** - Standard WordPress installation
3. **`public_html/` folder** - Common hosting structure
4. **Current directory** - Fallback option

### www/ Folder Structure (Recommended)
```
www/
├── index.html         # Main entry point
├── about.html         # About page
├── contact.html       # Contact page
├── css/               # Stylesheets
├── js/                # JavaScript files
├── images/            # Image files
└── wp-content/        # WordPress content (if present)
```

### Standard WordPress Structure
```
wordpress/
├── wp-admin/          # WordPress admin files
├── wp-content/        # Themes, plugins, uploads
├── wp-includes/       # WordPress core files
├── index.php          # Main entry point
└── .htaccess         # URL rewriting rules
```

## Configuration

Edit `wordpress.config.js` to customize:
- Server port and host
- PHP executable path
- WordPress settings
- Development options
- Security settings

## Adding Real WordPress Files

### Option 1: FTP WordPress Files (Recommended for your setup)
1. Copy your WordPress files via FTP to the `www/` folder
2. Ensure your main HTML files are in the root of `www/`
3. Run the server - it will automatically detect the `www/` folder

### Option 2: Standard WordPress Installation
1. Download WordPress from wordpress.org
2. Extract to the `wordpress/` directory
3. Configure your database in `wp-config.php`
4. Run the server

## Database Setup (Optional)

If you want to use a real WordPress installation with a database:

1. Install MySQL/MariaDB
2. Create a database named 'wordpress'
3. Update the database configuration in `wordpress.config.js`
4. Run WordPress installation

## Troubleshooting

### PHP Not Found
- Ensure PHP is installed and in your PATH
- Update the `phpPath` in `wordpress.config.js`
- On macOS, you might need to use `/usr/local/bin/php` or `/opt/homebrew/bin/php`

### Port Already in Use
- Change the port in `wordpress.config.js`
- Kill any existing processes using the port: `lsof -ti:8000 | xargs kill -9`

### Permission Issues
- Ensure the `www/` directory is writable
- On Linux/macOS: `chmod -R 755 www/`

## Development Workflow

1. Start the WordPress server: `npm run wordpress:server`
2. Access your site at: `http://localhost:8000`
3. Make changes to HTML/PHP files in the `www/` directory
4. Refresh your browser to see changes

### For Your www/ Folder Setup
- The server will automatically detect your `www/` folder
- Your HTML files will be served directly
- No need for WordPress database setup
- Perfect for static WordPress exports or HTML-based sites

## Integration with Electron

The WordPress server runs independently of your Electron app, allowing you to:
- Develop WordPress themes and plugins
- Test WordPress functionality
- Use WordPress as a backend for your Electron app
- Serve WordPress content alongside your React components

## Security Notes

- This setup is for development only
- Don't use in production without proper security measures
- The server runs on localhost only by default
- Consider using HTTPS for production deployments
