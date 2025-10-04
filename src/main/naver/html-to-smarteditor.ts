// html-to-smarteditor.ts
// Utilities to convert HTML content into Naver SmartEditor JSON format

// We'll use a simple UUID generator instead of importing uuid
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Convert HTML content to SmartEditor JSON format
 */
export function convertHtmlToSmartEditorJson(title: string, htmlContent: string, tags: string, imagePath?: string, options?: { preserveImageMarkers?: boolean }): any {
  const documentId = generateUUID();

  // Preserve original markers if requested (used by text-first then paste flow)
  const shouldPreserveMarkers = !!(options && options.preserveImageMarkers);
  const { content: processedContent, imagePlaceholders } = shouldPreserveMarkers
    ? { content: htmlContent, imagePlaceholders: [] as any[] }
    : processContentWithImagesForJson(htmlContent, imagePath);

  // Debug: Write HTML processing data to file
  const fs = require('fs');
  const path = require('path');
  const debugDir = path.join(process.cwd(), 'output', 'debug');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }

  const htmlDebugData = {
    originalHtml: htmlContent,
    processedContent: processedContent,
    imagePlaceholdersCount: imagePlaceholders.length,
    imagePlaceholders: imagePlaceholders
  };
  fs.writeFileSync(path.join(debugDir, 'html-processing-debug.json'), JSON.stringify(htmlDebugData, null, 2));

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
          dia: { t: 0, p: 0, st: 715, sk: 51 }
        }
      ]
    },
    components: [] as any[]
  };

  const titleComponent = {
    id: `SE-${generateUUID()}`,
    layout: "default",
    title: [
      {
        id: `SE-${generateUUID()}`,
        nodes: [
          { id: `SE-${generateUUID()}`, value: title, "@ctype": "textNode" }
        ],
        "@ctype": "paragraph"
      }
    ],
    subTitle: null,
    align: "left",
    "@ctype": "documentTitle"
  };
  (document.components as any[]).push(titleComponent);

  const contentComponents = parseHtmlToComponents(processedContent);

  const finalComponents = contentComponents.map((component: any) => {
    if (component.value && Array.isArray(component.value)) {
      component.value = component.value.map((paragraph: any) => {
        if (paragraph.nodes && Array.isArray(paragraph.nodes)) {
          paragraph.nodes = paragraph.nodes.map((node: any) => {
            if (node.value && typeof node.value === 'string') {
              const imageMarkerMatch = node.value.match(/\[IMAGE_COMPONENT_(\d+)\]/);
              if (imageMarkerMatch) {
                const imageIndex = parseInt(imageMarkerMatch[1]);
                if (imagePlaceholders[imageIndex]) {
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

  (document.components as any[]).push(...finalComponents);

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
          style: { textAlign: "left", "@ctype": "paragraphStyle" },
          "@ctype": "paragraph"
        }
      ],
      "@ctype": "text"
    };
    (document.components as any[]).push(tagsComponent);
  }

  return { document };
}

/**
 * Convert HTML content to SmartEditor JSON format with provided image components
 */
export function convertHtmlToSmartEditorJsonWithImages(title: string, htmlContent: string, tags: string, imageComponents: any[]): any {
  const documentId = generateUUID();

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
          dia: { t: 0, p: 0, st: 715, sk: 51 }
        }
      ]
    },
    components: [] as any[]
  };

  const titleComponent = {
    id: `SE-${generateUUID()}`,
    layout: "default",
    title: [
      {
        id: `SE-${generateUUID()}`,
        nodes: [
          { id: `SE-${generateUUID()}`, value: title, "@ctype": "textNode" }
        ],
        "@ctype": "paragraph"
      }
    ],
    subTitle: null,
    align: "left",
    "@ctype": "documentTitle"
  };
  (document.components as any[]).push(titleComponent);

  const { content: processedContent } = processContentWithImagesForJson(htmlContent);
  const contentComponents = parseHtmlToComponents(processedContent);

  const finalComponents = contentComponents.map((component: any) => {
    if (component.value && Array.isArray(component.value)) {
      component.value = component.value.map((paragraph: any) => {
        if (paragraph.nodes && Array.isArray(paragraph.nodes)) {
          paragraph.nodes = paragraph.nodes.map((node: any) => {
            if (node.value && typeof node.value === 'string') {
              const imageMarkerMatch = node.value.match(/\[IMAGE_COMPONENT_(\d+)\]/);
              if (imageMarkerMatch) {
                const imageIndex = parseInt(imageMarkerMatch[1]);
                if (imageComponents[imageIndex]) {
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

  (document.components as any[]).push(...finalComponents);

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
          style: { textAlign: "left", "@ctype": "paragraphStyle" },
          "@ctype": "paragraph"
        }
      ],
      "@ctype": "text"
    };
    (document.components as any[]).push(tagsComponent);
  }

  return { document };
}

/**
 * Parse HTML content and convert to SmartEditor components
 */
export function parseHtmlToComponents(htmlContent: string): any[] {
  const components: any[] = [];

  const blockElements = ['<h1>', '<h2>', '<h3>', '<h4>', '<h5>', '<h6>', '<p>', '<div>', '<ul>', '<ol>', '<li>'];
  const lineBreakElements = ['<br>', '<br/>', '<br />'];

  let normalizedContent = htmlContent;

  lineBreakElements.forEach(brTag => {
    normalizedContent = normalizedContent.replace(new RegExp(brTag, 'gi'), '\n');
  });

  normalizedContent = normalizedContent.replace(/\n\s*\n/g, '\n\n');

  let remainingContent = normalizedContent;

  while (remainingContent.length > 0) {
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
      if (remainingContent.trim()) {
        const textComponents = createTextComponentsWithLineBreaks(remainingContent.trim());
        components.push(...textComponents);
      }
      break;
    }

    if (nextBlockIndex > 0) {
      const beforeText = remainingContent.substring(0, nextBlockIndex).trim();
      if (beforeText) {
        const textComponents = createTextComponentsWithLineBreaks(beforeText);
        components.push(...textComponents);
      }
    }

    const blockEndTag = nextBlockTag.replace('<', '</');
    const blockEndIndex = remainingContent.indexOf(blockEndTag, nextBlockIndex);

    if (blockEndIndex !== -1) {
      const blockContent = remainingContent.substring(nextBlockIndex + nextBlockTag.length, blockEndIndex);
      const fullTag = remainingContent.substring(nextBlockIndex, blockEndIndex + blockEndTag.length);
      const blockComponent = createBlockComponent(nextBlockTag, blockContent, fullTag);
      if (blockComponent) components.push(blockComponent);
      remainingContent = remainingContent.substring(blockEndIndex + blockEndTag.length);
    } else {
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
export function createTextComponent(htmlContent: string): any | null {
  if (!htmlContent.trim()) return null;

  const nodes = parseInlineStyles(htmlContent);

  return {
    id: `SE-${generateUUID()}`,
    layout: "default",
    value: [
      {
        id: `SE-${generateUUID()}`,
        nodes: nodes,
        style: { textAlign: "left", "@ctype": "paragraphStyle" },
        "@ctype": "paragraph"
      }
    ],
    "@ctype": "text"
  };
}

/**
 * Create text components with proper line break handling
 */
export function createTextComponentsWithLineBreaks(htmlContent: string): any[] {
  if (!htmlContent.trim()) return [];

  const components: any[] = [];
  const paragraphs = htmlContent.split(/\n\s*\n/);

  paragraphs.forEach(paragraph => {
    if (paragraph.trim()) {
      const lines = paragraph.split(/\n/);
      lines.forEach((line) => {
        if (line.trim()) {
          const nodes = parseInlineStyles(line.trim());
          if (nodes.length > 0) {
            const component = {
              id: `SE-${generateUUID()}`,
              layout: "default",
              value: [
                {
                  id: `SE-${generateUUID()}`,
                  nodes: nodes,
                  style: { textAlign: "left", "@ctype": "paragraphStyle" },
                  "@ctype": "paragraph"
                }
              ],
              "@ctype": "text"
            };
            components.push(component);
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
export function createBlockComponent(tag: string, content: string, fullTag?: string): any | null {
  if (!content.trim()) return null;

  const nodes = parseInlineStyles(content);

  let inlineStyles: any = {};
  if (fullTag) {
    const styleMatch = fullTag.match(/style="([^"]*)"/);
    if (styleMatch) {
      inlineStyles = parseInlineStyleString(styleMatch[1]);
    }
  }

  let componentType = "text";
  let textAlign = "left";
  let paragraphStyle: any = { textAlign: textAlign, "@ctype": "paragraphStyle" };

  if (tag.startsWith('<h')) {
    componentType = "text";
    textAlign = "left";
    if (nodes.length > 0 && nodes[0].style) {
      nodes[0].style.bold = true;
    }
  } else if (tag === '<ul>' || tag === '<ol>') {
    componentType = "text";
    textAlign = "left";

    if (inlineStyles.color) {
      nodes.forEach(node => { if (node.style) node.style.fontColor = inlineStyles.color; });
    }
    if (inlineStyles.lineHeight) {
      paragraphStyle.lineHeight = inlineStyles.lineHeight;
    }
    if (inlineStyles.marginLeft) {
      const marginValue = parseInt(inlineStyles.marginLeft);
      if (marginValue > 0) {
        const indentSpaces = ' '.repeat(Math.min(marginValue / 10, 10));
        if (nodes.length > 0 && nodes[0].value) {
          nodes[0].value = indentSpaces + nodes[0].value;
        }
      }
    }
    if (nodes.length > 0) {
      const listPrefix = tag === '<ul>' ? '• ' : '1. ';
      if (nodes[0].value) nodes[0].value = listPrefix + nodes[0].value;
    }
  } else if (tag === '<li>') {
    componentType = "text";
    textAlign = "left";
    if (inlineStyles.color) {
      nodes.forEach(node => { if (node.style) node.style.fontColor = inlineStyles.color; });
    }
    if (nodes.length > 0 && nodes[0].value) {
      nodes[0].value = '• ' + nodes[0].value;
    }
  } else if (tag === '<p>') {
    componentType = "text";
    textAlign = "left";
    if (inlineStyles.color) {
      nodes.forEach(node => { if (node.style) node.style.fontColor = inlineStyles.color; });
    }
    if (inlineStyles.lineHeight) {
      paragraphStyle.lineHeight = inlineStyles.lineHeight;
    }
    if (inlineStyles.textAlign) {
      paragraphStyle.textAlign = inlineStyles.textAlign;
    }
  }

  return {
    id: `SE-${generateUUID()}`,
    layout: "default",
    value: [
      { id: `SE-${generateUUID()}`, nodes: nodes, style: paragraphStyle, "@ctype": "paragraph" }
    ],
    "@ctype": componentType
  };
}

/**
 * Parse inline styles and create text nodes
 */
export function parseInlineStyles(htmlContent: string): any[] {
  const nodes: any[] = [];
  let remainingContent = htmlContent;

  while (remainingContent.length > 0) {
    const tagMatch = remainingContent.match(/<(\w+)(?:\s+[^>]*)?>(.*?)<\/\1>/);
    if (!tagMatch) {
      if (remainingContent.trim()) nodes.push(createTextNode(remainingContent.trim()));
      break;
    }

    const fullTag = tagMatch[0];
    const tagName = tagMatch[1];
    const tagContent = tagMatch[2];
    const tagIndex = remainingContent.indexOf(fullTag);

    if (tagIndex > 0) {
      const beforeText = remainingContent.substring(0, tagIndex).trim();
      if (beforeText) nodes.push(createTextNode(beforeText));
    }

    const styleMatch = fullTag.match(/style="([^"]*)"/);
    let inlineStyles: any = {};
    if (styleMatch) inlineStyles = parseInlineStyleString(styleMatch[1]);

    if (tagContent.includes('<') && tagContent.includes('>')) {
      const nestedNodes = parseInlineStyles(tagContent);
      nestedNodes.forEach(nestedNode => {
        if (nestedNode.style) {
          if (tagName === 'strong' || tagName === 'b') nestedNode.style.bold = true;
          else if (tagName === 'em' || tagName === 'i') nestedNode.style.italic = true;
          else if (tagName === 'u') nestedNode.style.underline = true;

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
      nodes.push(createTextNode(tagContent, tagName, inlineStyles));
    }

    remainingContent = remainingContent.substring(tagIndex + fullTag.length);
  }

  return nodes;
}

/**
 * Parse inline style string into style object
 */
export function parseInlineStyleString(styleString: string): any {
  const styles: any = {};
  if (!styleString) return styles;

  const stylePairs = styleString.split(';');
  for (const pair of stylePairs) {
    const [property, value] = pair.split(':').map(s => s.trim());
    if (property && value) {
      switch (property) {
        case 'font-weight':
          if (value === 'bold' || parseInt(value) >= 700) styles.bold = true; break;
        case 'font-style':
          if (value === 'italic') styles.italic = true; break;
        case 'text-decoration':
          if (value.includes('underline')) styles.underline = true;
          if (value.includes('line-through')) styles.strikeThrough = true;
          break;
        case 'color':
          styles.color = value; styles.fontColor = value; break;
        case 'background-color':
          styles.backgroundColor = value; break;
        case 'font-size':
          const fontSize = parseInt(value);
          if (fontSize > 20) styles.fontSize = 'large'; else if (fontSize < 12) styles.fontSize = 'small';
          break;
        case 'line-height':
          styles.lineHeight = value; break;
        case 'margin-left':
          styles.marginLeft = value; break;
        case 'margin-right':
          styles.marginRight = value; break;
        case 'margin-top':
          styles.marginTop = value; break;
        case 'margin-bottom':
          styles.marginBottom = value; break;
        case 'font-family':
          styles.fontFamily = value; break;
        case 'text-align':
          styles.textAlign = value; break;
        case 'list-style-type':
          styles.listStyleType = value; break;
      }
    }
  }
  return styles;
}

/**
 * Create a text node with optional styling
 */
export function createTextNode(text: string, tagName?: string, inlineStyles?: any): any {
  const node: any = {
    id: `SE-${generateUUID()}`,
    value: text,
    style: { bold: false, italic: false, underline: false, strikeThrough: false, "@ctype": "nodeStyle" },
    "@ctype": "textNode"
  };

  if (tagName === 'strong' || tagName === 'b') node.style.bold = true;
  else if (tagName === 'em' || tagName === 'i') node.style.italic = true;
  else if (tagName === 'u') node.style.underline = true;
  else if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') node.style.bold = true;

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
 * Process content and handle image placeholders for SmartEditor JSON
 * Uses the pattern: [IMAGE:description:placement]
 */
export function processContentWithImagesForJson(htmlContent: string, imagePath?: string): { content: string, imagePlaceholders: any[] } {
  try {
    const imagePlaceholderRegex = /\[IMAGE:([^:]+):([^\]]+)\]/g;
    const imageMatches = Array.from(htmlContent.matchAll(imagePlaceholderRegex));
    if (imageMatches.length === 0) {
      return { content: htmlContent, imagePlaceholders: [] };
    }

    let processedContent = htmlContent;
    const imagePlaceholders: any[] = [];

    for (const match of imageMatches) {
      const placeholder = match[0];
      const description = match[1];
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
        origin: { srcFrom: "local", "@ctype": "imageOrigin" },
        ai: false,
        "@ctype": "image"
      };
      imagePlaceholders.push(imageComponent);
      processedContent = processedContent.replace(placeholder, `[IMAGE_COMPONENT_${imagePlaceholders.length - 1}]`);
    }

    return { content: processedContent, imagePlaceholders };
  } catch (error) {
    return { content: htmlContent, imagePlaceholders: [] };
  }
}

/**
 * Replace image placeholders in SmartEditor JSON with real image components
 */
export function replaceImagePlaceholdersInJson(baseJson: any, imageComponents: any[]): any {
  try {
    const smartEditorJson = JSON.parse(JSON.stringify(baseJson));
    const components = smartEditorJson.document.components;

    const fs = require('fs');
    const path = require('path');
    const debugDir = path.join(process.cwd(), 'output', 'debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

    const jsonStr = JSON.stringify(smartEditorJson);
    const replacementDebugData = {
      baseJson: baseJson,
      smartEditorJson: smartEditorJson,
      imageComponents: imageComponents,
      componentsCount: components.length,
      containsImageComponent0: jsonStr.includes('[IMAGE_COMPONENT_0]')
    };
    fs.writeFileSync(path.join(debugDir, 'replacement-debug.json'), JSON.stringify(replacementDebugData, null, 2));

    let sequentialImageIndex = 0;
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (component['@ctype'] === 'text' && component.value && Array.isArray(component.value)) {
        for (let j = 0; j < component.value.length; j++) {
          const paragraph = component.value[j];
          if (paragraph.nodes && Array.isArray(paragraph.nodes)) {
            for (let k = 0; k < paragraph.nodes.length; k++) {
              const node = paragraph.nodes[k];
              if (node && typeof node.value === 'string') {
                const imageMarkerMatch = node.value.match(/\[IMAGE_COMPONENT_(\d+)\]/);
                if (imageMarkerMatch) {
                  const imageIndex = parseInt(imageMarkerMatch[1]);
                  if (imageComponents[imageIndex]) {
                    paragraph.nodes[k] = imageComponents[imageIndex];
                    continue;
                  }
                }
              }
              if (node && node['@ctype'] === 'image') {
                const isPlaceholder = (node.src === 'placeholder') || (!node.domain || node.domain === 'https://blogfiles.pstatic.net' && typeof node.path === 'string' && node.path === 'placeholder');
                if (isPlaceholder && sequentialImageIndex < imageComponents.length) {
                  paragraph.nodes[k] = imageComponents[sequentialImageIndex];
                  sequentialImageIndex++;
                }
              }
            }
          }
        }
      }
    }

    const finalResultData = {
      finalJson: smartEditorJson,
      finalJsonString: JSON.stringify(smartEditorJson)
    };
    fs.writeFileSync(path.join(debugDir, 'final-result-debug.json'), JSON.stringify(finalResultData, null, 2));

    return smartEditorJson;
  } catch (error) {
    return baseJson;
  }
}


