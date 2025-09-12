# Gemini API Error Handling Guide

## Common Errors and Solutions

### 1. **UNAVAILABLE / Model Overloaded (503)**
```
❌ Error: got status: UNAVAILABLE. {"error":{"code":503,"message":"The model is overloaded. Please try again later.","status":"UNAVAILABLE"}}
```

**What it means:** The Gemini API is temporarily overloaded with too many requests.

**Solutions:**
- ✅ **Automatic retry** - The script now includes retry logic with exponential backoff
- ⏰ **Wait and retry** - Try again in 5-10 minutes
- 🔄 **Use different model** - Switch to a different Gemini model if available
- 📊 **Check API status** - Visit Google AI status page

### 2. **Rate Limit Exceeded (429)**
```
❌ Error: got status: RESOURCE_EXHAUSTED. {"error":{"code":429,"message":"Quota exceeded for requests per minute"}}
```

**What it means:** You've exceeded the rate limit for API requests.

**Solutions:**
- ⏰ **Wait** - Wait for the rate limit to reset (usually 1 minute)
- 🐌 **Slow down** - Reduce the frequency of requests
- 📈 **Upgrade quota** - Consider upgrading your API quota

### 3. **Invalid API Key (401)**
```
❌ Error: got status: UNAUTHENTICATED. {"error":{"code":401,"message":"API key not valid"}}
```

**What it means:** Your API key is invalid or expired.

**Solutions:**
- 🔑 **Check API key** - Verify the key is correct in WordPress Sites List
- 🔄 **Regenerate key** - Create a new API key in Google AI Studio
- ✅ **Test key** - Test the key in Google AI Studio first

### 4. **Quota Exceeded (429)**
```
❌ Error: got status: RESOURCE_EXHAUSTED. {"error":{"code":429,"message":"Quota exceeded"}}
```

**What it means:** You've exceeded your daily/monthly quota.

**Solutions:**
- 📊 **Check usage** - Check your quota usage in Google Cloud Console
- ⏰ **Wait for reset** - Wait for the quota to reset (usually daily)
- 💳 **Upgrade plan** - Consider upgrading your billing plan

## Retry Logic Implementation

The script now includes automatic retry logic:

```javascript
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryableError = error.message.includes('UNAVAILABLE') || 
                              error.message.includes('overloaded') ||
                              error.message.includes('503') ||
                              error.message.includes('429');
      
      if (!isRetryableError || attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`⚠️  Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

**Retry Strategy:**
- **3 attempts** maximum
- **Exponential backoff** - 2s, 4s, 8s delays
- **Random jitter** - Adds randomness to prevent thundering herd
- **Smart error detection** - Only retries on retryable errors

## Testing the Retry Logic

Run the test script to see retry logic in action:

```bash
node scripts/test-retry-logic.js
```

## Best Practices

1. **Monitor API Status** - Check Google AI status page for outages
2. **Implement Circuit Breaker** - Stop making requests if errors persist
3. **Log Errors** - Keep detailed logs for debugging
4. **Graceful Degradation** - Fall back to simpler content if needed
5. **Rate Limiting** - Implement client-side rate limiting

## Emergency Fallbacks

If Gemini API is consistently unavailable:

1. **Use cached content** - Serve previously generated content
2. **Switch to different AI provider** - Use OpenAI or Anthropic as backup
3. **Generate simple content** - Create basic HTML without AI
4. **Manual content** - Use pre-written templates

## Monitoring and Alerts

Set up monitoring for:
- API response times
- Error rates
- Quota usage
- Success/failure ratios

## Contact and Support

- **Google AI Support** - https://ai.google.dev/support
- **API Documentation** - https://ai.google.dev/docs
- **Status Page** - https://status.cloud.google.com/
