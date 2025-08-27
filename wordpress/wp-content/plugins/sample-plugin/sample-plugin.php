<?php
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
}