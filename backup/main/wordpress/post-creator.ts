import https from 'https';
import { URL } from 'url';
import { ParsedContent, Image } from '../ai-blog';

export default async function createPost(blogContentWithImages: ParsedContent): Promise<string> {
    const WORDPRESS_URL = process.env.WORDPRESS_URL;
    const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
    const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;

    if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
        throw new Error('Missing WordPress configuration');
    }

    const featuredImage = blogContentWithImages.images?.find((image: Image) => image.placement === 'featured');
    const featuredMediaId = featuredImage?.wordpress?.id ? Number(featuredImage.wordpress.id) : undefined;

    const payload = {
        title: blogContentWithImages.title,
        content: blogContentWithImages.content,
        status: 'publish',
        excerpt: blogContentWithImages.excerpt,
        ...(featuredMediaId && { featured_media: featuredMediaId }),
        // Note: categories and tags require integer IDs from WordPress API
        // categories: postData.categories,
        // tags: postData.tags
    }

    const auth = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_PASSWORD}`).toString('base64');
    const postDataJson = JSON.stringify(payload);

    const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
    const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;

    const requestOptions = {
        hostname: new URL(endpoint).hostname,
        port: new URL(endpoint).port || 443,
        path: new URL(endpoint).pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'Content-Length': Buffer.byteLength(postDataJson)
        }
    }
	return new Promise((resolve, reject) => {
        const makeRequest = (url: string, requestOptions: any) => {
          const req = https.request(requestOptions, (res) => {
            let responseData = '';
    
            res.on('data', (chunk) => {
              responseData += chunk;
            });
    
            res.on('end', () => {
              console.log(`📊 WordPress Post API Response: ${res.statusCode}`);
              
              // Handle redirects
              if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`🔄 Following redirect to: ${res.headers.location}`);
                const redirectUrl = new URL(res.headers.location, url);
                const redirectOptions = {
                  ...requestOptions,
                  hostname: redirectUrl.hostname,
                  port: redirectUrl.port || 443,
                  path: redirectUrl.pathname + redirectUrl.search
                };
                makeRequest(redirectUrl.toString(), redirectOptions);
                return;
              }
              
				try {
                const parsed = JSON.parse(responseData);
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                  console.log(`✅ Successfully created WordPress post`);
                  console.log(`🔗 Post ID: ${parsed.id}`);
                  console.log(`🔗 Post URL: ${parsed.link}`);
                  if (featuredMediaId) {
                    console.log(`🖼️  Featured image ID: ${featuredMediaId}`);
                  }
						resolve(parsed.link);
                } else {
                  console.error(`❌ WordPress Post API Error: ${res.statusCode}`);
                  console.error(`📄 Response:`, parsed);
                  reject(new Error(`WordPress Post API request failed: ${res.statusCode} - ${parsed.message || responseData}`));
                }
              } catch (error: any) {
                console.error(`❌ Failed to parse WordPress response:`, error.message);
                console.error(`📄 Raw response:`, responseData);
                
                if (responseData.includes('302 Found') || responseData.includes('expiration.html')) {
                  reject(new Error(`WordPress site appears to be expired or suspended. The domain is redirecting to an expiration page. Please check your hosting status.`));
                } else {
                  reject(new Error(`Failed to parse WordPress response: ${error.message}`));
                }
              }
            });
          });
    
          req.on('error', (error) => {
            console.error(`❌ WordPress Post API request error:`, error.message);
            reject(new Error(`WordPress Post API request error: ${error.message}`));
          });
    
          req.write(postDataJson);
          req.end();
        };
    
		makeRequest(endpoint, requestOptions);
      });

      
}