// Supabase Edge Function: Get Template Spreadsheet Content
// This function fetches the content from a template spreadsheet and returns it
// The user's app will create a new spreadsheet with this content (user owns it)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Google Sheets API v4 endpoint
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";

interface GetTemplateRequest {
  templateId: string; // Google Sheets spreadsheet ID
}

interface SpreadsheetContent {
  spreadsheetId: string;
  properties: {
    title: string;
    locale?: string;
    timeZone?: string;
  };
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
      index: number;
      sheetType: string;
      gridProperties?: {
        rowCount: number;
        columnCount: number;
      };
    };
    data: Array<{
      rowData: Array<{
        values: Array<{
          userEnteredValue?: {
            stringValue?: string;
            numberValue?: number;
            boolValue?: boolean;
            formulaValue?: string;
          };
          userEnteredFormat?: {
            backgroundColor?: {
              red: number;
              green: number;
              blue: number;
              alpha: number;
            };
            textFormat?: {
              foregroundColor?: {
                red: number;
                green: number;
                blue: number;
                alpha: number;
              };
              fontFamily?: string;
              fontSize?: number;
              bold?: boolean;
              italic?: boolean;
              underline?: boolean;
            };
            horizontalAlignment?: string;
            verticalAlignment?: string;
            wrapStrategy?: string;
          };
        }>;
      }>;
    }>;
  }>;
}

interface GetTemplateResponse {
  success: boolean;
  content?: SpreadsheetContent;
  error?: string;
}

