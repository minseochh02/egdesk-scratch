<?php
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
add_action('wp_enqueue_scripts', 'sample_theme_scripts');