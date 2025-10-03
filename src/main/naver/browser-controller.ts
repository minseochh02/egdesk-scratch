// browser-controller.ts
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { clipboard } from 'electron';
import path from 'path';
// We'll use a simple UUID generator instead of importing uuid
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface NaverBlogSettings {
  username: string;
  password: string;
  proxyUrl?: string;
}

export interface BlogContent {
  title: string;
  content: string;
  tags: string;
}

export interface BrowserControllerResult {
  success: boolean;
  error?: string;
  imageGenerated?: boolean;
}

/**
 * Convert HTML content to SmartEditor JSON format
 */
function convertHtmlToSmartEditorJson(title: string, htmlContent: string, tags: string, imagePath?: string): any {
  const documentId = generateUUID();
  
  // Process content for images first
  const { content: processedContent, imagePlaceholders } = processContentWithImagesForJson(htmlContent, imagePath);
  
  // Create the base document structure
  const document = {
    version: "2.8.10",
    theme: "default",
    language: "ko-KR",
    id: documentId,
    di: {
      dif: false,
      dio: [
        {
          dis: "N",
          dia: {
            t: 0,
            p: 0,
            st: 715,
            sk: 51
          }
        }
      ]
    },
    components: [] as any[]
  };

  // Add title component
  const titleComponent = {
    id: `SE-${generateUUID()}`,
    layout: "default",
    title: [
      {
        id: `SE-${generateUUID()}`,
        nodes: [
          {
            id: `SE-${generateUUID()}`,
            value: title,
            "@ctype": "textNode"
          }
        ],
        "@ctype": "paragraph"
      }
    ],
    subTitle: null,
    align: "left",
    "@ctype": "documentTitle"
  };
  document.components.push(titleComponent);

  // Parse HTML content and convert to SmartEditor components
  const contentComponents = parseHtmlToComponents(processedContent);
  
  // Replace image component markers with actual image components
  const finalComponents = contentComponents.map((component: any) => {
    if (component.value && Array.isArray(component.value)) {
      component.value = component.value.map((paragraph: any) => {
        if (paragraph.nodes && Array.isArray(paragraph.nodes)) {
          paragraph.nodes = paragraph.nodes.map((node: any) => {
            if (node.value && typeof node.value === 'string') {
              // Check if this node contains an image component marker
              const imageMarkerMatch = node.value.match(/\[IMAGE_COMPONENT_(\d+)\]/);
              if (imageMarkerMatch) {
                const imageIndex = parseInt(imageMarkerMatch[1]);
                if (imagePlaceholders[imageIndex]) {
                  // Return the image component instead of text
                  return imagePlaceholders[imageIndex];
                }
              }
            }
            return node;
          });
        }
        return paragraph;
      });
    }
    return component;
  });
  
  document.components.push(...finalComponents);

  // Add tags as a text component
  if (tags) {
    const tagsComponent = {
      id: `SE-${generateUUID()}`,
      layout: "default",
      value: [
        {
          id: `SE-${generateUUID()}`,
          nodes: [
            {
              id: `SE-${generateUUID()}`,
              value: tags,
              style: {
                fontColor: "#666666",
                bold: false,
                italic: true,
                underline: false,
                strikeThrough: false,
                "@ctype": "nodeStyle"
              },
              "@ctype": "textNode"
            }
          ],
          style: {
            textAlign: "left",
            "@ctype": "paragraphStyle"
          },
          "@ctype": "paragraph"
        }
      ],
      "@ctype": "text"
    };
    document.components.push(tagsComponent);
  }

  return { document };
}

/**
 * Convert HTML content to SmartEditor JSON format with real image components
 */
function convertHtmlToSmartEditorJsonWithImages(title: string, htmlContent: string, tags: string, imageComponents: any[]): any {
  const documentId = generateUUID();
  
  // Create the base document structure
  const document = {
    version: "2.8.10",
    theme: "default",
    language: "ko-KR",
    id: documentId,
    di: {
      dif: false,
      dio: [
        {
          dis: "N",
          dia: {
            t: 0,
            p: 0,
            st: 715,
            sk: 51
          }
        }
      ]
    },
    components: [] as any[]
  };

  // Add title component
  const titleComponent = {
    id: `SE-${generateUUID()}`,
    layout: "default",
    title: [
      {
        id: `SE-${generateUUID()}`,
        nodes: [
          {
            id: `SE-${generateUUID()}`,
            value: title,
            "@ctype": "textNode"
          }
        ],
        "@ctype": "paragraph"
      }
    ],
    subTitle: null,
    align: "left",
    "@ctype": "documentTitle"
  };
  document.components.push(titleComponent);

  // Parse HTML content and convert to SmartEditor components
  const contentComponents = parseHtmlToComponents(htmlContent);
  
  // Replace image component markers with actual image components
  const finalComponents = contentComponents.map((component: any) => {
    if (component.value && Array.isArray(component.value)) {
      component.value = component.value.map((paragraph: any) => {
        if (paragraph.nodes && Array.isArray(paragraph.nodes)) {
          paragraph.nodes = paragraph.nodes.map((node: any) => {
            if (node.value && typeof node.value === 'string') {
              // Check if this node contains an image component marker
              const imageMarkerMatch = node.value.match(/\[IMAGE_COMPONENT_(\d+)\]/);
              if (imageMarkerMatch) {
                const imageIndex = parseInt(imageMarkerMatch[1]);
                if (imageComponents[imageIndex]) {
                  // Return the real image component instead of text
                  return imageComponents[imageIndex];
                }
              }
            }
            return node;
          });
        }
        return paragraph;
      });
    }
    return component;
  });
  
  document.components.push(...finalComponents);

  // Add tags as a text component
  if (tags) {
    const tagsComponent = {
      id: `SE-${generateUUID()}`,
      layout: "default",
      value: [
        {
          id: `SE-${generateUUID()}`,
          nodes: [
            {
              id: `SE-${generateUUID()}`,
              value: tags,
              style: {
                fontColor: "#666666",
                bold: false,
                italic: true,
                underline: false,
                strikeThrough: false,
                "@ctype": "nodeStyle"
              },
              "@ctype": "textNode"
            }
          ],
          style: {
            textAlign: "left",
            "@ctype": "paragraphStyle"
          },
          "@ctype": "paragraph"
        }
      ],
      "@ctype": "text"
    };
    document.components.push(tagsComponent);
  }

  return { document };
}

/**
 * Parse HTML content and convert to SmartEditor components
 */
function parseHtmlToComponents(htmlContent: string): any[] {
  const components: any[] = [];
  
  // Enhanced HTML parser - handle block elements and line breaks
  const blockElements = ['<h1>', '<h2>', '<h3>', '<h4>', '<h5>', '<h6>', '<p>', '<div>', '<ul>', '<ol>', '<li>'];
  const lineBreakElements = ['<br>', '<br/>', '<br />'];
  
  // First, normalize line breaks and handle <br> tags
  let normalizedContent = htmlContent;
  
  // Replace <br> tags with line break markers
  lineBreakElements.forEach(brTag => {
    normalizedContent = normalizedContent.replace(new RegExp(brTag, 'gi'), '\n');
  });
  
  // Handle multiple consecutive line breaks (paragraph breaks)
  normalizedContent = normalizedContent.replace(/\n\s*\n/g, '\n\n');
  
  // Split content by block elements and process each part
  let remainingContent = normalizedContent;
  let componentIndex = 0;
  
  while (remainingContent.length > 0) {
    // Find the next block element
    let nextBlockIndex = -1;
    let nextBlockTag = '';
    
    for (const tag of blockElements) {
      const index = remainingContent.indexOf(tag);
      if (index !== -1 && (nextBlockIndex === -1 || index < nextBlockIndex)) {
        nextBlockIndex = index;
        nextBlockTag = tag;
      }
    }
    
    if (nextBlockIndex === -1) {
      // No more block elements, process remaining text
      if (remainingContent.trim()) {
        const textComponents = createTextComponentsWithLineBreaks(remainingContent.trim());
        components.push(...textComponents);
      }
      break;
    }
    
    // Process text before the block element
    if (nextBlockIndex > 0) {
      const beforeText = remainingContent.substring(0, nextBlockIndex).trim();
      if (beforeText) {
        const textComponents = createTextComponentsWithLineBreaks(beforeText);
        components.push(...textComponents);
      }
    }
    
    // Process the block element
    const blockEndTag = nextBlockTag.replace('<', '</');
    const blockEndIndex = remainingContent.indexOf(blockEndTag, nextBlockIndex);
    
    if (blockEndIndex !== -1) {
      const blockContent = remainingContent.substring(nextBlockIndex + nextBlockTag.length, blockEndIndex);
      const fullTag = remainingContent.substring(nextBlockIndex, blockEndIndex + blockEndTag.length);
      const blockComponent = createBlockComponent(nextBlockTag, blockContent, fullTag);
      if (blockComponent) {
        components.push(blockComponent);
      }
      remainingContent = remainingContent.substring(blockEndIndex + blockEndTag.length);
    } else {
      // No closing tag found, treat as text
      const textComponents = createTextComponentsWithLineBreaks(remainingContent.substring(nextBlockIndex));
      components.push(...textComponents);
      break;
    }
  }
  
  return components;
}

/**
 * Create a text component from HTML content
 */
