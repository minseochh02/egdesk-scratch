const fs = require('fs');
const path = require('path');

class WordPressSetup {
  constructor() {
    this.wordpressDir = path.join(__dirname, 'wordpress');
  }

  setup() {
    console.log('Setting up WordPress directory structure...');
    
    try {
      // Create WordPress directory structure
      this.createDirectories();
      
      // Create sample WordPress files
      this.createIndexPhp();
      this.createHtaccess();
      this.createWpConfigSample();
      this.createSampleTheme();
      this.createSamplePlugin();
      
      console.log('WordPress setup completed successfully!');
      console.log(`WordPress files are located in: ${this.wordpressDir}`);
      console.log('You can now run: npm run wordpress:server');
      
    } catch (error) {
      console.error('Error setting up WordPress:', error);
    }
  }

  createDirectories() {
    const dirs = [
      'wp-admin',
      'wp-includes',
      'wp-content',
      'wp-content/themes',
      'wp-content/plugins',
      'wp-content/uploads',
      'wp-content/languages'
    ];

    dirs.forEach(dir => {
      const fullPath = path.join(this.wordpressDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }

  createIndexPhp() {
    const indexPhp = `<?php
/**
 * WordPress Sample Index
 * 
 * This is a sample WordPress index.php file for development purposes.
 * In a real WordPress installation, this would be the main entry point.
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}

// Sample WordPress-like functionality
function wp_head() {
    echo '<meta charset="UTF-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
    echo '<title>WordPress Development Server</title>';
}

function wp_footer() {
    echo '<script>console.log("WordPress footer loaded");</script>';
}

function get_header() {
    echo '<!DOCTYPE html>';
    echo '<html lang="en">';
    echo '<head>';
    wp_head();
    echo '<style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            margin: 0; 
            padding: 0; 
            background: #f1f1f1; 
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
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
        .wp-info { 
            background: #f8f9fa; 
            border: 1px solid #dee2e6; 
            border-radius: 6px; 
            padding: 20px; 
            margin: 20px 0; 
        }
        .wp-info h3 { 
            color: #495057; 
            margin-top: 0; 
        }
        .wp-info p { 
            margin: 10px 0; 
            color: #6c757d; 
        }
        .wp-info strong { 
            color: #495057; 
        }
        .footer { 
            text-align: center; 
            margin-top: 30px; 
            color: #6c757d; 
        }
        .nav { 
            background: #f8f9fa; 
            padding: 15px 20px; 
            border-radius: 6px; 
            margin-bottom: 20px; 
        }
        .nav a { 
            color: #0073aa; 
            text-decoration: none; 
            margin-right: 20px; 
            padding: 5px 10px; 
            border-radius: 4px; 
            transition: background 0.2s; 
        }
        .nav a:hover { 
            background: #e9ecef; 
        }
    </style>';
    echo '</head>';
    echo '<body>';
    echo '<div class="container">';
    echo '<div class="header">';
    echo '<h1>WordPress Development Server</h1>';
    echo '<p>PHP server is successfully serving WordPress files</p>';
    echo '</div>';
    
    echo '<div class="nav">';
    echo '<a href="/">Home</a>';
    echo '<a href="/wp-admin/">Admin</a>';
    echo '<a href="/wp-content/themes/">Themes</a>';
    echo '<a href="/wp-content/plugins/">Plugins</a>';
    echo '</div>';
}

function get_footer() {
    echo '<div class="footer">';
    echo '<p>&copy; 2025 WordPress Development Server</p>';
    echo '</div>';
    echo '</div>';
    wp_footer();
    echo '</body>';
    echo '</html>';
}

// Display the page
get_header();

echo '<div class="content">';
echo '<h2>Welcome to WordPress Development Server</h2>';
echo '<p>This is a sample WordPress installation running on your local PHP server.</p>';

echo '<div class="wp-info">';
echo '<h3>Server Information</h3>';
echo '<p><strong>PHP Version:</strong> ' . phpversion() . '</p>';
echo '<p><strong>Server Time:</strong> ' . date('Y-m-d H:i:s') . '</p>';
echo '<p><strong>Document Root:</strong> ' . $_SERVER['DOCUMENT_ROOT'] . '</p>';
echo '<p><strong>Request URI:</strong> ' . $_SERVER['REQUEST_URI'] . '</p>';
echo '<p><strong>Server Software:</strong> ' . $_SERVER['SERVER_SOFTWARE'] . '</p>';
echo '</div>';

echo '<div class="wp-info">';
echo '<h3>WordPress Structure</h3>';
echo '<p><strong>wp-admin/</strong> - WordPress administration files</p>';
echo '<p><strong>wp-content/</strong> - Themes, plugins, and uploads</p>';
echo '<p><strong>wp-includes/</strong> - WordPress core files</p>';
echo '<p><strong>wp-content/themes/</strong> - WordPress themes directory</p>';
echo '<p><strong>wp-content/plugins/</strong> - WordPress plugins directory</p>';
echo '</div>';

echo '<div class="wp-info">';
echo '<h3>Next Steps</h3>';
echo '<p>1. Download WordPress from <a href="https://wordpress.org" target="_blank">wordpress.org</a></p>';
echo '<p>2. Extract WordPress files to this directory</p>';
echo '<p>3. Configure your database in wp-config.php</p>';
echo '<p>4. Run WordPress installation</p>';
echo '</div>';

echo '</div>';

get_footer();
?>`;

    fs.writeFileSync(path.join(this.wordpressDir, 'index.php'), indexPhp);
    console.log('Created: index.php');
  }

  createHtaccess() {
    const htaccess = `# WordPress .htaccess
# This file provides URL rewriting for WordPress

RewriteEngine On
RewriteBase /

# Handle WordPress core files
RewriteRule ^index\\.php$ - [L]

# Handle static files
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d

# Route all other requests to index.php
RewriteRule . /index.php [L]

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
</IfModule>

# Prevent access to sensitive files
<FilesMatch "^\\.(htaccess|htpasswd|ini|log|sh|sql|conf)$">
    Order Allow,Deny
    Deny from all
</FilesMatch>

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>`;

    fs.writeFileSync(path.join(this.wordpressDir, '.htaccess'), htaccess);
    console.log('Created: .htaccess');
  }

  createWpConfigSample() {
    const wpConfigSample = `<?php
/**
 * WordPress Configuration Sample
 * 
 * This is a sample wp-config.php file for development purposes.
 * Copy this to wp-config.php and modify the values for your setup.
 */

// ** MySQL settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'wordpress' );

/** MySQL database username */
define( 'DB_USER', 'root' );

/** MySQL database password */
define( 'DB_PASSWORD', '' );

/** MySQL hostname */
define( 'DB_HOST', 'localhost' );

/** Database Charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8' );

/** The Database Collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication Unique Keys and Salts.
 *
 * Change these to different unique phrases!
 * You can generate these using the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}
 * You can change these at any point in time to invalidate all existing cookies. This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         'put your unique phrase here' );
define( 'SECURE_AUTH_KEY',  'put your unique phrase here' );
define( 'LOGGED_IN_KEY',    'put your unique phrase here' );
define( 'NONCE_KEY',        'put your unique phrase here' );
define( 'AUTH_SALT',        'put your unique phrase here' );
define( 'SECURE_AUTH_SALT', 'put your unique phrase here' );
define( 'LOGGED_IN_SALT',   'put your unique phrase here' );
define( 'NONCE_SALT',       'put your unique phrase here' );

/**#@-*/

/**
 * WordPress Database Table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://wordpress.org/support/article/debugging-in-wordpress/
 */
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );

// Disable automatic updates for development
define( 'AUTOMATIC_UPDATER_DISABLED', true );

// Disable file editing in admin for security
define( 'DISALLOW_FILE_EDIT', true );

// Set memory limit
define( 'WP_MEMORY_LIMIT', '256M' );

// Set maximum upload size
define( 'WP_MAX_MEMORY_LIMIT', '512M' );

/* Add any custom values between this line and the "stop editing" comment. */

/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';`;

    fs.writeFileSync(path.join(this.wordpressDir, 'wp-config-sample.php'), wpConfigSample);
    console.log('Created: wp-config-sample.php');
  }

  createSampleTheme() {
    const themeDir = path.join(this.wordpressDir, 'wp-content/themes/sample-theme');
    if (!fs.existsSync(themeDir)) {
      fs.mkdirSync(themeDir, { recursive: true });
    }

    const styleCss = `/*
Theme Name: Sample WordPress Theme
Description: A sample theme for WordPress development
Version: 1.0.0
Author: Developer
*/

body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    margin: 0;
    padding: 20px;
    background: #f4f4f4;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

h1 {
    color: #333;
    border-bottom: 2px solid #0073aa;
    padding-bottom: 10px;
}

p {
    color: #666;
    margin-bottom: 15px;
}`;

    const indexPhp = `<?php
/**
 * Sample WordPress Theme
 * 
 * This is a sample theme file for development purposes.
 */

get_header(); ?>

<div class="container">
    <h1>Sample WordPress Theme</h1>
    <p>This is a sample WordPress theme running on your development server.</p>
    <p>You can modify this file to test theme development.</p>
    
    <h2>Theme Features</h2>
    <ul>
        <li>Basic HTML structure</li>
        <li>CSS styling</li>
        <li>PHP integration</li>
        <li>WordPress template tags</li>
    </ul>
</div>

<?php get_footer(); ?>`;

    const functionsPhp = `<?php
/**
 * Sample Theme Functions
 * 
 * This file contains theme setup and custom functions.
 */

// Theme setup
function sample_theme_setup() {
    // Add theme support for various features
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', array(
        'search-form',
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
    ));
}
add_action('after_setup_theme', 'sample_theme_setup');

// Enqueue styles and scripts
function sample_theme_scripts() {
    wp_enqueue_style('sample-theme-style', get_stylesheet_uri());
}
add_action('wp_enqueue_scripts', 'sample_theme_scripts');`;

    fs.writeFileSync(path.join(themeDir, 'style.css'), styleCss);
    fs.writeFileSync(path.join(themeDir, 'index.php'), indexPhp);
    fs.writeFileSync(path.join(themeDir, 'functions.php'), functionsPhp);
    console.log('Created: Sample theme files');
  }

  createSamplePlugin() {
    const pluginDir = path.join(this.wordpressDir, 'wp-content/plugins/sample-plugin');
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    const pluginPhp = `<?php
/**
 * Plugin Name: Sample WordPress Plugin
 * Description: A sample plugin for WordPress development
 * Version: 1.0.0
 * Author: Developer
 * License: GPL v2 or later
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Plugin activation hook
register_activation_hook(__FILE__, 'sample_plugin_activate');

function sample_plugin_activate() {
    // Add activation logic here
    add_option('sample_plugin_activated', 'yes');
}

// Plugin deactivation hook
register_deactivation_hook(__FILE__, 'sample_plugin_deactivate');

function sample_plugin_deactivate() {
    // Add deactivation logic here
    delete_option('sample_plugin_activated');
}

// Add admin menu
add_action('admin_menu', 'sample_plugin_admin_menu');

function sample_plugin_admin_menu() {
    add_menu_page(
        'Sample Plugin',
        'Sample Plugin',
        'manage_options',
        'sample-plugin',
        'sample_plugin_admin_page',
        'dashicons-admin-plugins'
    );
}

// Admin page callback
function sample_plugin_admin_page() {
    echo '<div class="wrap">';
    echo '<h1>Sample WordPress Plugin</h1>';
    echo '<p>This is a sample plugin admin page.</p>';
    echo '<p>You can modify this plugin to test plugin development.</p>';
    echo '</div>';
}

// Add shortcode
add_shortcode('sample_plugin', 'sample_plugin_shortcode');

function sample_plugin_shortcode($atts) {
    $atts = shortcode_atts(array(
        'message' => 'Hello from Sample Plugin!'
    ), $atts);
    
    return '<div class="sample-plugin-message">' . esc_html($atts['message']) . '</div>';
}

// Add action hook
add_action('wp_footer', 'sample_plugin_footer_message');

function sample_plugin_footer_message() {
    echo '<!-- Sample Plugin is active -->';
}`;

    fs.writeFileSync(path.join(pluginDir, 'sample-plugin.php'), pluginPhp);
    console.log('Created: Sample plugin files');
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  const setup = new WordPressSetup();
  setup.setup();
}

module.exports = WordPressSetup;
