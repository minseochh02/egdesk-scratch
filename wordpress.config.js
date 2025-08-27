module.exports = {
  // Server configuration
  server: {
    port: 8000,
    host: 'localhost',
    root: '/Users/minseocha/Desktop/projects/태화트랜스', // Your actual PHP server files
    phpPath: '/opt/homebrew/bin/php' // Path to PHP executable (Homebrew installation)
  },

  // WordPress specific settings
  wordpress: {
    // Database configuration (if using MySQL)
    database: {
      host: 'localhost',
      port: 3306,
      name: 'wordpress',
      user: 'root',
      password: ''
    },

    // WordPress configuration
    wpConfig: {
      wpDebug: true,
      wpDebugLog: true,
      wpDebugDisplay: false
    },

    // File permissions
    permissions: {
      wpContent: 0755,
      wpUploads: 0755,
      wpConfig: 0644
    }
  },

  // Development settings
  development: {
    autoReload: true,
    watchFiles: [
      'www/**/*.html',
      'www/**/*.htm',
      'www/**/*.php',
      'www/**/*.css',
      'www/**/*.js'
    ],
    logLevel: 'info'
  },

  // Security settings
  security: {
    allowedHosts: ['localhost', '127.0.0.1'],
    maxUploadSize: '10M',
    enableHttps: false
  }
};