function createTextComponent(htmlContent: string): any | null {
  if (!htmlContent.trim()) return null;
  
  // Parse inline styles and text
  const nodes = parseInlineStyles(htmlContent);
  
  return {
    id: `SE-${generateUUID()}`,
    layout: "default",
    value: [
      {
        id: `SE-${generateUUID()}`,
        nodes: nodes,
        style: {
          textAlign: "left",
          "@ctype": "paragraphStyle"
        },
        "@ctype": "paragraph"
      }
    ],
    "@ctype": "text"
  };
}

/**
 * Create text components with proper line break handling
 */
function createTextComponentsWithLineBreaks(htmlContent: string): any[] {
  if (!htmlContent.trim()) return [];
  
  const components: any[] = [];
  
  // Split by double line breaks (paragraph breaks)
  const paragraphs = htmlContent.split(/\n\s*\n/);
  
  paragraphs.forEach(paragraph => {
    if (paragraph.trim()) {
      // Handle single line breaks within paragraphs
      const lines = paragraph.split(/\n/);
      
      lines.forEach((line, lineIndex) => {
        if (line.trim()) {
          // Parse inline styles and text for this line
          const nodes = parseInlineStyles(line.trim());
          
          if (nodes.length > 0) {
            const component = {
              id: `SE-${generateUUID()}`,
              layout: "default",
              value: [
                {
                  id: `SE-${generateUUID()}`,
                  nodes: nodes,
                  style: {
                    textAlign: "left",
                    "@ctype": "paragraphStyle"
                  },
                  "@ctype": "paragraph"
                }
              ],
              "@ctype": "text"
            };
            
            components.push(component);
            console.log(`[NAVER] DEBUG: Created text component for line: "${line.trim().substring(0, 50)}..."`);
          }
        }
      });
    }
  });
  
  return components;
}

/**
 * Create a block component (heading, list, etc.) from HTML content
 */
function createBlockComponent(tag: string, content: string, fullTag?: string): any | null {
  if (!content.trim()) return null;
  
  const nodes = parseInlineStyles(content);
  
  // Parse inline styles from the full tag if provided
  let inlineStyles: any = {};
  if (fullTag) {
    const styleMatch = fullTag.match(/style="([^"]*)"/);
    if (styleMatch) {
      inlineStyles = parseInlineStyleString(styleMatch[1]);
    }
  }
  
  // Determine component type based on tag
  let componentType = "text";
  let textAlign = "left";
  let paragraphStyle: any = {
    textAlign: textAlign,
    "@ctype": "paragraphStyle"
  };
  
  if (tag.startsWith('<h')) {
    componentType = "text";
    textAlign = "left";
    
    // For headings, make the text bold and potentially larger
    if (nodes.length > 0 && nodes[0].style) {
      nodes[0].style.bold = true;
      // SmartEditor handles heading sizes through different mechanisms
    }
  } else if (tag === '<ul>' || tag === '<ol>') {
    componentType = "text";
    textAlign = "left";
    
    // Apply list-specific styles from inline styles
    if (inlineStyles.color) {
      console.log(`[NAVER] DEBUG: Applying color ${inlineStyles.color} to list content`);
      // Apply color to all text nodes
      nodes.forEach(node => {
        if (node.style) {
          node.style.fontColor = inlineStyles.color;
        }
      });
    }
    
    // Apply line height if specified
    if (inlineStyles.lineHeight) {
      console.log(`[NAVER] DEBUG: Applying line-height ${inlineStyles.lineHeight} to list`);
      paragraphStyle.lineHeight = inlineStyles.lineHeight;
    }
    
    // Apply margin-left as indentation (convert to appropriate SmartEditor format)
    if (inlineStyles.marginLeft) {
      const marginValue = parseInt(inlineStyles.marginLeft);
      console.log(`[NAVER] DEBUG: Applying margin-left ${marginValue}px to list`);
      if (marginValue > 0) {
        // Add indentation spaces based on margin
        const indentSpaces = ' '.repeat(Math.min(marginValue / 10, 10)); // Max 10 spaces
        if (nodes.length > 0 && nodes[0].value) {
          nodes[0].value = indentSpaces + nodes[0].value;
        }
      }
    }
    
    // Apply font-family if specified
    if (inlineStyles.fontFamily) {
      console.log(`[NAVER] DEBUG: Applying font-family ${inlineStyles.fontFamily} to list`);
      // Note: SmartEditor may not support custom font families, but we can log it
    }
    
    // For lists, we'll add bullet points or numbers as text
    // and apply list-like formatting
    if (nodes.length > 0) {
      // Add bullet point or number prefix
      const listPrefix = tag === '<ul>' ? '• ' : '1. ';
      if (nodes[0].value) {
        nodes[0].value = listPrefix + nodes[0].value;
      }
    }
  } else if (tag === '<li>') {
    componentType = "text";
    textAlign = "left";
    
    // Apply list item styles
    if (inlineStyles.color) {
      nodes.forEach(node => {
        if (node.style) {
          node.style.fontColor = inlineStyles.color;
        }
      });
    }
    
    // For list items, add appropriate indentation and bullet/number
    if (nodes.length > 0) {
      // Add bullet point prefix for list items
      if (nodes[0].value) {
        nodes[0].value = '• ' + nodes[0].value;
      }
    }
  } else if (tag === '<p>') {
    componentType = "text";
    textAlign = "left";
    
    // Apply paragraph-specific styles
    if (inlineStyles.color) {
      console.log(`[NAVER] DEBUG: Applying color ${inlineStyles.color} to paragraph`);
      nodes.forEach(node => {
        if (node.style) {
          node.style.fontColor = inlineStyles.color;
        }
      });
    }
    
    if (inlineStyles.lineHeight) {
      console.log(`[NAVER] DEBUG: Applying line-height ${inlineStyles.lineHeight} to paragraph`);
      paragraphStyle.lineHeight = inlineStyles.lineHeight;
    }
    
    if (inlineStyles.textAlign) {
      console.log(`[NAVER] DEBUG: Applying text-align ${inlineStyles.textAlign} to paragraph`);
      paragraphStyle.textAlign = inlineStyles.textAlign;
    }
  }
  
  return {
    id: `SE-${generateUUID()}`,
    layout: "default",
    value: [
      {
        id: `SE-${generateUUID()}`,
        nodes: nodes,
        style: paragraphStyle,
        "@ctype": "paragraph"
      }
    ],
    "@ctype": componentType
  };
}

/**
 * Parse inline styles and create text nodes
 */
function parseInlineStyles(htmlContent: string): any[] {
  const nodes: any[] = [];
  
  // Enhanced inline style parser that handles both simple tags and inline styles
  let remainingContent = htmlContent;
  
  while (remainingContent.length > 0) {
    // Look for any HTML tag (including inline styles)
    const tagMatch = remainingContent.match(/<(\w+)(?:\s+[^>]*)?>(.*?)<\/\1>/);
    
    if (!tagMatch) {
      // No more HTML tags, add remaining text
      if (remainingContent.trim()) {
        nodes.push(createTextNode(remainingContent.trim()));
      }
      break;
    }
    
    const fullTag = tagMatch[0];
    const tagName = tagMatch[1];
    const tagContent = tagMatch[2];
    const tagIndex = remainingContent.indexOf(fullTag);
    
    // Add text before the tag
    if (tagIndex > 0) {
      const beforeText = remainingContent.substring(0, tagIndex).trim();
      if (beforeText) {
        nodes.push(createTextNode(beforeText));
      }
    }
    
    // Parse the tag for inline styles
    const styleMatch = fullTag.match(/style="([^"]*)"/);
    let inlineStyles: any = {};
    
    if (styleMatch) {
      inlineStyles = parseInlineStyleString(styleMatch[1]);
    }
    
    // Check if the tag content contains nested HTML tags
    if (tagContent.includes('<') && tagContent.includes('>')) {
      // Recursively parse nested content
      console.log(`[NAVER] DEBUG: Found nested HTML in ${tagName} tag: "${tagContent.substring(0, 100)}..."`);
      const nestedNodes = parseInlineStyles(tagContent);
      // Apply the current tag's styling to all nested nodes
      nestedNodes.forEach(nestedNode => {
        if (nestedNode.style) {
          // Apply tag-based styling
          if (tagName === 'strong' || tagName === 'b') {
            nestedNode.style.bold = true;
            console.log(`[NAVER] DEBUG: Applied bold styling to nested content: "${nestedNode.value}"`);
          } else if (tagName === 'em' || tagName === 'i') {
            nestedNode.style.italic = true;
            console.log(`[NAVER] DEBUG: Applied italic styling to nested content: "${nestedNode.value}"`);
          } else if (tagName === 'u') {
            nestedNode.style.underline = true;
            console.log(`[NAVER] DEBUG: Applied underline styling to nested content: "${nestedNode.value}"`);
          }
          
          // Apply inline styles (override tag-based styles)
          if (inlineStyles.bold !== undefined) nestedNode.style.bold = inlineStyles.bold;
          if (inlineStyles.italic !== undefined) nestedNode.style.italic = inlineStyles.italic;
          if (inlineStyles.underline !== undefined) nestedNode.style.underline = inlineStyles.underline;
          if (inlineStyles.strikeThrough !== undefined) nestedNode.style.strikeThrough = inlineStyles.strikeThrough;
          if (inlineStyles.fontColor) nestedNode.style.fontColor = inlineStyles.fontColor;
          if (inlineStyles.backgroundColor) nestedNode.style.backgroundColor = inlineStyles.backgroundColor;
          if (inlineStyles.fontSize) nestedNode.style.fontSize = inlineStyles.fontSize;
        }
      });
      nodes.push(...nestedNodes);
    } else {
      // Add the styled text
      if (tagName === 'strong' || tagName === 'b') {
        console.log(`[NAVER] DEBUG: Creating bold text node: "${tagContent}"`);
      } else if (tagName === 'em' || tagName === 'i') {
        console.log(`[NAVER] DEBUG: Creating italic text node: "${tagContent}"`);
      } else if (tagName === 'u') {
        console.log(`[NAVER] DEBUG: Creating underline text node: "${tagContent}"`);
      }
      nodes.push(createTextNode(tagContent, tagName, inlineStyles));
    }
    
    // Update remaining content
    remainingContent = remainingContent.substring(tagIndex + fullTag.length);
  }
  
  return nodes;
}

