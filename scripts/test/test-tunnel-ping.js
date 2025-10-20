#!/usr/bin/env node

/**
 * Test script for Tunnel Client PING/PONG
 * This sends a ping message to the tunnel client via Supabase Realtime
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nngaxadphzvbhywzqfal.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZ2F4YWRwaHp2Ymh5d3pxZmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc5MTgxMDQsImV4cCI6MjA1MzQ5NDEwNH0.DqeJiYJfYwBwQK0b_lnO7rLgfXFHpSjBQpXc8kDPUdE';
const MCP_SERVER_NAME = process.argv[2] || 'gmail-chat-test';
const TIMEOUT_MS = 10000; // 10 seconds

async function testTunnelPing() {
  console.log('🏓 Testing Tunnel Client PING/PONG\n');
  console.log('📋 Configuration:');
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  console.log(`   MCP Server Name: ${MCP_SERVER_NAME}`);
  console.log(`   Timeout: ${TIMEOUT_MS}ms\n`);

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  const channelName = `tunnel:${MCP_SERVER_NAME}`;
  console.log(`📺 Creating channel: ${channelName}`);
  
  // Create channel with self: true to receive our own messages
  const channel = supabase.channel(channelName, {
    config: {
      broadcast: {
        self: true  // Important: receive messages from same auth context
      }
    }
  });

  try {
    // Set up promise to wait for pong
    const pongPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`PING timeout (${TIMEOUT_MS}ms) - no PONG received from tunnel client`));
      }, TIMEOUT_MS);

      // Listen for pong response
      channel
        .on('broadcast', { event: 'pong' }, (payload) => {
          console.log(`\n🎉 Received PONG from tunnel client!`);
          console.log(`📦 Payload:`, JSON.stringify(payload.payload, null, 2));
          clearTimeout(timeout);
          resolve(payload.payload);
        })
        .on('broadcast', { event: '*' }, (payload) => {
          // Log all events for debugging
          if (payload.event !== 'pong') {
            console.log(`📡 Received event: ${payload.event}`, payload.payload);
          }
        })
        .subscribe(async (status) => {
          console.log(`📡 Channel subscription status: ${status}`);
          
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Successfully subscribed to channel\n`);
            
            // Wait a moment for the channel to stabilize
            console.log(`⏳ Waiting 1000ms for channel to stabilize...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Send ping
            console.log(`🏓 Sending PING to tunnel client...`);
            const sendResult = await channel.send({
              type: 'broadcast',
              event: 'ping',
              payload: {
                timestamp: Date.now(),
                message: 'Hello from test script!',
                source: 'test-tunnel-ping.js'
              }
            });
            
            console.log(`✅ PING sent successfully`);
            console.log(`📊 Send result:`, sendResult);
            console.log(`\n⏳ Waiting for PONG response...`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error(`Channel subscription failed: ${status}`));
          }
        });
    });

    // Wait for pong
    const pongResponse = await pongPromise;
    
    // Success!
    console.log(`\n✅ PING/PONG test SUCCESSFUL!`);
    console.log(`📊 Round-trip completed`);
    console.log(`🎯 Tunnel client is running and responsive\n`);

    // Cleanup
    await supabase.removeChannel(channel);
    process.exit(0);

  } catch (error) {
    console.error(`\n❌ PING/PONG test FAILED!`);
    console.error(`🚨 Error: ${error.message}\n`);
    console.error(`💡 Troubleshooting:`);
    console.error(`   1. Make sure the tunnel client is running`);
    console.error(`   2. Check that the MCP server name matches: ${MCP_SERVER_NAME}`);
    console.error(`   3. Verify Supabase Realtime is enabled`);
    console.error(`   4. Check that broadcast events are allowed on the channel\n`);

    // Cleanup
    await supabase.removeChannel(channel);
    process.exit(1);
  }
}

// Usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node test-tunnel-ping.js [MCP_SERVER_NAME]

Arguments:
  MCP_SERVER_NAME    Name of the MCP server to ping (default: gmail-chat-test)

Environment Variables:
  SUPABASE_URL       Supabase project URL
  SUPABASE_ANON_KEY  Supabase anonymous key

Examples:
  node test-tunnel-ping.js
  node test-tunnel-ping.js my-mcp-server
  SUPABASE_URL=https://xxx.supabase.co node test-tunnel-ping.js

Description:
  This script tests the tunnel client by sending a PING message and waiting
  for a PONG response. It verifies that the tunnel client is running and
  properly subscribed to Supabase Realtime channels.
  `);
  process.exit(0);
}

// Run the test
console.log('🚀 Starting tunnel PING test...\n');
testTunnelPing().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});

