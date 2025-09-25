/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} - Result of the function
 */
export default async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const isRetryableError = error.message.includes('UNAVAILABLE') || // Service Unavailable
                                error.message.includes('overloaded') || // Overloaded
                                error.message.includes('503') || // Service Unavailable
                                error.message.includes('429') // Too Many Requests
                                // error.message.includes('quota') || // Quota Exceeded, should let User know so they can switch api key if needed
                                // error.message.includes('rate limit'); // Rate Limit Exceeded, should let User know so they can switch api key if needed
        
        if (!isRetryableError || attempt === maxRetries) {
            // If not retryable, throw the error, handle in the caller
          throw error;
        }
        
        // If retryable, add a delay and retry
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(`⚠️  Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
        console.log(`   Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  