/**
 * Parse inline style string into style object
 */
function parseInlineStyleString(styleString: string): any {
  const styles: any = {};
  
  if (!styleString) return styles;
  
  // Split by semicolon and parse each style
  const stylePairs = styleString.split(';');
  
  for (const pair of stylePairs) {
    const [property, value] = pair.split(':').map(s => s.trim());
    if (property && value) {
      switch (property) {
        case 'font-weight':
          if (value === 'bold' || parseInt(value) >= 700) {
            styles.bold = true;
          }
          break;
        case 'font-style':
          if (value === 'italic') {
            styles.italic = true;
          }
          break;
        case 'text-decoration':
          if (value.includes('underline')) {
            styles.underline = true;
          }
          if (value.includes('line-through')) {
            styles.strikeThrough = true;
          }
          break;
        case 'color':
          styles.color = value;
          styles.fontColor = value; // Also set fontColor for compatibility
          break;
        case 'background-color':
          styles.backgroundColor = value;
          break;
        case 'font-size':
          // Convert font size to a reasonable scale
          const fontSize = parseInt(value);
          if (fontSize > 20) {
            styles.fontSize = 'large';
          } else if (fontSize < 12) {
            styles.fontSize = 'small';
          }
          break;
        case 'line-height':
          styles.lineHeight = value;
          break;
        case 'margin-left':
          styles.marginLeft = value;
          break;
        case 'margin-right':
          styles.marginRight = value;
          break;
        case 'margin-top':
          styles.marginTop = value;
          break;
        case 'margin-bottom':
          styles.marginBottom = value;
          break;
        case 'font-family':
          styles.fontFamily = value;
          break;
        case 'text-align':
          styles.textAlign = value;
          break;
        case 'list-style-type':
          styles.listStyleType = value;
          break;
      }
    }
  }
  
  return styles;
}

/**
 * Create a text node with optional styling
 */
function createTextNode(text: string, tagName?: string, inlineStyles?: any): any {
  const node: any = {
    id: `SE-${generateUUID()}`,
    value: text,
    style: {
      bold: false,
      italic: false,
      underline: false,
      strikeThrough: false,
      "@ctype": "nodeStyle"
    },
    "@ctype": "textNode"
  };
  
  // Apply tag-based styling
  if (tagName === 'strong' || tagName === 'b') {
    node.style.bold = true;
  } else if (tagName === 'em' || tagName === 'i') {
    node.style.italic = true;
  } else if (tagName === 'u') {
    node.style.underline = true;
  } else if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
    node.style.bold = true;
    // Headings are typically larger, but SmartEditor handles this differently
  }
  
  // Apply inline styles (override tag-based styles)
  if (inlineStyles) {
    if (inlineStyles.bold !== undefined) node.style.bold = inlineStyles.bold;
    if (inlineStyles.italic !== undefined) node.style.italic = inlineStyles.italic;
    if (inlineStyles.underline !== undefined) node.style.underline = inlineStyles.underline;
    if (inlineStyles.strikeThrough !== undefined) node.style.strikeThrough = inlineStyles.strikeThrough;
    if (inlineStyles.fontColor) node.style.fontColor = inlineStyles.fontColor;
    if (inlineStyles.backgroundColor) node.style.backgroundColor = inlineStyles.backgroundColor;
    if (inlineStyles.fontSize) node.style.fontSize = inlineStyles.fontSize;
  }
  
  return node;
}

/**
 * Test function to verify HTML parsing (for debugging)
 */
function testHtmlParsing() {
  const testHtml = '<h2 style="font-family: Arial, sans-serif; color: #2c3e50;">Test Heading</h2><p style="color: #333;">Test paragraph with <strong>bold</strong> text.</p>';
  const result = convertHtmlToSmartEditorJson('Test Title', testHtml, '#test #ai');
  console.log('Test HTML parsing result:', JSON.stringify(result, null, 2));
}

/**
 * Test function to verify nested HTML parsing (for debugging)
 */
function testNestedHtmlParsing() {
  const testHtml = '<ul style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; list-style-type: disc; margin-left: 20px;"><strong>Machine Learning (ML)</strong>: This is perhaps the most widely recognized subset of AI.</ul>';
  const result = convertHtmlToSmartEditorJson('Test Title', testHtml, '#test #ai');
  console.log('Test nested HTML parsing result:', JSON.stringify(result, null, 2));
}

/**
 * Test function to verify all HTML formatting (strong, em, ul, li) with CSS styles
 */
export function testAllHtmlFormatting() {
  const testHtml = `
<h2>AI Technologies Overview</h2>
<p>Here are the key <strong>AI technologies</strong> you should know about:</p>
<ul style="list-style-type: disc; margin-left: 25px; font-family: Arial, sans-serif; line-height: 1.6; color: #555;">
  <li><strong>Machine Learning (ML)</strong>: This is perhaps the most <em>widely recognized</em> subset of AI.</li>
  <li><strong>Natural Language Processing (NLP)</strong>: NLP focuses on the interaction between computers and human language.</li>
  <li><strong>Computer Vision</strong>: This field enables machines to <em>interpret and understand</em> visual information.</li>
</ul>
<p>These technologies work together to create <em>intelligent systems</em> that can <strong>learn and adapt</strong>.</p>
`;
  
  console.log('Testing all HTML formatting with CSS styles (strong, em, ul, li, h2, color, line-height, margin)...');
  const result = convertHtmlToSmartEditorJson('AI Technologies', testHtml, '#ai #ml #nlp');
  
  // Check if formatting is applied correctly
  const components = result.document.components;
  components.forEach((component: any, index: number) => {
    if (component['@ctype'] === 'text' && component.value) {
      console.log(`\nComponent ${index}:`);
      component.value.forEach((paragraph: any) => {
        if (paragraph.nodes) {
          paragraph.nodes.forEach((node: any) => {
            if (node['@ctype'] === 'textNode') {
              console.log(`  Text: "${node.value}"`);
              console.log(`  Bold: ${node.style?.bold || false}`);
              console.log(`  Italic: ${node.style?.italic || false}`);
              console.log(`  Underline: ${node.style?.underline || false}`);
              console.log(`  Font Color: ${node.style?.fontColor || 'default'}`);
            }
          });
        }
        console.log(`  Paragraph Line Height: ${paragraph.style?.lineHeight || 'default'}`);
      });
    }
  });
  
  return result;
}

/**
 * Test function to verify line break and spacing handling
 */
export function testLineBreakHandling() {
  const testHtml = `
<h2>Line Break Testing</h2>
<p>This is the first paragraph with some text.</p>
<p>This is the second paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
<p>This paragraph has a line break<br>in the middle of it.</p>
<p>This paragraph has multiple<br><br>line breaks for spacing.</p>
<ul style="color: #333; line-height: 1.5;">
  <li>First list item</li>
  <li>Second list item with <strong>bold</strong> text</li>
  <li>Third list item with<br>line break</li>
</ul>
<p>Final paragraph after the list.</p>
`;
  
  console.log('Testing line break and spacing handling...');
  const result = convertHtmlToSmartEditorJson('Line Break Test', testHtml, '#test #spacing');
  
  // Check if line breaks are handled correctly
  const components = result.document.components;
  console.log(`\nTotal components created: ${components.length}`);
  
  components.forEach((component: any, index: number) => {
    if (component['@ctype'] === 'text' && component.value) {
      console.log(`\nComponent ${index}:`);
      component.value.forEach((paragraph: any, pIndex: number) => {
        console.log(`  Paragraph ${pIndex}:`);
        if (paragraph.nodes) {
          paragraph.nodes.forEach((node: any) => {
            if (node['@ctype'] === 'textNode') {
              console.log(`    Text: "${node.value}"`);
              console.log(`    Bold: ${node.style?.bold || false}`);
              console.log(`    Italic: ${node.style?.italic || false}`);
              console.log(`    Font Color: ${node.style?.fontColor || 'default'}`);
            }
          });
        }
        console.log(`    Line Height: ${paragraph.style?.lineHeight || 'default'}`);
      });
    }
  });
  
  return result;
}

/**
 * Test function to verify the specific HTML content from the user
 */
