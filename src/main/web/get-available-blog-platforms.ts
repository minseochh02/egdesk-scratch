/**
 * Get available blog platforms from user's connections
 * Returns an array of platform names like ["WordPress", "Naver Blog", "Tistory"]
 */

export async function getAvailableBlogPlatforms(): Promise<string[]> {
  const platforms: string[] = [];
  
  try {
    // Get WordPress connections
    const { getStore } = require('../storage');
    const store = getStore();
    
    const wpConnections = store.get('wordpressConnections', []);
    if (Array.isArray(wpConnections) && wpConnections.length > 0) {
      platforms.push('WordPress');
    }
    
    // Get Naver connections
    const naverConnections = store.get('naverConnections', []);
    if (Array.isArray(naverConnections) && naverConnections.length > 0) {
      platforms.push('Naver Blog');
    }
    
    // Get Tistory connections (if implemented)
    const tistoryConnections = store.get('tistoryConnections', []);
    if (Array.isArray(tistoryConnections) && tistoryConnections.length > 0) {
      platforms.push('Tistory');
    }
  } catch (error) {
    console.error('[getAvailableBlogPlatforms] Error fetching blog platforms:', error);
  }
  
  return platforms;
}

