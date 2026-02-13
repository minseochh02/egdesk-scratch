/**
 * Supabase Edge Function: Get Service Account OAuth Token
 *
 * Purpose: Generate temporary OAuth access tokens for spreadsheet sync operations
 *          using service account credentials stored securely in environment variables
 *
 * Security Benefits:
 * - Service account credentials stay server-side
 * - Returns temporary tokens (1 hour expiry)
 * - No credentials exposed to desktop app
 * - Audit trail of token requests
 *
 * Usage:
 *   POST /get-service-account-token
 *   Headers: Authorization: Bearer <supabase_jwt>
 *   Body: { scopes?: string[] } (optional, defaults to spreadsheet scopes)
 *
 * Environment Variables Required:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SPREADSHEET_SERVICE_ACCOUNT_EMAIL (spreadsheetsync@egdesk-474603.iam.gserviceaccount.com)
 *   SPREADSHEET_SERVICE_ACCOUNT_PRIVATE_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default scopes for spreadsheet sync operations
const DEFAULT_SPREADSHEET_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.metadata.readonly"
];

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[ServiceAccountToken] Starting service account token generation");

    // ========================================================================
    // 1. Verify user authentication
    // ========================================================================
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[ServiceAccountToken] Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ServiceAccountToken] User authenticated:", user.id);

    // ========================================================================
    // 2. Get service account credentials from environment
    // ========================================================================
    const serviceAccountEmail = Deno.env.get("SPREADSHEET_SERVICE_ACCOUNT_EMAIL");
    const serviceAccountPrivateKey = Deno.env.get("SPREADSHEET_SERVICE_ACCOUNT_PRIVATE_KEY");

    if (!serviceAccountEmail || !serviceAccountPrivateKey) {
      console.error("[ServiceAccountToken] Missing service account credentials in environment");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error",
          code: "MISSING_SERVICE_ACCOUNT_CONFIG"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ServiceAccountToken] Service account email:", serviceAccountEmail);

    // ========================================================================
    // 3. Parse request body for custom scopes (optional)
    // ========================================================================
    let requestedScopes = DEFAULT_SPREADSHEET_SCOPES;
    
    if (req.method === "POST") {
      try {
        const requestBody = await req.json();
        if (requestBody.scopes && Array.isArray(requestBody.scopes)) {
          requestedScopes = requestBody.scopes;
          console.log("[ServiceAccountToken] Custom scopes requested:", requestedScopes);
        }
      } catch (error) {
        console.log("[ServiceAccountToken] No request body or invalid JSON, using default scopes");
      }
    }

    console.log("[ServiceAccountToken] Using scopes:", requestedScopes);

    // ========================================================================
    // 4. Create JWT assertion for service account
    // ========================================================================
    const jwt = await createServiceAccountJWT(
      serviceAccountEmail,
      serviceAccountPrivateKey,
      requestedScopes
    );

    // ========================================================================
    // 5. Exchange JWT for OAuth access token
    // ========================================================================
    console.log("[ServiceAccountToken] Exchanging JWT for OAuth token...");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("[ServiceAccountToken] Google OAuth error:", errorData);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to generate service account token",
          code: "GOOGLE_OAUTH_ERROR",
          details: errorData
        }),
        { status: tokenResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    console.log("[ServiceAccountToken] Service account token generated successfully, expires:", expiresAt.toISOString());

    // ========================================================================
    // 6. Return token to client
    // ========================================================================
    return new Response(
      JSON.stringify({
        success: true,
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || "Bearer",
        expires_in: tokenData.expires_in,
        expires_at: expiresAt.toISOString(),
        scopes: requestedScopes,
        service_account_email: serviceAccountEmail,
        issued_for: "spreadsheet_sync"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[ServiceAccountToken] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
        code: "INTERNAL_ERROR"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Create a JWT assertion for Google Service Account OAuth
 */
async function createServiceAccountJWT(
  serviceAccountEmail: string,
  privateKey: string,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour expiry

  // JWT header
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  // JWT payload for service account OAuth2
  const payload = {
    iss: serviceAccountEmail, // Issuer: service account email
    aud: "https://oauth2.googleapis.com/token", // Audience: OAuth2 token endpoint
    iat: now, // Issued at
    exp: expiry, // Expiration
    scope: scopes.join(" "), // Scopes: space-separated list
  };

  console.log("[ServiceAccountToken] JWT payload created:", {
    iss: payload.iss,
    aud: payload.aud,
    scope: payload.scope,
    exp: new Date(expiry * 1000).toISOString()
  });

  // Encode header and payload
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));

  // Create signature
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signRS256(signingInput, privateKey);

  // Return complete JWT
  const jwt = `${signingInput}.${signature}`;
  console.log("[ServiceAccountToken] JWT created successfully");

  return jwt;
}

/**
 * Base64URL encode (URL-safe base64 without padding)
 */
function base64urlEncode(data: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Sign data using RS256 algorithm
 */
async function signRS256(data: string, privateKey: string): Promise<string> {
  // Clean up the private key format
  const cleanPrivateKey = privateKey
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  // Decode the base64 private key
  const binaryKey = Uint8Array.from(atob(cleanPrivateKey), c => c.charCodeAt(0));

  // Import the private key
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the data
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    dataBytes
  );

  // Convert signature to base64url
  const signatureBytes = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));
  return signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}