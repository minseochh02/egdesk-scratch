# Get Template Content Edge Function

This Supabase Edge Function fetches the content from a Google Sheets template spreadsheet and returns it. The user's app will create a new spreadsheet with this content, ensuring the user owns it from the start.

## Setup Instructions

### 1. Create Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API
4. Go to **IAM & Admin** > **Service Accounts**
5. Click **Create Service Account**
6. Fill in the details and create
7. Click on the service account > **Keys** tab
8. Click **Add Key** > **Create new key**
9. Choose **JSON** format and download
10. Open the JSON file and note:
    - `client_email` (this is the service account email)
    - `private_key` (this is the private key)

### 2. Grant Service Account Access to Templates

1. Open the template spreadsheet in Google Sheets
2. Click **Share** button
3. Add the service account email (from step 1)
4. Give it **Editor** access
5. Repeat for all template spreadsheets

### 3. Deploy to Supabase

1. Copy the `index.ts` file to your Supabase project:
   ```bash
   supabase functions deploy copy-template
   ```

2. Set the required secrets in Supabase Dashboard:
   - Go to **Project Settings** > **Edge Functions** > **Secrets**
   - Add the following secrets:
     - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: The service account email
     - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: The private key (include `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)

### 4. Test the Function

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/copy-template \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "YOUR_TEMPLATE_SPREADSHEET_ID",
    "copyName": "My Copy",
    "userEmail": "user@example.com"
  }'
```

## API Usage

### Request

```typescript
POST /functions/v1/copy-template
Authorization: Bearer <user_supabase_token>
Content-Type: application/json

{
  "templateId": "1JPlm17KCvZmvQQ3J68He_xJxDVB_schN6TEP7W6dP0A"
}
```

### Response

```typescript
{
  "success": true,
  "content": {
    "spreadsheetId": "1JPlm17KCvZmvQQ3J68He_xJxDVB_schN6TEP7W6dP0A",
    "properties": {
      "title": "Template Name",
      "locale": "en_US",
      "timeZone": "America/New_York"
    },
    "sheets": [
      {
        "properties": {
          "sheetId": 0,
          "title": "Sheet1",
          "index": 0,
          "sheetType": "GRID",
          "gridProperties": {
            "rowCount": 1000,
            "columnCount": 26
          }
        },
        "data": [
          {
            "rowData": [
              {
                "values": [
                  {
                    "userEnteredValue": {
                      "stringValue": "Header 1"
                    },
                    "userEnteredFormat": {
                      "backgroundColor": { "red": 0.2, "green": 0.2, "blue": 0.2 },
                      "textFormat": { "bold": true }
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## Error Handling

The function returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (missing templateId)
- `401`: Unauthorized (invalid or missing token)
- `500`: Server error (service account not configured, API errors, etc.)

## Security Notes

1. The function verifies the user is authenticated via Supabase
2. Service account credentials are stored as Supabase secrets (encrypted)
3. The copy is shared with the user's email address
4. The service account only needs access to template spreadsheets, not user data

## Troubleshooting

### "Service account not configured"
- Check that secrets are set in Supabase Dashboard
- Verify secret names match exactly: `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

### "Failed to get spreadsheet"
- Verify the service account has access to the template spreadsheet
- Check that Google Sheets API is enabled in Google Cloud Console
- Verify the templateId is correct
- Ensure the template spreadsheet is not deleted or moved

## Next Steps

After receiving the template content, your Electron app should:
1. Use the user's Google OAuth token to create a new spreadsheet
2. Apply the template content (sheets, data, formatting) to the new spreadsheet
3. Save the new spreadsheet ID to electron-store
4. The user will own this new spreadsheet from the start

