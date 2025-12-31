const { getStore } = require('../../storage');

/**
 * Gets the Gemini API key from environment or electron-store
 * Uses the same pattern as other parts of the codebase (ai-search.ts, gemini/index.ts)
 * @returns {string|null} API key or null if not found
 */
function getGeminiApiKey() {
  // Try environment variable first
  if (process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string') {
    console.log('[FINANCE-HUB] Using Gemini API key from environment variable');
    return process.env.GEMINI_API_KEY.trim();
  }
  
  // Try electron-store via getStore helper (same pattern as gemini/index.ts)
  try {
    const store = getStore?.();
    if (!store) {
      console.warn('[FINANCE-HUB] Store not available');
      return null;
    }
    
    const aiKeys = store.get('ai-keys', []);
    if (!Array.isArray(aiKeys)) {
      console.warn('[FINANCE-HUB] AI keys not found or not an array');
      return null;
    }
    
    // Find preferred key: egdesk > active > any google key (same logic as gemini/index.ts)
    const preferred =
      aiKeys.find(k => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ??
      aiKeys.find(k => k?.providerId === 'google' && k?.isActive) ??
      aiKeys.find(k => k?.providerId === 'google' && k?.fields?.apiKey);
    
    if (preferred) {
      const apiKey = preferred?.fields?.apiKey;
      if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
        const keyPreview = `${apiKey.trim().substring(0, 8)}...${apiKey.trim().substring(apiKey.trim().length - 4)}`;
        console.log('[FINANCE-HUB] Using Gemini API key from AI Keys Manager:', preferred.name || 'unnamed', '- Key:', keyPreview);
        return apiKey.trim();
      }
    }
    
    console.warn('[FINANCE-HUB] No Google API key found in AI Keys Manager');
  } catch (error) {
    console.warn('[FINANCE-HUB] Failed to get API key from store:', error.message);
  }
  
  return null;
}

module.exports = {
  getGeminiApiKey,
};

