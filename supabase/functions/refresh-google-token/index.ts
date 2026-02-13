/**
 * Supabase Edge Function: Refresh Google OAuth Token
 *
 * Purpose: Securely refresh Google OAuth tokens using client credentials
 *          stored in environment variables (not exposed to Electron app)
 *
 * Security Benefits:
 * - Client secrets stay server-side
 * - Tokens managed centrally in Supabase
 * - Audit trail of refresh operations
 * - Cross-device token sync
 *
 * Usage:
 *   POST /refresh-google-token
 *   Headers: Authorization: Bearer <supabase_jwt>
 *
 * Environment Variables Required:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[Refresh] Starting token refresh process");

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
      console.error("[Refresh] Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Refresh] User authenticated:", user.id);

    // ========================================================================
    // 2. Get stored token from database (using service role for full access)
    // ========================================================================
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: tokenRecord, error: fetchError } = await supabaseAdmin
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .eq("is_active", true)
      .single();

    if (fetchError || !tokenRecord) {
      console.error("[Refresh] Token not found:", fetchError?.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: "No refresh token found",
          code: "NO_REFRESH_TOKEN",
          details: "User needs to re-authenticate with Google"
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenRecord.refresh_token) {
      console.error("[Refresh] Refresh token missing in record");
      return new Response(
        JSON.stringify({
          success: false,
          error: "No refresh token available",
          code: "NO_REFRESH_TOKEN",
          details: "Token record exists but refresh_token is null"
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Refresh] Token record found, refreshing...");

    // ========================================================================
    // 3. Call Google OAuth API to refresh token
    // ========================================================================
    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error("[Refresh] Missing Google OAuth credentials in environment");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error",
          code: "MISSING_CONFIG"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: tokenRecord.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!refreshResponse.ok) {
      const errorData = await refreshResponse.json();
      console.error("[Refresh] Google OAuth error:", errorData);

      // Handle specific error cases
      if (errorData.error === "invalid_grant") {
        // Refresh token is invalid/expired - user needs to re-authenticate
        // Deactivate the token in database
        await supabaseAdmin
          .from("user_google_tokens")
          .update({ is_active: false })
          .eq("user_id", user.id)
          .eq("provider", "google");

        return new Response(
          JSON.stringify({
            success: false,
            error: "Refresh token invalid - re-authentication required",
            code: "INVALID_GRANT",
            details: "The refresh token has been revoked or expired. Please sign in again."
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Token refresh failed",
          code: "GOOGLE_API_ERROR",
          details: errorData
        }),
        { status: refreshResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refreshData = await refreshResponse.json();
    const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

    // Parse scopes from refresh response - Google returns space-separated string
    let updatedScopes = tokenRecord.scopes; // Default to existing scopes
    if (refreshData.scope) {
      updatedScopes = refreshData.scope.split(' ').filter((s: string) => s.trim().length > 0);
      console.log("[Refresh] Updated scopes from refresh response:", updatedScopes);
    } else {
      console.log("[Refresh] No scopes in refresh response, keeping existing:", updatedScopes);
    }

    console.log("[Refresh] Token refreshed successfully, new expiry:", newExpiresAt.toISOString());

    // ========================================================================
    // 4. Update token in database
    // ========================================================================
    const { error: updateError } = await supabaseAdmin
      .from("user_google_tokens")
      .update({
        access_token: refreshData.access_token,
        // Google may return a new refresh token - if not, keep existing one
        refresh_token: refreshData.refresh_token || tokenRecord.refresh_token,
        expires_at: newExpiresAt.toISOString(),
        // Update scopes from refresh response or preserve existing ones
        scopes: updatedScopes,
        last_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("provider", "google");

    if (updateError) {
      console.error("[Refresh] Failed to update token in database:", updateError);
      // Still return success to client since we got a valid token from Google
      // Client can still use the token even if database update failed
    } else {
      console.log("[Refresh] Token updated in database");
    }

    // ========================================================================
    // 5. Return refreshed token to client
    // ========================================================================
    return new Response(
      JSON.stringify({
        success: true,
        access_token: refreshData.access_token,
        expires_at: newExpiresAt.toISOString(),
        expires_in: refreshData.expires_in,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Refresh] Unexpected error:", error);
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
