import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteApiPlugin, jsonResponse } from '@egdesk/vite-api-plugin';

// Mock data store - this would typically be replaced with a real database
let mockData = {
  users: [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' }
  ],
  posts: [
    { id: 1, userId: 1, title: 'Hello World', content: 'First post' },
    { id: 2, userId: 2, title: 'Vite is great', content: 'Second post' }
  ]
};

export default defineConfig({
  plugins: [
    react(),

    // Add API plugin with routes
    viteApiPlugin({
      // Enable debug mode to see request handling logs
      debug: true,

      routes: [
        // ============================================
        // Users API
        // ============================================
        {
          path: '/api/users',
          method: 'GET',
          handler: (req, res) => {
            jsonResponse(res, {
              users: mockData.users,
              count: mockData.users.length
            });
          }
        },
        {
          path: '/api/users',
          method: 'POST',
          handler: (req, res, body) => {
            const newUser = {
              id: mockData.users.length + 1,
              name: body.name,
              email: body.email
            };
            mockData.users.push(newUser);
            jsonResponse(res, { user: newUser }, 201);
          }
        },

        // ============================================
        // Posts API
        // ============================================
        {
          path: '/api/posts',
          method: 'GET',
          handler: (req, res) => {
            jsonResponse(res, {
              posts: mockData.posts,
              count: mockData.posts.length
            });
          }
        },
        {
          path: '/api/posts',
          method: 'POST',
          handler: (req, res, body) => {
            const newPost = {
              id: mockData.posts.length + 1,
              userId: body.userId,
              title: body.title,
              content: body.content
            };
            mockData.posts.push(newPost);
            jsonResponse(res, { post: newPost }, 201);
          }
        },

        // ============================================
        // Simulate Data Update (for testing)
        // ============================================
        {
          path: '/api/simulate-update',
          method: 'POST',
          handler: (req, res) => {
            // Randomly modify some data
            const userIndex = Math.floor(Math.random() * mockData.users.length);
            const oldName = mockData.users[userIndex].name;
            mockData.users[userIndex].name = `${oldName} (Updated)`;

            jsonResponse(res, {
              success: true,
              message: 'Data updated',
              updatedUser: mockData.users[userIndex],
              timestamp: new Date().toISOString()
            });
          }
        },

        // ============================================
        // Health Check
        // ============================================
        {
          path: '/api/health',
          method: 'GET',
          handler: (req, res) => {
            jsonResponse(res, {
              status: 'OK',
              timestamp: new Date().toISOString(),
              uptime: process.uptime()
            });
          }
        }
      ]
    })
  ]
});
