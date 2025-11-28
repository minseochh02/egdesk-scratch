// Supabase Edge Function: Get Template Spreadsheet Content
// This function fetches the content from a template spreadsheet and returns it
// The user's app will create a new spreadsheet with this content (user owns it)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Google Sheets API v4 endpoint
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_APPS_SCRIPT_API = "https://script.googleapis.com/v1/projects";

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
  appsScript?: {
    scriptId?: string;
    files?: Array<{
      name: string;
      type: string;
      source?: string;
      functionSet?: any;
    }>;
  };
}

interface GetTemplateResponse {
  success: boolean;
  content?: SpreadsheetContent;
  error?: string;
}

serve(async (req) => {
  // Log immediately when function is called - this should ALWAYS appear
  const timestamp = new Date().toISOString();
  console.log("🚀🚀🚀 EDGE FUNCTION CALLED 🚀🚀🚀");
  console.log("📅 Timestamp:", timestamp);
  console.log("📥 Request method:", req.method);
  console.log("📥 Request URL:", req.url);
  console.log("📥 Request headers:", Object.fromEntries(req.headers.entries()));
  
  // Log to stderr as well (sometimes stdout is buffered)
  console.error("STDERR: Edge Function called at", timestamp);
  
  // Handle CORS
  if (req.method === "OPTIONS") {
    console.log("✅ Handling CORS preflight");
    console.error("STDERR: CORS preflight");
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, apikey",
      },
    });
  }

  try {
    // Log all headers (but mask sensitive values) - this should appear
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'authorization') {
        headers[key] = value.substring(0, 20) + '...' + ` (length: ${value.length})`;
      } else if (key.toLowerCase() === 'apikey') {
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
    console.error("STDERR: Request received", JSON.stringify({ method: req.method, url: req.url }));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    console.log("🔧 Environment check:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : "missing",
    });
    console.error("STDERR: Environment check", { hasSupabaseUrl: !!supabaseUrl, hasAnonKey: !!supabaseAnonKey });

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ Missing Supabase configuration");
      console.error("STDERR: Missing Supabase configuration");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error",
          details: {
            hasSupabaseUrl: !!supabaseUrl,
            hasAnonKey: !!supabaseAnonKey,
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("✅ Supabase client created");
    console.error("STDERR: Supabase client created");

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    const apikeyHeader = req.headers.get("apikey");
    
    console.log("🔐 Authorization header check:", {
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 50) + "..." : "missing",
      authHeaderLength: authHeader?.length,
      hasApikeyHeader: !!apikeyHeader,
      apikeyHeaderPrefix: apikeyHeader ? apikeyHeader.substring(0, 20) + "..." : "missing",
    });
    console.error("STDERR: Auth check", { 
      hasAuthHeader: !!authHeader, 
      hasApikeyHeader: !!apikeyHeader,
      authHeaderLength: authHeader?.length 
    });

    if (!authHeader) {
      console.error("❌ Missing authorization header");
      console.error("STDERR: Missing authorization header");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing authorization header",
          details: "Please include 'Authorization: Bearer <token>' in your request headers",
        }),
        {
          status: 401,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
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

    // Step 1: Get spreadsheet metadata and properties with ALL data and formatting
    console.log("📊 Fetching spreadsheet with full data and formatting...");
    console.log("📊 Request details:", {
      url: `${GOOGLE_SHEETS_API}/${templateId}?includeGridData=true`,
      templateId: templateId,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken.length,
      accessTokenPrefix: accessToken.substring(0, 30) + '...',
    });
    
    const metadataResponse = await fetch(
      `${GOOGLE_SHEETS_API}/${templateId}?includeGridData=true`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log("📊 Google Sheets API response:", {
      status: metadataResponse.status,
      statusText: metadataResponse.statusText,
      ok: metadataResponse.ok,
      headers: Object.fromEntries(metadataResponse.headers.entries()),
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error("❌ Failed to get spreadsheet:", errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { raw: errorText };
      }
      
      console.error("❌ Google Sheets API error details:", {
        status: metadataResponse.status,
        statusText: metadataResponse.statusText,
        error: errorData,
        requestUrl: `${GOOGLE_SHEETS_API}/${templateId}?includeGridData=true`,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length,
        accessTokenPrefix: accessToken ? accessToken.substring(0, 30) + '...' : 'missing',
        authorizationHeader: `Bearer ${accessToken?.substring(0, 30)}...`,
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to get spreadsheet: ${metadataResponse.statusText}`,
          details: errorData,
        }),
        {
          status: metadataResponse.status,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const spreadsheetData = await metadataResponse.json();
    console.log("✅ Spreadsheet data fetched:", {
      spreadsheetId: spreadsheetData.spreadsheetId,
      title: spreadsheetData.properties?.title,
      sheetsCount: spreadsheetData.sheets?.length,
      hasGridData: spreadsheetData.sheets?.some((s: any) => s.data && s.data.length > 0),
    });

    // Step 2: Get Apps Script content (container-bound script)
    let appsScriptContent = null;
    try {
      console.log("📜 Fetching Apps Script content...");
      
      // First, get the Apps Script project ID from the spreadsheet
      // Container-bound scripts are linked to the spreadsheet
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
        // For container-bound Apps Script, we need to:
        // 1. First, try to find the script file in Drive (it's a hidden file)
        // 2. Then use Apps Script API to get the project content
        
        try {
          // Method 1: Search for Apps Script files linked to this spreadsheet
          // Container-bound scripts create a hidden file in Drive
          const scriptFilesResponse = await fetch(
            `${GOOGLE_DRIVE_API}/files?q="${templateId}"+in+parents+and+mimeType="application/vnd.google-apps.script"&fields=files(id,name)`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (scriptFilesResponse.ok) {
            const scriptFiles = await scriptFilesResponse.json();
            console.log("📜 Found Apps Script files:", scriptFiles);
            
            if (scriptFiles.files && scriptFiles.files.length > 0) {
              // Get the script file ID (this is the container-bound script)
              const scriptFileId = scriptFiles.files[0].id;
              console.log("📜 Found container-bound script file:", scriptFileId);
              
              // Method 2: Use Apps Script API to get project metadata
              // For container-bound scripts, we need to use the file ID
              // The Apps Script API can access container-bound projects via the file ID
              try {
                // List all projects and find one that matches
                const projectsResponse = await fetch(
                  `${GOOGLE_APPS_SCRIPT_API}`,
                  {
                    method: "GET",
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                    },
                  }
                );

                if (projectsResponse.ok) {
                  const projects = await projectsResponse.json();
                  console.log("📜 Available Apps Script projects:", projects);
                  
                  // Find the project that's bound to our spreadsheet
                  // Container-bound projects have a parentId that matches the spreadsheet
                  const boundProject = projects.projects?.find((p: any) => 
                    p.parentId === templateId || p.parentId === scriptFileId
                  );
                  
                  if (boundProject) {
                    const scriptProjectId = boundProject.scriptId;
                    console.log("📜 Found bound project, fetching content:", scriptProjectId);
                    
                    // Get the script content
                    const scriptContentResponse = await fetch(
                      `${GOOGLE_APPS_SCRIPT_API}/${scriptProjectId}/content`,
                      {
                        method: "GET",
                        headers: {
                          Authorization: `Bearer ${accessToken}`,
                        },
                      }
                    );

                    if (scriptContentResponse.ok) {
                      appsScriptContent = await scriptContentResponse.json();
                      console.log("✅ Apps Script content fetched:", {
                        scriptId: scriptProjectId,
                        filesCount: appsScriptContent.files?.length,
                        fileNames: appsScriptContent.files?.map((f: any) => f.name),
                      });
                    } else {
                      const errorText = await scriptContentResponse.text();
                      console.warn("⚠️ Could not fetch Apps Script content:", {
                        status: scriptContentResponse.status,
                        statusText: scriptContentResponse.statusText,
                        error: errorText,
                      });
                    }
                  } else {
                    console.log("⚠️ No bound project found for this spreadsheet");
                  }
                } else {
                  const errorText = await projectsResponse.text();
                  console.warn("⚠️ Could not list Apps Script projects:", {
                    status: projectsResponse.status,
                    statusText: projectsResponse.statusText,
                    error: errorText,
                  });
                }
              } catch (apiError) {
                console.warn("⚠️ Apps Script API error:", apiError);
              }
            } else {
              console.log("⚠️ No Apps Script files found for this spreadsheet");
            }
          } else {
            const errorText = await scriptFilesResponse.text();
            console.warn("⚠️ Could not search for Apps Script files:", {
              status: scriptFilesResponse.status,
              statusText: scriptFilesResponse.statusText,
              error: errorText,
            });
          }
        } catch (scriptError) {
          console.warn("⚠️ Error fetching Apps Script:", scriptError);
        }
      }
    } catch (error) {
      console.warn("⚠️ Could not fetch Apps Script info:", error);
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
      sheets: spreadsheetData.sheets?.map((sheet: any) => {
        // Log sheet details for debugging
        const sheetData = sheet.data || [];
        const hasData = sheetData.length > 0;
        const hasRowData = sheetData.some((d: any) => d.rowData && d.rowData.length > 0);
        const rowCount = hasRowData ? sheetData.reduce((sum: number, d: any) => sum + (d.rowData?.length || 0), 0) : 0;
        
        console.log(`📄 Sheet "${sheet.properties.title}":`, {
          sheetId: sheet.properties.sheetId,
          hasData: hasData,
          hasRowData: hasRowData,
          rowCount: rowCount,
          dataLength: sheetData.length,
          firstRowHasFormatting: sheetData[0]?.rowData?.[0]?.values?.some((v: any) => v.userEnteredFormat),
        });

        return {
          properties: {
            sheetId: sheet.properties.sheetId,
            title: sheet.properties.title,
            index: sheet.properties.index,
            sheetType: sheet.properties.sheetType,
            gridProperties: sheet.properties.gridProperties,
          },
          data: sheetData,
        };
      }) || [],
      appsScript: appsScriptContent ? {
        scriptId: appsScriptContent.scriptId,
        files: appsScriptContent.files || [],
      } : undefined,
    };

    console.log("✅ Content structured:", {
      spreadsheetId: content.spreadsheetId,
      title: content.properties.title,
      sheetsCount: content.sheets.length,
      hasAppsScript: !!content.appsScript,
      appsScriptFilesCount: content.appsScript?.files?.length || 0,
      totalRows: content.sheets.reduce((sum, sheet) => {
        return sum + (sheet.data?.reduce((s: number, d: any) => s + (d.rowData?.length || 0), 0) || 0);
      }, 0),
    });

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

  // JWT payload for OAuth2 access token request
  // IMPORTANT: For service account OAuth2 WITHOUT domain-wide delegation:
  // - iss: service account email (required)
  // - aud: OAuth2 token endpoint (required)
  // - scope: space-separated list of scopes (required)
  // - iat, exp: issued at and expiration times (required)
  // - sub: ONLY include if using domain-wide delegation to impersonate users
  //        Since we're NOT using domain-wide delegation, we omit 'sub'
  // TESTING: Using only spreadsheets scope to isolate potential scope issues
  const scopeString = "https://www.googleapis.com/auth/spreadsheets";
  
  // TODO: If this works, add scopes back one by one:
  // const scopeString = [
  //   "https://www.googleapis.com/auth/spreadsheets",
  //   "https://www.googleapis.com/auth/drive",
  //   "https://www.googleapis.com/auth/script.projects.readonly",
  //   "https://www.googleapis.com/auth/script.readonly",
  // ].join(" ");
  
  const payload = {
    iss: serviceAccountEmail, // Issuer: service account email
    // NOTE: 'sub' is NOT included - it's only needed for domain-wide delegation
    // Including 'sub' without domain-wide delegation causes Google to return only id_token
    aud: "https://oauth2.googleapis.com/token", // Audience: OAuth2 token endpoint (v1 - matches working test script)
    iat: now, // Issued at
    exp: expiry, // Expiration
    scope: scopeString, // Scopes: space-separated list
  };
  
  console.log("🔑 JWT payload created:", {
    iss: payload.iss,
    aud: payload.aud,
    scope: payload.scope,
    scopeLength: payload.scope.length,
    iat: payload.iat,
    exp: payload.exp,
    expInSeconds: payload.exp - payload.iat,
    note: "sub field omitted (not using domain-wide delegation)",
  });

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  // Debug: Decode payload to verify scope is included
  try {
    const decodedPayload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')));
    console.log("🔍 Decoded JWT payload (for verification):", {
      hasScope: !!decodedPayload.scope,
      scopeValue: decodedPayload.scope,
      scopeLength: decodedPayload.scope?.length,
      allKeys: Object.keys(decodedPayload),
    });
  } catch (e) {
    console.warn("⚠️ Could not decode payload for verification:", e);
  }

  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signRS256(signatureInput, privateKey);
  const encodedSignature = base64UrlEncode(signature);

  const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  console.log("✅ JWT created, total length:", jwt.length);
  
  // Final JWT payload check - decode and verify scope is included
  try {
    const [h, p, s] = jwt.split('.');
    const decodedPayload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    console.log("🔍 FINAL JWT payload check:", {
      hasScope: 'scope' in decodedPayload,
      scope: decodedPayload.scope,
      aud: decodedPayload.aud,
      iss: decodedPayload.iss,
      hasSub: 'sub' in decodedPayload,
      sub: decodedPayload.sub, // Should be undefined (not using domain-wide delegation)
      scopeLength: decodedPayload.scope?.length,
      allKeys: Object.keys(decodedPayload),
      note: "sub should NOT be present (causes id_token-only response)",
    });
  } catch (e) {
    console.warn("⚠️ Could not decode final JWT payload for verification:", e);
  }
  
  return jwt;
}

/**
 * Base64 URL encode (without padding)
 * Supports both string and Uint8Array
 * Properly handles UTF-8 encoding for strings
 */
function base64UrlEncode(input: string | Uint8Array): string {
  let base64: string;
  
  if (typeof input === 'string') {
    // Properly encode UTF-8 string to base64
    const encoder = new TextEncoder();
    const bytes = encoder.encode(input);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
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
  console.log("🌐 JWT being sent (first 100 chars):", jwt.substring(0, 100) + "...");
  
  const requestBody = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  
  console.log("🌐 Request body:", {
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertionLength: jwt.length,
    bodyLength: requestBody.toString().length,
  });
  
  // Decode and verify the actual JWT being sent to Google
  try {
    const [header, payload, sig] = jwt.split('.');
    const decodedHeader = JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/')));
    const decodedPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    
    console.log("🔍 ACTUAL JWT being sent to Google:");
    console.log("📋 Header:", JSON.stringify(decodedHeader, null, 2));
    console.log("📋 Payload:", JSON.stringify(decodedPayload, null, 2));
    console.log("📋 Payload verification:", {
      hasScope: 'scope' in decodedPayload,
      scope: decodedPayload.scope,
      scopeLength: decodedPayload.scope?.length,
      aud: decodedPayload.aud,
      iss: decodedPayload.iss,
      hasSub: 'sub' in decodedPayload,
      sub: decodedPayload.sub, // Should be undefined (not using domain-wide delegation)
      iat: decodedPayload.iat,
      exp: decodedPayload.exp,
      allKeys: Object.keys(decodedPayload),
      hasTargetAudience: 'target_audience' in decodedPayload, // Should be false
    });
    console.log("📋 Signature length:", sig.length);
    console.log("📋 Total JWT length:", jwt.length);
    
    // Critical checks
    if (!decodedPayload.scope) {
      console.error("❌ CRITICAL: Scope is MISSING from the JWT payload!");
      console.error("❌ This will cause Google to return only id_token instead of access_token");
    } else {
      console.log("✅ Scope is present in JWT payload");
    }
    
    if ('sub' in decodedPayload) {
      console.error("❌ CRITICAL: 'sub' claim is present in JWT payload!");
      console.error("❌ 'sub' should only be used for domain-wide delegation");
      console.error("❌ Without domain-wide delegation, 'sub' causes Google to return only id_token");
    } else {
      console.log("✅ 'sub' claim is correctly omitted (not using domain-wide delegation)");
    }
  } catch (error) {
    console.error("❌ Failed to decode JWT for verification:", error);
  }
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: requestBody,
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

  const responseText = await response.text();
  console.log("📥 Google OAuth2 response body (raw, first 500 chars):", responseText.substring(0, 500));
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (error) {
    console.error("❌ Failed to parse OAuth2 response as JSON:", error);
    throw new Error(`Invalid JSON response from OAuth2: ${responseText.substring(0, 200)}`);
  }
  
  console.log("✅ Access token response parsed:", {
    hasToken: !!data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    scope: data.scope,
    tokenLength: data.access_token?.length,
    tokenPrefix: data.access_token ? data.access_token.substring(0, 30) + '...' : 'missing',
    fullResponseKeys: Object.keys(data),
    fullResponse: JSON.stringify(data).substring(0, 500), // Log full response for debugging
  });
  
  if (!data.access_token) {
    console.error("❌ No access_token in OAuth2 response!");
    console.error("❌ Full OAuth2 response:", JSON.stringify(data, null, 2));
    console.error("⚠️ TROUBLESHOOTING:");
    console.error("   1. Check if Google Sheets API is enabled in your Google Cloud project");
    console.error("   2. Verify the service account has the necessary permissions");
    console.error("   3. If using Google Workspace, ensure domain-wide delegation is enabled");
    console.error("   4. Check that the JWT payload includes the 'scope' field");
    throw new Error(`No access_token received from Google OAuth2. Response: ${JSON.stringify(data)}`);
  }
  
  console.log("✅ Access token successfully extracted, length:", data.access_token.length);
  return data.access_token;
}

