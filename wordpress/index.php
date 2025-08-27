<?php
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
?>