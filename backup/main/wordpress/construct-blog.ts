import { ParsedContent, Image, ImageMarker } from '../ai-blog';
import generateStructuredBlogContent from '../ai-blog/generate-outline';
import generateImages from '../ai-blog/generate-images';


export default async function constructBlog(topic: string) {
    const WORDPRESS_URL = process.env.WORDPRESS_URL;
    const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
    const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;

    if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
        throw new Error('Missing WordPress configuration');
    }

    // generate blog content with image markers
    const blogContent = await generateStructuredBlogContent(topic);

    // generate images and upload to wordpress
    const blogContentWithImages = await generateImages(blogContent);

    const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
    const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;

    // Find featured image (first image with placement 'featured' or first image)
    const featuredImage = (blogContentWithImages.images || []).find((img: Image) => img.placement === 'featured') || (blogContentWithImages.images || [])[0];
    const featuredMediaId = featuredImage?.wordpress?.id ? Number(featuredImage.wordpress.id) : undefined;
    
    // Replace image markers in content using UUID mapping from markers → images
    let updatedContent = blogContentWithImages.content;
    if ((blogContentWithImages.images && blogContentWithImages.images.length > 0) && (blogContentWithImages.markers && blogContentWithImages.markers.length > 0)) {
        console.log(`🔄 Replacing image markers in content using UUID mapping...`);
        updatedContent = replaceImageMarkersByUuid(
          blogContentWithImages.content,
          blogContentWithImages.markers,
          blogContentWithImages.images
        );
    }

    
    return { blogContentWithImages };
}

function replaceImageMarkersByUuid(content: string, markers: ImageMarker[], images: Image[]) {
  // Replace [IMAGE:description:placement] markers with WordPress image shortcodes using marker/image UUID mapping
  const imageMarkerRegex = /\[IMAGE:([^:]+):([^\]]+)\]/g;
  const usedImages = new Set<string>();
  let replacedCount = 0;
  let markerIndex = 0;

  const updatedContent = content.replace(imageMarkerRegex, () => {
    const marker = markers[markerIndex++];
    if (!marker) {
      return '';
    }

    const uploadedImage = images.find(img => img.uuid === marker.uuid && img.wordpress && img.wordpress.id && img.wordpress.url);

    if (uploadedImage && uploadedImage.wordpress && uploadedImage.wordpress.id && !usedImages.has(uploadedImage.wordpress.id)) {
      usedImages.add(uploadedImage.wordpress.id);
      replacedCount++;
      const mediaId = uploadedImage.wordpress.id;
      const src = uploadedImage.wordpress.url;
      const alt = uploadedImage.altText || uploadedImage.description || '';
      const caption = uploadedImage.caption || '';
      return `[caption id="attachment_${mediaId}" align="aligncenter" width="800"]<img class="wp-image-${mediaId}" src="${src}" alt="${alt}" width="800" height="auto" /> ${caption}[/caption]`;
    }

    // If no uploaded image found for this marker's UUID, remove the marker
    return '';
  });

  console.log(`🎉 Image marker replacement (UUID) completed. ${replacedCount} images replaced.`);
  return updatedContent;
}