export function testUserHtmlParsing() {
  const testHtml = `
<ul style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; list-style-type: disc; margin-left: 20px;">
  <strong>Machine Learning (ML)</strong>: This is perhaps the most <em>widely recognized</em> subset of AI. ML involves training algorithms on vast amounts of data to enable them to learn patterns and make predictions or decisions without being explicitly programmed for every scenario. Think of recommendation engines on streaming platforms or fraud detection systems.
  <strong>Natural Language Processing (NLP)</strong>: NLP focuses on the interaction between computers and human language. It allows machines to <em>read and understand</em> text.
</ul>
`;
  
  console.log('Testing HTML parsing with user content (including <em> and <ul> tags)...');
  const result = convertHtmlToSmartEditorJson('AI Article', testHtml, '#ai #machinelearning');
  
  // Check if formatting is applied correctly
  const components = result.document.components;
  components.forEach((component: any, index: number) => {
    if (component['@ctype'] === 'text' && component.value) {
      console.log(`\nComponent ${index}:`);
      component.value.forEach((paragraph: any) => {
        if (paragraph.nodes) {
          paragraph.nodes.forEach((node: any) => {
            if (node['@ctype'] === 'textNode') {
              console.log(`  Text: "${node.value}"`);
              console.log(`  Bold: ${node.style?.bold || false}`);
              console.log(`  Italic: ${node.style?.italic || false}`);
              console.log(`  Underline: ${node.style?.underline || false}`);
            }
          });
        }
      });
    }
  });
  
  return result;
}

/**
 * Build proxy configuration from URL
 */
function buildProxyOption(proxyUrl?: string) {
  try {
    if (!proxyUrl) return undefined;
    const u = new URL(String(proxyUrl));
    const server = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
    const proxy: any = { server };
    if (u.username) proxy.username = decodeURIComponent(u.username);
    if (u.password) proxy.password = decodeURIComponent(u.password);
    return proxy;
  } catch {
    return undefined;
  }
}

/**
 * Launch browser with Chrome preference and fallback
 */
async function launchBrowser(proxyUrl?: string): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const proxy = buildProxyOption(proxyUrl);
  
  try {
    // Try to use system Chrome first
    const browser = await chromium.launch({ 
      headless: false,
      channel: 'chrome',  // Uses system Chrome
      proxy
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    return { browser, context, page };
  } catch (error) {
    if (error instanceof Error && error.message.includes('channel')) {
      // Fallback if Chrome isn't installed
      console.log('Chrome not found, using default Chromium');
      const browser = await chromium.launch({ 
        headless: false,
        proxy
      });
      const context = await browser.newContext();
      const page = await context.newPage();
      return { browser, context, page };
    }
    throw error;
  }
}

/**
 * Handle Naver login process
 */
async function handleNaverLogin(page: Page, username: string, password: string): Promise<boolean> {
  try {
    console.log('[NAVER] Starting Naver login process...');
    await page.goto('https://nid.naver.com/nidlogin.login');
    
    if (username) await page.fill('input#id, input[name="id"]', String(username));
    if (password) await page.fill('input#pw, input[name="pw"]', String(password));
    
    const loginButtonSelector = 'button[type="submit"], input[type="submit"], button#log.login';
    if (username && password) {
      await page.click(loginButtonSelector).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Navigate to Naver Blog home after login
      const targetUrl = 'https://section.blog.naver.com/BlogHome.naver?directoryNo=0&currentPage=1&groupId=0';
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      
      console.log('[NAVER] Login process completed');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[NAVER] Login failed:', error);
    return false;
  }
}

/**
 * Open Naver Blog write page in new window
 */
async function openBlogWritePage(context: BrowserContext, page: Page): Promise<Page | null> {
  try {
    console.log('[NAVER] Opening blog write page...');
    const writeSelector = 'a[href="https://blog.naver.com/GoBlogWrite.naver"]';
    await page.waitForSelector(writeSelector, { timeout: 15000 }).catch(() => {});
    
    const [newPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 15000 }),
      page.click(writeSelector)
    ]);
    
    await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    console.log('[NAVER] Blog write page opened successfully');
    return newPage;
  } catch (error) {
    console.error('[NAVER] Failed to open blog write page:', error);
    return null;
  }
}

/**
 * Handle various popups that may appear on the blog write page
 */