serve(async (req) => {
  // Log immediately when function is called
  console.log("🚀 Edge Function called at:", new Date().toISOString());
  console.log("📥 Request method:", req.method);
  console.log("📥 Request URL:", req.url);
  
  // Handle CORS
  if (req.method === "OPTIONS") {
    console.log("✅ Handling CORS preflight");
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, apikey",
      },
    });
  }

  try {
    // Log all headers (but mask sensitive values)
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'authorization') {
        headers[key] = value.substring(0, 20) + '...' + ` (length: ${value.length})`;
      } else {
        headers[key] = value;
      }
    });
    
    console.log("📥 Request received:", {
      method: req.method,
      url: req.url,
      headers: headers,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("🔧 Environment check:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : "missing",
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ Missing Supabase configuration");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error",
          details: {
            hasSupabaseUrl: !!supabaseUrl,
            hasServiceKey: !!supabaseServiceKey,
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("🔐 Authorization header check:", {
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 20) + "..." : "missing",
    });

    if (!authHeader) {
      console.error("❌ Missing authorization header");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing authorization header",
          details: "Please include 'Authorization: Bearer <token>' in your request headers",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // COMMENTED OUT: Verify user is authenticated
    // const token = authHeader.replace("Bearer ", "").trim();
    // console.log("🎫 Token extracted:", {
    //   tokenLength: token.length,
    //   tokenPrefix: token.substring(0, 50),
    //   tokenSuffix: token.length > 50 ? token.substring(token.length - 50) : token,
    //   tokenParts: token.split('.').length,
    //   // Check if token looks truncated (ends abruptly)
    //   tokenEndsWithDot: token.endsWith('.'),
    //   authHeaderLength: authHeader.length,
    // });

    // const {
    //   data: { user },
    //   error: authError,
    // } = await supabase.auth.getUser(token);

    // console.log("👤 User authentication result:", {
    //   hasUser: !!user,
    //   userId: user?.id,
    //   userEmail: user?.email,
    //   authError: authError ? {
    //     message: authError.message,
    //     status: authError.status,
    //     name: authError.name,
    //   } : null,
    // });

    // if (authError) {
    //   console.error("❌ Authentication error:", {
    //     message: authError.message,
    //     status: authError.status,
    //     name: authError.name,
    //   });
    //   return new Response(
    //     JSON.stringify({
    //       success: false,
    //       error: "Authentication failed",
    //       details: {
    //         message: authError.message,
    //         status: authError.status,
    //         name: authError.name,
    //       },
    //     }),
    //     {
    //       status: 401,
    //       headers: { "Content-Type": "application/json" },
    //     }
    //   );
    // }

    // if (!user) {
    //   console.error("❌ No user returned from authentication");
    //   return new Response(
    //     JSON.stringify({
    //       success: false,
    //       error: "Unauthorized - No user found",
    //       details: "Token was processed but no user was returned",
    //     }),
    //     {
    //       status: 401,
    //       headers: { "Content-Type": "application/json" },
    //     }
    //   );
    // }
    
    console.log("⚠️ User authentication validation is COMMENTED OUT - proceeding without auth check");

    // Parse request body
    let body: GetTemplateRequest;
    try {
      const bodyText = await req.text();
      console.log("📦 Request body:", bodyText);
      body = JSON.parse(bodyText);
    } catch (error) {
      console.error("❌ Failed to parse request body:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { templateId } = body;
    console.log("📋 Template ID:", templateId);

    if (!templateId) {
      console.error("❌ Missing templateId in request");
      return new Response(
        JSON.stringify({
          success: false,
          error: "templateId is required",
          details: "Please provide a templateId in the request body",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get Google Service Account credentials from Supabase secrets
    // These should be set in Supabase Dashboard > Project Settings > Edge Functions > Secrets
    const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    let serviceAccountPrivateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");

    // Handle private key - preserve newlines but ensure proper format
    if (serviceAccountPrivateKey) {
      // If the key doesn't have newlines but should (PEM format), try to format it
      // But first, check if it's already properly formatted
      if (!serviceAccountPrivateKey.includes('\n') && serviceAccountPrivateKey.includes('BEGIN')) {
        // Key might have escaped newlines like \\n, convert them
        serviceAccountPrivateKey = serviceAccountPrivateKey.replace(/\\n/g, '\n');
      }
      // Ensure the key has proper PEM format with newlines
      if (!serviceAccountPrivateKey.includes('\n')) {
        // Try to add newlines if missing (for PEM format)
        serviceAccountPrivateKey = serviceAccountPrivateKey
          .replace(/-----BEGIN PRIVATE KEY-----/g, '-----BEGIN PRIVATE KEY-----\n')
          .replace(/-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----');
      }
    }

    console.log("🔑 Service account check:", {
      hasEmail: !!serviceAccountEmail,
      hasPrivateKey: !!serviceAccountPrivateKey,
      email: serviceAccountEmail || "missing",
      keyLength: serviceAccountPrivateKey ? serviceAccountPrivateKey.length : 0,
      keyHasNewlines: serviceAccountPrivateKey ? serviceAccountPrivateKey.includes('\n') : false,
      keyStartsWith: serviceAccountPrivateKey ? serviceAccountPrivateKey.substring(0, 30) : "missing",
    });

    if (!serviceAccountEmail || !serviceAccountPrivateKey) {
      console.error("❌ Missing Google Service Account credentials");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Service account not configured",
          details: {
            hasEmail: !!serviceAccountEmail,
            hasPrivateKey: !!serviceAccountPrivateKey,
            message: "Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in Supabase secrets",
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create JWT for service account authentication
    console.log("🔨 Creating service account JWT...");
    let jwt: string;
    try {
      jwt = await createServiceAccountJWT(
        serviceAccountEmail,
        serviceAccountPrivateKey
      );
      console.log("✅ JWT created successfully, length:", jwt.length);
    } catch (error) {
      console.error("❌ Failed to create JWT:", {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error,
        keyLength: serviceAccountPrivateKey?.length,
        keyHasNewlines: serviceAccountPrivateKey?.includes('\n'),
        keyFirst50: serviceAccountPrivateKey?.substring(0, 50),
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create service account JWT",
          details: {
            message: error instanceof Error ? error.message : "Unknown error",
            hint: "Check if the private key is properly formatted with newlines. It should include '-----BEGIN PRIVATE KEY-----' and '-----END PRIVATE KEY-----'",
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Exchange JWT for access token
    console.log("🔄 Exchanging JWT for access token...");
    let accessToken: string;
    try {
      accessToken = await getAccessToken(jwt);
      console.log("✅ Access token obtained");
    } catch (error) {
      console.error("❌ Failed to get access token:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to get Google access token",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 1: Get spreadsheet metadata and properties
    const metadataResponse = await fetch(
      `${GOOGLE_SHEETS_API}/${templateId}?includeGridData=true`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!metadataResponse.ok) {
      const errorData = await metadataResponse.text();
      console.error("Failed to get spreadsheet:", errorData);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to get spreadsheet: ${metadataResponse.statusText}`,
        }),
        {
          status: metadataResponse.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const spreadsheetData = await metadataResponse.json();

    // Step 2: Get Apps Script content if it exists (container-bound script)
    let appsScriptContent = null;
    try {
      // Try to get Apps Script project associated with this spreadsheet
      const driveResponse = await fetch(
        `${GOOGLE_DRIVE_API}/${templateId}?fields=id,name,mimeType`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (driveResponse.ok) {
        // Check if there's an Apps Script project
        // Note: Getting Apps Script content requires Apps Script API
        // For now, we'll return the spreadsheet structure
        // Apps Script can be added separately if needed
      }
    } catch (error) {
      console.warn("Could not fetch Apps Script info:", error);
      // Continue without Apps Script - it's optional
    }

    // Structure the response with spreadsheet content
    const content: SpreadsheetContent = {
      spreadsheetId: templateId,
      properties: {
        title: spreadsheetData.properties?.title || "Untitled Spreadsheet",
        locale: spreadsheetData.properties?.locale,
        timeZone: spreadsheetData.properties?.timeZone,
      },
      sheets: spreadsheetData.sheets?.map((sheet: any) => ({
        properties: {
          sheetId: sheet.properties.sheetId,
          title: sheet.properties.title,
          index: sheet.properties.index,
          sheetType: sheet.properties.sheetType,
          gridProperties: sheet.properties.gridProperties,
        },
        data: sheet.data || [],
      })) || [],
    };

    const response: GetTemplateResponse = {
      success: true,
      content,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : error;
    
    console.error("❌ Unhandled error in copy-template function:", {
      error: errorDetails,
      timestamp: new Date().toISOString(),
    });
    
    // Also log to stderr for Supabase logs
    console.error("STDERR ERROR:", JSON.stringify(errorDetails));
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: {
          message: error instanceof Error ? error.message : "Unknown error",
          type: error instanceof Error ? error.name : typeof error,
        },
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/**
 * Create a JWT for Google Service Account authentication
 */
async function createServiceAccountJWT(
  serviceAccountEmail: string,
  privateKey: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour expiry

  // JWT header
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  // JWT payload
  const payload = {
    iss: serviceAccountEmail,
    sub: serviceAccountEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ].join(" "),
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signRS256(signatureInput, privateKey);
  const encodedSignature = base64UrlEncode(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Base64 URL encode (without padding)
 * Supports both string and Uint8Array
 */
function base64UrlEncode(input: string | Uint8Array): string {
  let base64: string;
  
  if (typeof input === 'string') {
    base64 = btoa(input);
  } else {
    // Convert Uint8Array to base64
    let binary = '';
    for (let i = 0; i < input.length; i++) {
      binary += String.fromCharCode(input[i]);
    }
    base64 = btoa(binary);
  }
  
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Sign data using RS256 algorithm
 */
async function signRS256(data: string, privateKey: string): Promise<Uint8Array> {
  try {
    // Remove PEM headers but preserve the base64 content
    // The key should have newlines, but we need to remove them for base64 decoding
    let keyData = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\r\n/g, "\n") // Normalize Windows line endings
      .replace(/\r/g, "\n") // Normalize Mac line endings
      .replace(/\n/g, "") // Remove all newlines for base64 decoding
      .replace(/\s/g, ""); // Remove any remaining whitespace

    console.log("🔐 Processing private key:", {
      originalLength: privateKey.length,
      cleanedLength: keyData.length,
      hasBeginMarker: privateKey.includes('BEGIN'),
      hasEndMarker: privateKey.includes('END'),
    });

    // Decode base64
    const keyBytes = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
    
    console.log("🔐 Key decoded, bytes length:", keyBytes.length);

    // Import key
    console.log("🔐 Importing key...");
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyBytes,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );
    console.log("✅ Key imported successfully");

    // Sign data
    console.log("🔐 Signing data...");
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(data)
    );
    console.log("✅ Data signed, signature length:", signature.byteLength);

    return new Uint8Array(signature);
  } catch (error) {
    console.error("❌ Error in signRS256:", {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    });
    throw new Error(`Failed to sign JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Exchange JWT for access token
 */
async function getAccessToken(jwt: string): Promise<string> {
  console.log("🌐 Requesting access token from Google OAuth2...");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  console.log("📡 Google OAuth2 response:", {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Google OAuth2 error response:", errorText);
    let errorDetails;
    try {
      errorDetails = JSON.parse(errorText);
    } catch {
      errorDetails = errorText;
    }
    throw new Error(
      `Failed to get access token (${response.status}): ${JSON.stringify(errorDetails)}`
    );
  }

  const data = await response.json();
  console.log("✅ Access token received:", {
    hasToken: !!data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
  });
  return data.access_token;
}

