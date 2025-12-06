import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client for Auth (User context)
    const supabaseAuthClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Create Supabase client for Admin operations (Service Role - Bypasses RLS)
    // Required to write to secure columns (ip_address, ip_salt) which are restricted for users
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to register an MCP server' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const body = await req.json()
    const { name, description, server_key, connection_url, max_concurrent_connections, owner_email } = body
    
    // Get user email - check multiple sources
    // Priority: user.email > user.user_metadata.email > owner_email from request body
    const userEmail = user.email || user.user_metadata?.email || owner_email
    
    console.log('🔍 Email sources:', {
      'user.email': user.email,
      'user.user_metadata.email': user.user_metadata?.email,
      'owner_email (from body)': owner_email,
      'resolved userEmail': userEmail
    })

    if (!name || !server_key) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required fields',
          message: 'Both name and server_key are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if server_key is already taken
    const { data: existingRecords, error: checkError } = await supabaseAdminClient
      .from('mcp_servers')
      .select('id, name, server_key, created_at')
      .eq('server_key', server_key)
      .limit(1)

    if (checkError) {
      console.error('Check error:', checkError)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Database error',
          message: 'Failed to check server_key availability' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // If server_key is already taken
    if (existingRecords && existingRecords.length > 0) {
      const existingRecord = existingRecords[0]
      
      // Even on conflict, try to add owner permission if missing
      // This handles the case where server was created but permission wasn't
      let ownerPermissionAdded = false
      if (userEmail) {
        try {
          // Check if permission already exists
          const { data: existingPerm } = await supabaseAdminClient
            .from('mcp_server_permissions')
            .select('id')
            .eq('server_id', existingRecord.id)
            .eq('allowed_email', userEmail.toLowerCase())
            .single()
          
          if (!existingPerm) {
            // Permission doesn't exist, create it
            const { error: permissionError } = await supabaseAdminClient
              .from('mcp_server_permissions')
              .insert({
                server_id: existingRecord.id,
                allowed_email: userEmail.toLowerCase(),
                user_id: user.id,
                status: 'active',
                access_level: 'admin',
                granted_at: new Date().toISOString(),
                activated_at: new Date().toISOString(),
                notes: 'Auto-granted: Server owner (on re-registration)'
              })
            
            if (!permissionError) {
              ownerPermissionAdded = true
              console.log(`✅ Auto-added owner permission for ${userEmail} on re-registration`)
            } else {
              console.warn('Warning: Failed to auto-add owner permission on re-registration:', permissionError)
            }
          } else {
            // Permission already exists
            ownerPermissionAdded = true
            console.log(`ℹ️ Owner permission already exists for ${userEmail}`)
          }
        } catch (permError) {
          console.warn('Warning: Error checking/adding permission on re-registration:', permError)
        }
      } else {
        console.warn('Warning: No email available on re-registration, skipping auto-permission')
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server key already exists',
          message: `Server key '${server_key}' is already registered`,
          existing_record: {
            id: existingRecord.id,
            name: existingRecord.name,
            server_key: existingRecord.server_key,
            registered_at: existingRecord.created_at
          },
          owner_permission_added: ownerPermissionAdded
        }),
        { 
          status: 409, // Conflict status code
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Extract IP information for logging
    const forwardedFor = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    
    // Get client IP (prioritize real-ip, then forwarded-for, then connection remote address)
    const clientIp = realIp || 
      (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ||
      req.headers.get('cf-connecting-ip') || // Cloudflare
      'unknown'

    // Encrypt IP address
    const ipSalt = Array.from(new Uint8Array(16)).map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(clientIp + ipSalt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
    const ipHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Insert into mcp_servers table using Admin Client
    const { data, error } = await supabaseAdminClient
      .from('mcp_servers')
      .insert({
        owner_id: user.id,
        name: name,
        description: description || null,
        server_key: server_key,
        connection_url: connection_url || null,
        max_concurrent_connections: max_concurrent_connections || 10,
        status: 'active',
        owner_ip: ipHash, // Storing the hash instead of raw IP
        owner_ip_salt: ipSalt     // Storing the salt
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Database error',
          message: 'Failed to register MCP server',
          details: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Auto-add owner as admin in permissions table
    // This allows the owner to see and access their own server immediately
    let ownerPermissionAdded = false
    if (userEmail) {
      const { error: permissionError } = await supabaseAdminClient
        .from('mcp_server_permissions')
        .insert({
          server_id: data.id,
          allowed_email: userEmail.toLowerCase(),
          user_id: user.id,
          status: 'active',
          access_level: 'admin',
          granted_at: new Date().toISOString(),
          activated_at: new Date().toISOString(),
          notes: 'Auto-granted: Server owner'
        })

      if (permissionError) {
        // Non-fatal: Log warning but don't fail the registration
        console.warn('Warning: Failed to auto-add owner permission:', permissionError)
      } else {
        ownerPermissionAdded = true
        console.log(`✅ Auto-added owner permission for ${userEmail}`)
      }
    } else {
      console.warn('Warning: No email available (checked user.email, user.user_metadata.email, and owner_email from body), skipping auto-permission')
    }

    // Return success response matching RegistrationResponse interface
    return new Response(
      JSON.stringify({
        success: true,
        message: 'MCP server registered successfully',
        name: data.name,
        id: data.id,
        server_key: data.server_key,
        ip: clientIp,
        created_at: data.created_at,
        owner_permission_added: ownerPermissionAdded
      }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