async function handlePopups(pageOrFrame: any, newPage: Page): Promise<void> {
  try {
    console.log('[NAVER] Handling popups...');
    
    // Draft popup handling
    try {
      console.log('[NAVER] Checking for draft popup...');
      const confirmBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[2]/div[3]/button[2]');
      const cancelBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[2]/div[3]/button[1]');
      
      if (await confirmBtn.count() > 0) {
        console.log('[NAVER] Draft popup found - clicking confirm');
        await confirmBtn.click({ timeout: 3000 }).catch(() => {});
        await newPage.waitForTimeout(1000);
      } else if (await cancelBtn.count() > 0) {
        console.log('[NAVER] Draft popup found - clicking cancel');
        await cancelBtn.click({ timeout: 3000 }).catch(() => {});
        await newPage.waitForTimeout(1000);
      }
    } catch (error) {
      console.log('[NAVER] Error handling draft popup:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Naver Blog confirmation popup
    try {
      console.log('[NAVER] Checking for confirmation popup...');
      await newPage.waitForTimeout(2000);
      
      const popupSelectors = [
        '.se-popup-alert-confirm',
        '.se-popup-alert', 
        '.se-popup',
        '[data-group="popupLayer"]',
        '.se-popup-dim'
      ];
      
      let popupFound = false;
      
      for (const selector of popupSelectors) {
        const popup = pageOrFrame.locator(selector);
        if (await popup.count() > 0) {
          console.log(`[NAVER] Found popup with selector: ${selector}`);
          popupFound = true;
          
          try {
            await popup.waitFor({ state: 'visible', timeout: 3000 });
            await newPage.waitForTimeout(1000);
            
            const buttons = pageOrFrame.locator(`${selector} button, ${selector} .btn, ${selector} [role="button"]`);
            if (await buttons.count() > 0) {
              console.log('[NAVER] Clicking popup button');
              await buttons.first().click({ timeout: 3000 }).catch(() => {});
              await newPage.waitForTimeout(1000);
            } else {
              await newPage.keyboard.press('Escape');
              await newPage.waitForTimeout(1000);
            }
            break;
          } catch (waitError) {
            await newPage.keyboard.press('Escape');
            await newPage.waitForTimeout(1000);
            break;
          }
        }
      }
      
      if (!popupFound) {
        console.log('[NAVER] No popup found - proceeding normally');
      }
    } catch (error) {
      console.log('[NAVER] Error handling confirmation popup:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Right side popup close
    try {
      const rightCloseBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/article/div/header/button');
      if (await rightCloseBtn.count()) {
        await rightCloseBtn.click({ timeout: 3000 }).catch(() => {});
        console.log('[NAVER] Right-side popup closed');
      }
    } catch {}

    // Help panel close
    try {
      const helpSelector = 'button.se-help-panel-close-button, .se-help-panel-close-button';
      let closed = false;
      const helpBtn = pageOrFrame.locator(helpSelector);
      if (await helpBtn.count()) {
        await helpBtn.first().click({ timeout: 2000 }).catch(() => {});
        closed = true;
      }
      if (!closed) {
        for (const frame of newPage.frames()) {
          try {
            const frameBtn = await frame.$(helpSelector);
            if (frameBtn) {
              await frameBtn.click({ timeout: 2000 }).catch(() => {});
              closed = true;
              break;
            }
          } catch {}
        }
      }
    } catch {}
    
    console.log('[NAVER] Popup handling completed');
  } catch (error) {
    console.error('[NAVER] Error in popup handling:', error);
  }
}


/**
 * Ensure clipboard permissions are granted (dialog + context grant)
 */
async function handleClipboardPermission(newPage: Page, context: BrowserContext): Promise<void> {
  try {
    console.log('[NAVER] Setting up clipboard permission handler...');
    newPage.on('dialog', async dialog => {
      const msg = dialog.message().toLowerCase();
      if (msg.includes('clipboard') || msg.includes('wants to') || msg.includes('see text and images')) {
        console.log('[NAVER] Clipboard permission dialog detected, accepting...');
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://blog.naver.com' });
      console.log('[NAVER] Clipboard permissions granted via context');
    } catch (permErr) {
      console.log('[NAVER] Context permission grant failed:', permErr instanceof Error ? permErr.message : 'Unknown error');
    }
    // Probe clipboard to trigger permission prompt if needed
    try {
      await newPage.waitForTimeout(1000);
      await newPage.evaluate(async () => {
        try {
          await navigator.clipboard.read();
        } catch {}
      });
    } catch {}
  } catch (error) {
    console.log('[NAVER] Error setting up clipboard permissions:', error instanceof Error ? error.message : 'Unknown error');
  }
}


/**
 * Add image to blog post using clipboard paste
 * @param targetField - The original content field we typed content into
 */
async function addImageToBlog(pageOrFrame: any, newPage: Page, imagePath: string, targetField?: any): Promise<boolean> {
  try {
    console.log('[NAVER] Adding image to blog post...');
    
    // Copy image to clipboard using Playwright
    const { copyImageToClipboardWithPlaywright } = require('../ai-blog/generate-dog-image');
    const clipboardSuccess = await copyImageToClipboardWithPlaywright(imagePath, newPage);
    
    if (!clipboardSuccess) {
      console.warn('[NAVER] Failed to copy image to clipboard');
      return false;
    }
    
    console.log('[NAVER] Clipboard copy successful, attempting to paste...');
    
    // Phase 1: Click on the main content area
    console.log('[NAVER] Clicking on main content area...');
    const contentArea = pageOrFrame.locator('.se-content.__se-scroll-target');
    const contentAreaCount = await contentArea.count();
    console.log(`[NAVER] Found ${contentAreaCount} content area(s)`);
    
    if (contentAreaCount > 0) {
      try {
        await contentArea.first().click({ timeout: 10000 });
        console.log('[NAVER] Clicked on main content area');
      } catch (error) {
        console.log('[NAVER] Failed to click content area, trying alternative approach');
        // Fallback: try to focus on the area
        await contentArea.first().focus();
        console.log('[NAVER] Focused on main content area');
      }
    } else {
      console.log('[NAVER] No content area found, using targetField or body');
      if (targetField) {
        await targetField.click();
      } else {
        await newPage.click('body');
      }
    }
    
    await newPage.waitForTimeout(500);
    
    // Phase 2: Try multiple paste methods - use targetField for right-click like working code
    console.log('[NAVER] Method 1: Using Control+v');
    await newPage.keyboard.press('Control+v');
    await newPage.waitForTimeout(2000);
    
    // Check if image was pasted by looking for img tags
    let imgCount = await newPage.locator('img').count();
    console.log(`[NAVER] Found ${imgCount} images on page after paste attempt`);
    
    if (imgCount === 0) {
      console.log('[NAVER] Method 1 failed, trying Method 2: Right-click paste on targetField');
      // Right-click on original targetField like working code does
      if (targetField) {
        await targetField.click({ button: 'right' });
      } else {
        await pageOrFrame.locator('[contenteditable="true"]').first().click({ button: 'right' });
      }
      await newPage.waitForTimeout(500);
      await newPage.keyboard.press('v'); // Paste from context menu
      await newPage.waitForTimeout(2000);
      
      imgCount = await newPage.locator('img').count();
      console.log(`[NAVER] Found ${imgCount} images after right-click paste`);
      
      if (imgCount === 0) {
        console.log('[NAVER] Method 2 failed, trying Method 3: Focus targetField and paste');
        try {
          console.log('[NAVER] Method 3a: Focus targetField and paste with keyboard');
          if (targetField) {
            await targetField.focus();
          } else {
            await pageOrFrame.locator('[contenteditable="true"]').first().focus();
          }
          await newPage.waitForTimeout(200);
          await newPage.keyboard.press('Control+v');
          await newPage.waitForTimeout(2000);
          
          imgCount = await newPage.locator('img').count();
          console.log(`[NAVER] Found ${imgCount} images after focus paste`);
          
          if (imgCount === 0) {
            console.log('[NAVER] Method 3b: Try pasting with Shift+Insert');
            await newPage.keyboard.press('Shift+Insert');
            await newPage.waitForTimeout(2000);
            
            imgCount = await newPage.locator('img').count();
            console.log(`[NAVER] Found ${imgCount} images after Shift+Insert paste`);
            
            if (imgCount === 0) {
              console.log('[NAVER] Method 3c: Try pasting with Cmd+V (Mac)');
              await newPage.keyboard.press('Meta+v');
              await newPage.waitForTimeout(2000);
              
              imgCount = await newPage.locator('img').count();
              console.log(`[NAVER] Found ${imgCount} images after Cmd+V paste`);
            }
          }
        } catch (altPasteError) {
          console.log('[NAVER] Alternative paste methods failed:', altPasteError instanceof Error ? altPasteError.message : 'Unknown error');
        }
      }
    }
    
    // Final check for images
    const finalImgCount = await newPage.locator('img').count();
    if (finalImgCount > 0) {
      console.log('[NAVER] Image pasted successfully!');
      return true;
    } else {
      console.warn('[NAVER] All paste methods failed - no images found on page');
      return false;
    }
  } catch (error) {
    console.error('[NAVER] Error adding image to blog:', error);
    return false;
  }
}

/**
 * Process content and handle image placeholders
 */
async function processContentWithImages(pageOrFrame: any, newPage: Page, content: BlogContent, imagePath?: string, targetField?: any): Promise<void> {
  try {
    console.log('[NAVER] Processing content with image placeholders...');
    
    // Regex to find [IMAGE:...] placeholders
    const imagePlaceholderRegex = /\[IMAGE:([^\]]+)\]/g;
    const contentText = content.content;
    
    // Find all image placeholders
    const imageMatches = Array.from(contentText.matchAll(imagePlaceholderRegex));
    console.log(`[NAVER] Found ${imageMatches.length} image placeholders in content`);
    
    if (imageMatches.length === 0) {
      // No image placeholders, just type the content normally
      console.log('[NAVER] No image placeholders found, typing content normally');
      await newPage.keyboard.type(contentText);
      await newPage.keyboard.press('Enter');
      return;
    }
    
    // Split content by image placeholders
    let lastIndex = 0;
    const contentParts: string[] = [];
    const imagePlaceholders: string[] = [];
    
    for (const match of imageMatches) {
      const placeholder = match[0]; // Full match like [IMAGE:description:header]
      const description = match[1]; // Just the description part
      const startIndex = match.index!;
      
      // Add text before the placeholder
      if (startIndex > lastIndex) {
        contentParts.push(contentText.substring(lastIndex, startIndex));
      }
      
      // Add the placeholder info
      imagePlaceholders.push(description);
      contentParts.push(''); // Placeholder for image
      
      lastIndex = startIndex + placeholder.length;
    }
    
    // Add remaining text after last placeholder
    if (lastIndex < contentText.length) {
      contentParts.push(contentText.substring(lastIndex));
    }
    
    console.log(`[NAVER] Split content into ${contentParts.length} parts with ${imagePlaceholders.length} image placeholders`);
    
    // Process each part
    let imageIndex = 0; // Track image index separately
    for (let i = 0; i < contentParts.length; i++) {
      const part = contentParts[i];
      
      if (part !== '') {
        // Type the text content
        console.log(`[NAVER] Typing content part ${i + 1}: "${part.substring(0, 50)}..."`);
        await newPage.keyboard.type(part);
        
        // Add line break if not the last part
        if (i < contentParts.length - 1) {
          await newPage.keyboard.press('Enter');
        }
      } else {
        // This is an image placeholder position
        if (imageIndex < imagePlaceholders.length) {
          const imageDescription = imagePlaceholders[imageIndex];
          console.log(`[NAVER] Processing image placeholder ${imageIndex + 1}: "${imageDescription}"`);
          
          // Wait for content to be stable before pasting image
          await newPage.waitForTimeout(500);
          
          if (imagePath) {
            console.log('[NAVER] Attempting to paste image...');
            const imageSuccess = await addImageToBlog(pageOrFrame, newPage, imagePath, targetField);
            if (imageSuccess) {
              await newPage.keyboard.press('Enter');
              await newPage.keyboard.type(`Image: ${imageDescription} 🤖`);
              await newPage.keyboard.press('Enter');
              console.log(`[NAVER] Image pasted successfully for placeholder: ${imageDescription}`);
            } else {
              await newPage.keyboard.type(`[Image: ${imageDescription} - Paste Failed] `);
              console.log(`[NAVER] Image paste failed for placeholder: ${imageDescription}`);
            }
          } else {
            // No image path provided, just add placeholder text
            await newPage.keyboard.type(`[Image: ${imageDescription}] `);
            console.log(`[NAVER] No image path provided, added placeholder text for: ${imageDescription}`);
          }
          
          // Increment image index for next placeholder
          imageIndex++;
        }
      }
    }
    
    // Add final line break
    await newPage.keyboard.press('Enter');
    console.log('[NAVER] Content processing completed');
    
  } catch (error) {
    console.error('[NAVER] Error processing content with images:', error);
    // Fallback: just type the content normally
    await newPage.keyboard.type(content.content);
    await newPage.keyboard.press('Enter');
  }
}

/**
 * Process content and handle image placeholders for SmartEditor JSON
 */
function processContentWithImagesForJson(htmlContent: string, imagePath?: string): { content: string, imagePlaceholders: any[] } {
  try {
    console.log('[NAVER] Processing content with image placeholders for JSON...');
    
    // Regex to find [IMAGE:...] placeholders
    const imagePlaceholderRegex = /\[IMAGE:([^\]]+)\]/g;
    const imageMatches = Array.from(htmlContent.matchAll(imagePlaceholderRegex));
    console.log(`[NAVER] Found ${imageMatches.length} image placeholders in content`);
    
    if (imageMatches.length === 0) {
      return { content: htmlContent, imagePlaceholders: [] };
    }
    
    // For now, replace image placeholders with text descriptions
    // In a full implementation, you would:
    // 1. Paste the image into SmartEditor
    // 2. Extract the image JSON from SmartEditor
    // 3. Replace the placeholder with the image component
    let processedContent = htmlContent;
    const imagePlaceholders: any[] = [];
    
    for (const match of imageMatches) {
      const placeholder = match[0]; // Full match like [IMAGE:description:header]
      const description = match[1]; // Just the description part
      
      // Create a placeholder image component for now
      const imageComponent = {
        id: `SE-${generateUUID()}`,
        layout: "default",
        src: imagePath || "placeholder",
        internalResource: true,
        represent: true,
        path: imagePath || "placeholder",
        domain: "https://blogfiles.pstatic.net",
        fileSize: 0,
        width: 800,
        widthPercentage: 0,
        height: 600,
        originalWidth: 800,
        originalHeight: 600,
        fileName: "placeholder.png",
        caption: description,
        format: "normal",
        displayFormat: "normal",
        imageLoaded: true,
        contentMode: "fit",
        origin: {
          srcFrom: "local",
          "@ctype": "imageOrigin"
        },
        ai: false,
        "@ctype": "image"
      };
      
      imagePlaceholders.push(imageComponent);
      
      // Replace placeholder with a marker that we'll handle later
      processedContent = processedContent.replace(placeholder, `[IMAGE_COMPONENT_${imagePlaceholders.length - 1}]`);
    }
    
    return { content: processedContent, imagePlaceholders };
  } catch (error) {
    console.error('[NAVER] Error processing content with images for JSON:', error);
    return { content: htmlContent, imagePlaceholders: [] };
  }
}

/**
 * Advanced image handling: Paste image and extract JSON from SmartEditor
 * This function would be called during the actual blog posting process
 */
async function handleImagePlaceholdersWithSmartEditor(
  pageOrFrame: any, 
  newPage: Page, 
  htmlContent: string, 
  imagePaths?: string[]
): Promise<{ processedContent: string, imageComponents: any[] }> {
  try {
    console.log('[NAVER] Handling image placeholders with SmartEditor...');
    
    // Find image placeholders
    const imagePlaceholderRegex = /\[IMAGE:([^\]]+)\]/g;
    const imageMatches = Array.from(htmlContent.matchAll(imagePlaceholderRegex));
    
    if (imageMatches.length === 0) {
      return { processedContent: htmlContent, imageComponents: [] };
    }
    
    let processedContent = htmlContent;
    const imageComponents: any[] = [];
    
    for (let i = 0; i < imageMatches.length; i++) {
      const match = imageMatches[i];
      const placeholder = match[0];
      const description = match[1];
      
      console.log(`[NAVER] Processing image placeholder ${i + 1}: ${description}`);
      
      // Get the corresponding image path for this placeholder
      const imagePath = imagePaths && imagePaths[i] ? imagePaths[i] : undefined;
      
      if (imagePath) {
        try {
          // 1. Paste the image into SmartEditor
          const imageSuccess = await addImageToBlog(pageOrFrame, newPage, imagePath);
          
          if (imageSuccess) {
            // 2. Wait for image to be processed
            await newPage.waitForTimeout(2000);
            
            // 3. Extract the image JSON from SmartEditor
            const imageJson = await newPage.evaluate(() => {
              try {
                // Access the iframe
                const iframe = document.querySelector('#mainFrame');
                if (!iframe) return null;
                
                const iframeWindow = (iframe as HTMLIFrameElement).contentWindow;
                if (!iframeWindow) return null;
                
                // Get the editor and document data
                const editors = ((iframeWindow as any).SmartEditor && (iframeWindow as any).SmartEditor._editors) || {};
                const editorKey = Object.keys(editors).find(k => k && k.startsWith('blogpc')) || Object.keys(editors)[0];
                const editor = editorKey ? editors[editorKey] : null;
                
                if (!editor) return null;
                
                const docService = editor._documentService || editor.documentService;
                if (!docService) return null;
                
                const documentData = docService.getDocumentData();
                if (!documentData || !documentData.document || !documentData.document.components) return null;
                
                // Find the most recent image component
                const imageComponents = documentData.document.components.filter((comp: any) => comp['@ctype'] === 'image');
                return imageComponents[imageComponents.length - 1] || null;
              } catch (err) {
                console.error('[NAVER] Error extracting image JSON:', err);
                return null;
              }
            });
            
            if (imageJson) {
              console.log(`[NAVER] Successfully extracted image JSON for placeholder: ${description}`);
              imageComponents.push(imageJson);
              
              // Replace placeholder with marker
              processedContent = processedContent.replace(placeholder, `[IMAGE_COMPONENT_${imageComponents.length - 1}]`);
            } else {
              console.warn(`[NAVER] Failed to extract image JSON for placeholder: ${description}`);
              // Fallback to text description
              processedContent = processedContent.replace(placeholder, `[Image: ${description}]`);
            }
          } else {
            console.warn(`[NAVER] Failed to paste image for placeholder: ${description}`);
            processedContent = processedContent.replace(placeholder, `[Image: ${description} - Paste Failed]`);
          }
        } catch (error) {
          console.error(`[NAVER] Error handling image placeholder ${i + 1}:`, error);
          processedContent = processedContent.replace(placeholder, `[Image: ${description} - Error]`);
        }
      } else {
        // No image path provided
        processedContent = processedContent.replace(placeholder, `[Image: ${description}]`);
      }
    }
    
    return { processedContent, imageComponents };
  } catch (error) {
    console.error('[NAVER] Error handling image placeholders with SmartEditor:', error);
    return { processedContent: htmlContent, imageComponents: [] };
  }
}

/**
 * Fill blog post content using SmartEditor JSON API
 */
async function fillBlogContent(pageOrFrame: any, newPage: Page, content: BlogContent, imagePaths?: string[]): Promise<void> {
  try {
    console.log('[NAVER] Filling blog content using SmartEditor JSON API...');
    
    // Wait for editor to fully load first
    try {
      console.log('[NAVER] Waiting for SmartEditor to load...');
      
      // Wait for mainFrame to load
      await newPage.waitForSelector('#mainFrame', { timeout: 15000 });
      const frame = newPage.frameLocator('#mainFrame');
      
      // Wait for editor content area
      await frame.locator('.se-content').waitFor({ timeout: 10000 });
      console.log('[NAVER] SmartEditor loaded successfully');
      
      // Test SmartEditor availability first (access via iframe)
      const smartEditorTest = await newPage.evaluate(() => {
        try {
          console.log('[NAVER] Testing SmartEditor availability via iframe...');
          
          // Access the iframe
          const iframe = document.querySelector('#mainFrame');
          if (!iframe) {
            console.log('[NAVER] No iframe found');
            return { available: false, reason: 'no_iframe' };
          }
          
          const iframeWindow = (iframe as HTMLIFrameElement).contentWindow;
          if (!iframeWindow) {
            console.log('[NAVER] Cannot access iframe contentWindow');
            return { available: false, reason: 'no_iframe_window' };
          }
          
          console.log('[NAVER] SmartEditor:', (iframeWindow as any).SmartEditor);
          console.log('[NAVER] SmartEditor._editors:', (iframeWindow as any).SmartEditor?._editors);
          
          if (!(iframeWindow as any).SmartEditor || !(iframeWindow as any).SmartEditor._editors) {
            return { available: false, reason: 'no_smarteditor' };
          }
          
          // Get the editor instance
          const editor = (iframeWindow as any).SmartEditor._editors['blogpc001'];
          console.log('[NAVER] Editor:', editor);
          
          if (!editor) {
            console.log('[NAVER] Available editor keys:', Object.keys((iframeWindow as any).SmartEditor._editors));
            return { available: false, reason: 'no_editor' };
          }
          
          // Get document service
          const docService = editor._documentService;
          console.log('[NAVER] Document Service:', docService);
          
          if (!docService) {
            return { available: false, reason: 'no_docService' };
          }
          
          // Get document data
          const documentData = docService.getDocumentData();
          console.log('[NAVER] Document Data:', documentData);
          
          return { 
            available: true, 
            editor: !!editor, 
            docService: !!docService, 
            documentData: !!documentData,
            editorKeys: Object.keys((iframeWindow as any).SmartEditor._editors)
          };
        } catch (err) {
          console.error('[NAVER] SmartEditor test error:', err);
          return { available: false, reason: err instanceof Error ? err.message : String(err) };
        }
      });
      console.log('[NAVER] SmartEditor test result:', smartEditorTest);

      if (!smartEditorTest.available) {
        console.warn('[NAVER] SmartEditor not available, falling back to keyboard typing');
        await fillBlogContentFallback(pageOrFrame, newPage, content, imagePaths?.[0]);
        return;
      }

      // Step 1: Skip image pasting for debug purposes
      let imageComponents: any[] = [];
      console.log('[NAVER] DEBUG: Skipping image pasting - only doing content pasting');

      // Step 2: Now create the complete SmartEditor JSON without images
      console.log('[NAVER] Step 2: Creating complete SmartEditor JSON without images...');
      console.log('[NAVER] DEBUG: Processing HTML content:', content.content.substring(0, 200) + '...');
      const smartEditorJson = convertHtmlToSmartEditorJson(content.title, content.content, content.tags);
      console.log('[NAVER] Converted content to SmartEditor JSON format');
      
      // Debug: Log the parsed components to verify bold formatting
      console.log('[NAVER] DEBUG: Checking parsed components for bold formatting...');
      smartEditorJson.document.components.forEach((component: any, index: number) => {
        if (component['@ctype'] === 'text' && component.value) {
          console.log(`[NAVER] DEBUG: Component ${index} (text):`);
          component.value.forEach((paragraph: any) => {
            if (paragraph.nodes) {
              paragraph.nodes.forEach((node: any) => {
                if (node['@ctype'] === 'textNode') {
                  const isBold = node.style?.bold || false;
                  const isItalic = node.style?.italic || false;
                  const text = node.value;
                  if (text.includes('Machine Learning') || text.includes('Natural Language') || text.includes('em>') || text.includes('italic')) {
                    console.log(`[NAVER] DEBUG: Found "${text}" - Bold: ${isBold}, Italic: ${isItalic}`);
                  }
                }
              });
            }
          });
        }
      });

      // Step 3: Inject the complete JSON into SmartEditor
      console.log('[NAVER] Step 3: Injecting complete JSON into SmartEditor...');
      const injected = await newPage.evaluate(async (incoming) => {
        try {
          // Wait helper
          const waitFor = (ms: number) => new Promise(r => setTimeout(r, ms));
          
          // Access the iframe
          const iframe = document.querySelector('#mainFrame');
          if (!iframe) {
            console.warn('[NAVER] No iframe found');
            return { ok: false, reason: 'no_iframe' };
          }
          
          const iframeWindow = (iframe as HTMLIFrameElement).contentWindow;
          if (!iframeWindow) {
            console.warn('[NAVER] Cannot access iframe contentWindow');
            return { ok: false, reason: 'no_iframe_window' };
          }
          
          // Find editor dynamically
          const editors = ((iframeWindow as any).SmartEditor && (iframeWindow as any).SmartEditor._editors) || {};
          const editorKey = Object.keys(editors).find(k => k && k.startsWith('blogpc')) || Object.keys(editors)[0];
          const editor = editorKey ? editors[editorKey] : null;
          if (!editor) {
            console.warn('[NAVER] SmartEditor editor not found');
            return { ok: false, reason: 'no_editor' };
          }
          const docService = editor._documentService || editor.documentService;
          if (!docService) {
            console.warn('[NAVER] SmartEditor documentService not found');
            return { ok: false, reason: 'no_doc_service' };
          }
          
          // Replace the entire document with our content
          if (typeof docService.setDocumentData === 'function') {
            docService.setDocumentData(incoming);
          } else {
            docService._documentData = incoming;
          }
          if (docService._notifyChanged) docService._notifyChanged();
          
          console.log('[NAVER] SmartEditor document data replaced successfully');
          return { ok: true };
        } catch (err) {
          console.warn('[NAVER] Error during SmartEditor injection:', err);
          return { ok: false, reason: String(err instanceof Error ? err.message : err) };
        }
      }, smartEditorJson);
      
      console.log('[NAVER] SmartEditor document data injected result:', injected);
      
      if (injected.ok) {
        console.log('[NAVER] Blog content filled successfully using SmartEditor JSON API (debug mode - no images)');
      } else {
        console.warn('[NAVER] SmartEditor injection failed, falling back to keyboard typing');
        await fillBlogContentFallback(pageOrFrame, newPage, content);
      }
      
    } catch (e) {
      console.warn('[NAVER] SmartEditor API method failed, trying fallback:', e);
      await fillBlogContentFallback(pageOrFrame, newPage, content);
    }
    
    console.log('[NAVER] Blog content filling completed');
  } catch (error) {
    console.error('[NAVER] Error filling blog content:', error);
  }
}

/**
 * Fill blog post content using keyboard typing (fallback method)
 */
async function fillBlogContentFallback(pageOrFrame: any, newPage: Page, content: BlogContent, imagePath?: string): Promise<void> {
  try {
    console.log('[NAVER] Using fallback keyboard typing method...');
    
    // XPath selectors - using same as working code
    const title_field_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[1]/div[1]/div/div/p/span[2]';
    
    // Try multiple content field selectors to find the right one (from working code)
    const content_field_selectors = [
      'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p[1]', // First paragraph
      'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p', // Any paragraph
      '.se-text-paragraph', // Class-based selector
      '[contenteditable="true"]' // Contenteditable elements
    ];

    // Fill title
    try {
      console.log('[NAVER] Filling title:', content.title);
      const titleField = pageOrFrame.locator(title_field_xpath);
      if (await titleField.count()) {
        await titleField.click({ timeout: 10000 });
        await newPage.keyboard.press('Control+a');
        await newPage.waitForTimeout(200);
        await newPage.keyboard.type(content.title);
        console.log('[NAVER] Title filled successfully');
      }
    } catch (e) {
      console.warn('[NAVER] Title fill failed:', e);
    }

    // Fill content - try multiple selectors like working code
    try {
      console.log('[NAVER] Filling content');
      
      // Try multiple selectors to find the right content field
      let targetField = null;
      let usedSelector = '';
      
      for (const selector of content_field_selectors) {
        console.log(`[NAVER] Trying selector: ${selector}`);
        const field = pageOrFrame.locator(selector);
        const count = await field.count();
        console.log(`[NAVER] Found ${count} element(s) with selector: ${selector}`);
        
        if (count > 0) {
          targetField = field.first(); // Use .first() like working code
          usedSelector = selector;
          console.log(`[NAVER] Using selector: ${selector}`);
          break;
        }
      }
      
      if (targetField) {
        await targetField.click({ timeout: 20000 });
        await newPage.keyboard.press('Control+a');
        await newPage.waitForTimeout(200);
        
        // Process content without image placeholders for debug
        console.log('[NAVER] DEBUG: Processing content without image placeholders');
        await newPage.keyboard.type(content.content);
        await newPage.keyboard.press('Enter');
        
        // Add tags
        await newPage.keyboard.type(content.tags);
        console.log('[NAVER] Content and tags filled successfully');
      } else {
        console.warn('[NAVER] No suitable content field found with any selector');
      }
    } catch (e) {
      console.warn('[NAVER] Content fill failed:', e);
    }
    
    console.log('[NAVER] Fallback blog content filling completed');
  } catch (error) {
    console.error('[NAVER] Error in fallback blog content filling:', error);
  }
}

/**
 * Publish the blog post
 */
async function publishBlogPost(pageOrFrame: any, newPage: Page): Promise<boolean> {
  try {
    console.log('[NAVER] Publishing blog post...');
    
    // Ensure help panel is closed before publishing
    try {
      const help_panel_close_xpath = 'xpath=/html/body/div[1]/div[1]/div[3]/div/div/div[1]/div/div[1]/article/div/header/button';
      const explicitClose = pageOrFrame.locator(help_panel_close_xpath);
      if (await explicitClose.count()) {
        await explicitClose.click({ timeout: 2000 }).catch(() => {});
        console.log('[NAVER] Help panel closed before publishing');
      }
    } catch {}

    // Two-step publish process: First click initial button, then final publish button
    const initialPublishSelectors = [
      'xpath=/html/body/div[1]/div/div[1]/div/div[3]/div[2]/button', // First button to click
      'button:has-text("발행")', // Korean "Publish"
      'button:has-text("Publish")', // English "Publish"
      'button[type="submit"]', // Submit button
      'button:has-text("완료")', // Korean "Complete"
      'button:has-text("저장")', // Korean "Save"
      '[data-testid*="publish"]', // Test ID containing publish
      '[aria-label*="publish"]', // Aria label containing publish
      'button[class*="publish"]', // Class containing publish
      'button[class*="submit"]' // Class containing submit
    ];
    
    const finalPublishSelectors = [
      'xpath=/html/body/div[1]/div/div[1]/div/div[3]/div[2]/div/div/div/div[8]/div/button', // Final publish button
      'xpath=/html/body/div[1]/div/div[1]/div//div[3]/div[2]/button', // Alternative final selector
      'button:has-text("발행")', // Korean "Publish"
      'button:has-text("Publish")', // English "Publish"
      'button[type="submit"]', // Submit button
      'button:has-text("완료")', // Korean "Complete"
      'button:has-text("저장")', // Korean "Save"
    ];
    
    let publishButtonFound = false;
    
    // Step 1: Try to click the initial publish button
    console.log('[NAVER] Step 1: Looking for initial publish button...');
    let initialButtonClicked = false;
    
    for (const selector of initialPublishSelectors) {
      try {
        console.log(`[NAVER] Trying initial publish button selector: ${selector}`);
        const initialBtn = pageOrFrame.locator(selector);
        
        // Wait for the button to be visible and enabled
        await initialBtn.waitFor({ state: 'visible', timeout: 5000 });
        
        if (await initialBtn.count() > 0) {
          console.log(`[NAVER] Initial publish button found with selector: ${selector}`);
          
          // Check if button is enabled
          const isEnabled = await initialBtn.isEnabled();
          console.log(`[NAVER] Initial publish button enabled: ${isEnabled}`);
          
          if (isEnabled) {
            console.log('[NAVER] Clicking initial publish button...');
            await initialBtn.click({ timeout: 10000 });
            console.log('[NAVER] Initial publish button clicked successfully');
            initialButtonClicked = true;
            break;
          } else {
            console.log('[NAVER] Initial publish button found but not enabled, trying next selector');
          }
        }
      } catch (waitError) {
        console.log(`[NAVER] Initial publish button not found with selector: ${selector} - ${waitError instanceof Error ? waitError.message : 'Unknown error'}`);
      }
    }
    
    // Step 2: Wait for the final publish button to appear and click it
    if (initialButtonClicked) {
      console.log('[NAVER] Step 2: Waiting for final publish button to appear...');
      await newPage.waitForTimeout(5000); // Wait full 5 seconds as requested
      
      for (const selector of finalPublishSelectors) {
        try {
          console.log(`[NAVER] Trying final publish button selector: ${selector}`);
          const finalBtn = pageOrFrame.locator(selector);
          
          // Wait for the button to be visible and enabled
          await finalBtn.waitFor({ state: 'visible', timeout: 5000 });
          
          if (await finalBtn.count() > 0) {
            console.log(`[NAVER] Final publish button found with selector: ${selector}`);
            
            // Check if button is enabled
            const isEnabled = await finalBtn.isEnabled();
            console.log(`[NAVER] Final publish button enabled: ${isEnabled}`);
            
            if (isEnabled) {
              console.log('[NAVER] Clicking final publish button...');
              await finalBtn.click({ timeout: 10000 });
              await newPage.waitForTimeout(3000);
              console.log('[NAVER] Final publish button clicked successfully');
              publishButtonFound = true;
              break;
            } else {
              console.log('[NAVER] Final publish button found but not enabled, trying next selector');
            }
          }
        } catch (waitError) {
          console.log(`[NAVER] Final publish button not found with selector: ${selector} - ${waitError instanceof Error ? waitError.message : 'Unknown error'}`);
        }
      }
    } else {
      console.log('[NAVER] Initial publish button not found, trying direct final button approach...');
      
      // Fallback: Try to click final button directly
      for (const selector of finalPublishSelectors) {
        try {
          console.log(`[NAVER] Trying direct final publish button selector: ${selector}`);
          const finalBtn = pageOrFrame.locator(selector);
          
          // Wait for the button to be visible and enabled
          await finalBtn.waitFor({ state: 'visible', timeout: 5000 });
          
          if (await finalBtn.count() > 0) {
            console.log(`[NAVER] Direct final publish button found with selector: ${selector}`);
            
            // Check if button is enabled
            const isEnabled = await finalBtn.isEnabled();
            console.log(`[NAVER] Direct final publish button enabled: ${isEnabled}`);
            
            if (isEnabled) {
              console.log('[NAVER] Clicking direct final publish button...');
              await finalBtn.click({ timeout: 10000 });
              await newPage.waitForTimeout(3000);
              console.log('[NAVER] Direct final publish button clicked successfully');
              publishButtonFound = true;
              break;
            } else {
              console.log('[NAVER] Direct final publish button found but not enabled, trying next selector');
            }
          }
        } catch (waitError) {
          console.log(`[NAVER] Direct final publish button not found with selector: ${selector} - ${waitError instanceof Error ? waitError.message : 'Unknown error'}`);
        }
      }
    }
    
    if (!publishButtonFound) {
      console.log('[NAVER] No publish button found with any selector');
      
      // Try to find any button that might be the publish button
      console.log('[NAVER] Looking for any button that might be publish...');
      const allButtons = pageOrFrame.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`[NAVER] Found ${buttonCount} buttons on page`);
      
      // Log all button texts for debugging
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        try {
          const buttonText = await allButtons.nth(i).textContent();
          const buttonClass = await allButtons.nth(i).getAttribute('class');
          console.log(`[NAVER] Button ${i}: "${buttonText}" (class: ${buttonClass})`);
        } catch (e) {
          console.log(`[NAVER] Button ${i}: Could not get text/class`);
        }
      }
    }

    return publishButtonFound;
  } catch (error) {
    console.error('[NAVER] Error publishing blog post:', error);
    return false;
  }
}

/**
 * Main function to run Naver Blog automation
 */
export async function runNaverBlogAutomation(
  settings: NaverBlogSettings,
  content: BlogContent,
  imagePaths?: string[]
): Promise<BrowserControllerResult> {
  let browser: Browser | null = null;
  
  try {
    console.log('[NAVER] Starting Naver Blog automation...');
    
    // Launch browser
    const { browser: launchedBrowser, context, page } = await launchBrowser(settings.proxyUrl);
    browser = launchedBrowser;
    
    // Handle login
    const loginSuccess = await handleNaverLogin(page, settings.username, settings.password);
    if (!loginSuccess) {
      throw new Error('Failed to login to Naver');
    }
    
    // Open blog write page
    const newPage = await openBlogWritePage(context, page);
    if (!newPage) {
      throw new Error('Failed to open blog write page');
    }
    
    // Switch to mainFrame if present
    const hasMainFrame = await newPage.locator('#mainFrame').count();
    const mainFrameLocator = newPage.frameLocator('#mainFrame');
    const pageOrFrame = hasMainFrame ? mainFrameLocator : newPage;
    
    // Ensure clipboard permissions before any paste operations
    await handleClipboardPermission(newPage, context);

    // Handle popups
    await handlePopups(pageOrFrame, newPage);
    
    // Fill blog content
    await fillBlogContent(pageOrFrame, newPage, content, imagePaths);
    
    // Publish blog post
    const publishSuccess = await publishBlogPost(pageOrFrame, newPage);
    
    if (publishSuccess) {
      console.log('[NAVER] Naver Blog automation completed successfully');
      return {
        success: true,
        imageGenerated: !!(imagePaths && imagePaths.length > 0)
      };
    } else {
      throw new Error('Failed to publish blog post');
    }
    
  } catch (error) {
    console.error('[NAVER] Naver Blog automation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    // Keep browser open for debugging - comment out for production
    // if (browser) {
    //   await browser.close();
    // }
  }
}

/**
 * Type text using keyboard coordinates (for advanced keyboard automation)
 */
export async function typeTextWithKeyboard(
  keyboardKeys: any,
  text: string,
  page: Page | null = null
): Promise<void> {
  try {
    console.log(`[NAVER] Attempting to type "${text}" using keyboard coordinates...`);
    
    // Create a mapping of characters to their positions
    const charMap: any = {};
    Object.entries(keyboardKeys).forEach(([keyLabel, keyData]: [string, any]) => {
      let char = '';
      const label = keyData.label || '';
      
      if (label.toLowerCase().includes('key:')) {
        const match = label.match(/key:\s*([a-z0-9])/i);
        if (match) {
          char = match[1].toLowerCase();
        }
      } else if (label.match(/^[a-z]\s*\/\s*[ㅏ-ㅣ]/i)) {
        const match = label.match(/^([a-z])/i);
        if (match) {
          char = match[1].toLowerCase();
        }
      } else if (label.toLowerCase().includes('enter')) {
        char = 'enter';
      } else if (label.toLowerCase().includes('shift')) {
        char = 'shift';
      } else if (label.toLowerCase().includes('space')) {
        char = ' ';
      } else {
        const singleCharMatch = label.match(/\b([a-z0-9])\b/i);
        if (singleCharMatch) {
          char = singleCharMatch[1].toLowerCase();
        }
      }
      
      if (char && ((char.length === 1 && /[a-z0-9]/.test(char)) || char === 'enter' || char === 'shift' || char === ' ')) {
        charMap[char] = keyData;
      }
    });
    
    // Click on all characters in the text
    const textToType = text.toLowerCase();
    
    for (let i = 0; i < textToType.length; i++) {
      const char = textToType[i];
      if (charMap[char] && page) {
        const keyData = charMap[char];
        
        try {
          await page.mouse.move(keyData.position.x, keyData.position.y);
          await page.waitForTimeout(100);
          await page.mouse.click(keyData.position.x, keyData.position.y);
          await page.waitForTimeout(200);
        } catch (clickError) {
          console.error(`[NAVER] Failed to click '${char}':`, clickError);
        }
      }
    }
    
    console.log(`[NAVER] Finished typing "${text}"`);
  } catch (error) {
    console.error('[NAVER] Error typing text:', error);
  }
}

/**
 * Process segmentation results for keyboard automation
 */
export async function processSegmentationResults(
  segmentationResults: any[],
  screenshotPath: string,
  elementBoxes: any = null,
  page: Page | null = null,
  textToType: string = 'hello'
): Promise<{ success: boolean; processed: number; keyboardKeys?: any; error?: string }> {
  try {
    console.log('[NAVER] Processing segmentation results...');
    console.log('[NAVER] Found', segmentationResults.length, 'objects in the image');
    
    if (elementBoxes && elementBoxes.targetImage) {
      const targetImageBox = elementBoxes.targetImage;
      const keyboardKeys: any = {};
      
      // Process each segmented object
      segmentationResults.forEach((obj, index) => {
        const aiBox = obj.box_2d; // [ymin, xmin, ymax, xmax] from AI (normalized 0-1000)
        const keyLabel = obj.label || `key_${index}`;
        
        // Convert from [ymin, xmin, ymax, xmax] format to [x, y, width, height]
        const [ymin, xmin, ymax, xmax] = aiBox;
        const normalizedX = xmin / 1000;
        const normalizedY = ymin / 1000;
        const normalizedWidth = (xmax - xmin) / 1000;
        const normalizedHeight = (ymax - ymin) / 1000;
        
        // Calculate relative position within the target image
        const relativeX = normalizedX * targetImageBox.width;
        const relativeY = normalizedY * targetImageBox.height;
        const relativeWidth = normalizedWidth * targetImageBox.width;
        const relativeHeight = normalizedHeight * targetImageBox.height;
        
        // Convert to absolute page coordinates
        const absoluteX = targetImageBox.x + relativeX;
        const absoluteY = targetImageBox.y + relativeY;
        
        // Calculate center point for clicking
        const centerX = absoluteX + (relativeWidth / 2);
        const centerY = absoluteY + (relativeHeight / 2);
        
        keyboardKeys[keyLabel] = {
          position: {
            x: Math.round(centerX),
            y: Math.round(centerY)
          },
          bounds: {
            x: Math.round(absoluteX),
            y: Math.round(absoluteY),
            width: Math.round(relativeWidth),
            height: Math.round(relativeHeight)
          },
          label: obj.label,
          mask: obj.mask,
          aiBox: aiBox
        };
      });
      
      // Try to type the specified text using the keyboard coordinates
      if (keyboardKeys && Object.keys(keyboardKeys).length > 0 && page) {
        await typeTextWithKeyboard(keyboardKeys, textToType, page);
      }
      
      return { success: true, processed: segmentationResults.length, keyboardKeys };
    } else {
      // Fallback: just log basic info
      segmentationResults.forEach((obj, index) => {
        console.log(`[NAVER] Object ${index + 1}:`, {
          label: obj.label,
          box: obj.box_2d,
          mask: obj.mask
        });
      });
      
      return { success: true, processed: segmentationResults.length };
    }
  } catch (error) {
    console.error('[NAVER] Error processing segmentation results:', error);
      return { success: false, processed: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
