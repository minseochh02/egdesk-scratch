// const path = require('path');
// const fs = require('fs');

// // ==========================================================================
// // DEBUG VISUALIZATION AND REPORT UTILITIES
// // ==========================================================================

// function generateTimestamp() {
//   return new Date().toISOString().replace(/[:.]/g, '-');
// }

// function getColorForIndex(index) {
//   const colors = [
//     { r: 255, g: 0, b: 0 },
//     { r: 0, g: 255, b: 0 },
//     { r: 0, g: 0, b: 255 },
//     { r: 255, g: 255, b: 0 },
//     { r: 255, g: 0, b: 255 },
//     { r: 0, g: 255, b: 255 },
//     { r: 255, g: 128, b: 0 },
//     { r: 128, g: 0, b: 255 },
//     { r: 255, g: 192, b: 203 },
//     { r: 0, g: 128, b: 0 },
//   ];
//   return colors[index % colors.length];
// }

// /**
//  * Creates a simple HTML debug visualization with AI-detected objects
//  * @param {string} originalImagePath
//  * @param {Array} aiSegmentation
//  * @param {string} outputPath
//  * @param {Object} keyboardBox
//  * @returns {Promise<string|null>}
//  */
// async function createDebugHTMLVisualization(originalImagePath, aiSegmentation, outputPath, keyboardBox = null) {
//   try {
//     console.log('[DEBUG] Creating HTML debug visualization...');
//     if (!aiSegmentation || aiSegmentation.length === 0) {
//       console.warn('[DEBUG] No AI segmentation data provided');
//       return null;
//     }

//     const imageBuffer = fs.readFileSync(originalImagePath);
//     const base64Image = imageBuffer.toString('base64');
//     const imageExtension = path.extname(originalImagePath).substring(1);

//     if (!keyboardBox) {
//       console.log('[DEBUG] No keyboard position provided, using (0,0)');
//       keyboardBox = { x: 0, y: 0, width: 1000, height: 600 };
//     }

//     const html = `
// <!DOCTYPE html>
// <html>
// <head>
//     <title>AI Keyboard Detection Debug</title>
//     <style>
//         body { 
//             font-family: Arial, sans-serif; 
//             margin: 20px; 
//             background: #f0f0f0;
//             position: relative;
//         }
//         .container { 
//             position: absolute; 
//             display: inline-block; 
//             left: ${keyboardBox.x}px; 
//             top: ${keyboardBox.y}px; 
//             z-index: 1000;
//         }
//         .original-image { 
//             width: auto; 
//             height: auto; 
//             max-width: 100%; 
//             display: block;
//         }
//         .overlay { position: absolute; border: 3px solid; opacity: 0.7; }
//         .overlay-label { 
//             position: absolute; 
//             top: -20px; 
//             left: 0; 
//             background: rgba(0,0,0,0.8); 
//             color: white; 
//             padding: 2px 6px; 
//             font-size: 12px; 
//             border-radius: 3px;
//         }
//         .info-panel { 
//             margin-top: 20px; 
//             padding: 15px; 
//             background: #f5f5f5; 
//             border-radius: 5px; 
//         }
//         .object-info { 
//             margin: 5px 0; 
//             padding: 5px; 
//             background: white; 
//             border-radius: 3px; 
//         }
//         .debug-info {
//             margin: 10px 0;
//             padding: 10px;
//             background: #e8f4f8;
//             border-radius: 5px;
//             font-family: monospace;
//         }
//     </style>
// </head>
// <body>
//     <h2>AI Keyboard Detection Debug Visualization</h2>
//     <p><strong>Keyboard positioned at Shinhan website coordinates:</strong> (${keyboardBox.x}, ${keyboardBox.y})</p>
//     <div class="container">
//         <img id="keyboardImage" src="data:image/${imageExtension};base64,${base64Image}" class="original-image" alt="Original Keyboard" onload="createOverlays()">
//         <div id="overlayContainer"></div>
//     </div>
    
//     <div class="debug-info">
//         <strong>Debug Info:</strong><br>
//         <span id="imageDimensions">Loading image dimensions...</span><br>
//         <span id="coordinateInfo">Waiting for image load...</span>
//     </div>
    
//     <div class="info-panel">
//         <h3>Detection Summary</h3>
//         <p><strong>Total Objects Detected:</strong> ${aiSegmentation.length}</p>
//         <p><strong>Original Image:</strong> ${path.basename(originalImagePath)}</p>
//         <p><strong>Note:</strong> The image container is positioned at the exact Shinhan website keyboard coordinates (${keyboardBox.x}, ${keyboardBox.y}). Overlays are positioned relative to this image container.</p>
        
//         <h4>Detected Objects:</h4>
//         <div id="objectList">
//           <p>Loading object details...</p>
//         </div>
//     </div>
    
//     <script>
//         const aiSegmentation = ${JSON.stringify(aiSegmentation)};
//         const keyboardBox = ${JSON.stringify(keyboardBox)};
//         const colors = [
//             { r: 255, g: 0, b: 0 },
//             { r: 0, g: 255, b: 0 },
//             { r: 0, g: 0, b: 255 },
//             { r: 255, g: 255, b: 0 },
//             { r: 255, g: 0, b: 255 },
//             { r: 0, g: 255, b: 255 },
//             { r: 255, g: 128, b: 0 },
//             { r: 128, g: 0, b: 255 },
//             { r: 255, g: 192, b: 203 },
//             { r: 0, g: 128, b: 0 },
//         ];
//         function getColorForIndex(index) { return colors[index % colors.length]; }
//         function createOverlays() {
//             const img = document.getElementById('keyboardImage');
//             const container = document.getElementById('overlayContainer');
//             const dimensionsSpan = document.getElementById('imageDimensions');
//             const coordinateSpan = document.getElementById('coordinateInfo');
//             const naturalWidth = img.naturalWidth;
//             const naturalHeight = img.naturalHeight;
//             const displayedWidth = img.offsetWidth;
//             const displayedHeight = img.offsetHeight;
//             const scaleX = displayedWidth / naturalWidth;
//             const scaleY = displayedHeight / naturalHeight;
//             dimensionsSpan.innerHTML = `
//                 Natural dimensions: ${naturalWidth} × ${naturalHeight} pixels<br>
//                 Displayed dimensions: ${displayedWidth} × ${displayedHeight} pixels<br>
//                 Scale factors: ${scaleX.toFixed(3)} × ${scaleY.toFixed(3)}<br>
//                 Image container positioned at: (${keyboardBox.x}, ${keyboardBox.y}) size: ${keyboardBox.width} × ${keyboardBox.height}<br>
//                 <strong>Note: Image is positioned at the exact Shinhan website keyboard coordinates</strong>
//             `;
//             container.innerHTML = '';
//             aiSegmentation.forEach((obj, index) => {
//                 if (!obj.box_2d) return;
//                 const [ymin, xmin, ymax, xmax] = obj.box_2d;
//                 const naturalXmin = (xmin / 1000) * naturalWidth;
//                 const naturalYmin = (ymin / 1000) * naturalHeight;
//                 const naturalXmax = (xmax / 1000) * naturalWidth;
//                 const naturalYmax = (ymax / 1000) * naturalHeight;
//                 const displayedXmin = naturalXmin * scaleX;
//                 const displayedYmin = naturalYmin * scaleY;
//                 const displayedXmax = naturalXmax * scaleX;
//                 const displayedYmax = naturalYmax * scaleY;
//                 const finalXmin = displayedXmin;
//                 const finalYmin = displayedYmin;
//                 const finalXmax = displayedXmax;
//                 const finalYmax = displayedYmax;
//                 const color = getColorForIndex(index);
//                 const colorHex = `rgb(${color.r}, ${color.g}, ${color.b})`;
//                 const overlay = document.createElement('div');
//                 overlay.className = 'overlay';
//                 overlay.style.cssText = `
//                     left: ${finalXmin}px;
//                     top: ${finalYmin}px;
//                     width: ${finalXmax - finalXmin}px;
//                     height: ${finalYmax - finalYmin}px;
//                     border-color: ${colorHex};
//                 `;
//                 const label = document.createElement('div');
//                 label.className = 'overlay-label';
//                 label.style.color = colorHex;
//                 label.textContent = obj.label || `Object ${index + 1}`;
//                 overlay.appendChild(label);
//                 container.appendChild(overlay);
//             });
//             coordinateSpan.textContent = `Created ${aiSegmentation.length} overlays with proper scaling`;
//             updateObjectList();
//         }
//         function updateObjectList() {
//             const objectList = document.getElementById('objectList');
//             const img = document.getElementById('keyboardImage');
//             const naturalWidth = img.naturalWidth;
//             const naturalHeight = img.naturalHeight;
//             const displayedWidth = img.offsetWidth;
//             const displayedHeight = img.offsetHeight;
//             const scaleX = displayedWidth / naturalWidth;
//             const scaleY = displayedHeight / naturalHeight;
//             const objectListHTML = aiSegmentation.map((obj, index) => {
//                 if (!obj.box_2d) return '';
//                 const [ymin, xmin, ymax, xmax] = obj.box_2d;
//                 const naturalXmin = (xmin / 1000) * naturalWidth;
//                 const naturalYmin = (ymin / 1000) * naturalHeight;
//                 const naturalXmax = (xmax / 1000) * naturalWidth;
//                 const naturalYmax = (ymax / 1000) * naturalHeight;
//                 const displayedXmin = naturalXmin * scaleX;
//                 const displayedYmin = naturalYmin * scaleY;
//                 const displayedXmax = naturalXmax * scaleX;
//                 const displayedYmax = naturalYmax * scaleY;
//                 const finalXmin = displayedXmin;
//                 const finalYmin = displayedYmin;
//                 const finalXmax = displayedXmax;
//                 const finalYmax = displayedYmax;
//                 const color = getColorForIndex(index);
//                 return `
//                     <div class="object-info">
//                         <strong>${obj.label || `Object ${index + 1}`}</strong><br>
//                         <span style="color: rgb(${color.r}, ${color.g}, ${color.b});">●</span>
//                         Raw AI coords: (${xmin}, ${ymin}) to (${xmax}, ${ymax})<br>
//                         Natural coords: (${naturalXmin.toFixed(1)}, ${naturalYmin.toFixed(1)}) to (${naturalXmax.toFixed(1)}, ${naturalYmax.toFixed(1)})<br>
//                         Displayed coords: (${displayedXmin.toFixed(1)}, ${displayedYmin.toFixed(1)}) to (${displayedXmax.toFixed(1)}, ${displayedYmax.toFixed(1)})<br>
//                         Final coords: (${finalXmin.toFixed(1)}, ${finalYmin.toFixed(1)}) to (${finalXmax.toFixed(1)}, ${finalYmax.toFixed(1)})<br>
//                         Size: ${(finalXmax - finalXmin).toFixed(1)} × ${(finalYmax - finalYmin).toFixed(1)} pixels<br>
//                         Confidence: ${obj.confidence || 'N/A'}
//                     </div>
//                 `;
//             }).join('');
//             objectList.innerHTML = objectListHTML;
//         }
//         if (document.readyState === 'complete') {
//             createOverlays();
//         }
//     </script>
// </body>
// </html>
//     `;

//     fs.writeFileSync(outputPath, html);
//     console.log(`[DEBUG] HTML debug visualization saved: ${outputPath}`);
//     return outputPath;
//   } catch (error) {
//     console.error('[DEBUG] Failed to create HTML debug visualization:', error);
//     return null;
//   }
// }

// /**
//  * Creates a detailed debug report with HTML visualization and AI analysis data
//  * @param {string} imagePath
//  * @param {Array} aiSegmentation
//  * @param {string} outputDir
//  * @param {Object} keyboardBox
//  * @returns {Promise<Object>}
//  */
// async function createDebugReport(imagePath, aiSegmentation, outputDir, keyboardBox = null) {
//   try {
//     console.log('[DEBUG] Creating comprehensive debug report...');
//     const timestamp = generateTimestamp();
//     const debugHtmlPath = path.join(outputDir, `debug-visualization-${timestamp}.html`);
//     const reportPath = path.join(outputDir, `debug-report-${timestamp}.json`);
//     const debugHtml = await createDebugHTMLVisualization(imagePath, aiSegmentation, debugHtmlPath, keyboardBox);
//     const report = {
//       timestamp: new Date().toISOString(),
//       originalImage: imagePath,
//       debugHtml: debugHtml,
//       aiSegmentation: aiSegmentation,
//       objectCount: aiSegmentation ? aiSegmentation.length : 0,
//       objects: aiSegmentation ? aiSegmentation.map((obj, index) => ({
//         index: index + 1,
//         label: obj.label || 'unknown',
//         box_2d: obj.box_2d,
//         hasMask: !!obj.mask,
//         confidence: obj.confidence || 'unknown'
//       })) : []
//     };
//     fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
//     console.log(`[DEBUG] Debug report saved: ${reportPath}`);
//     console.log(`[DEBUG] Debug HTML visualization: ${debugHtml}`);
//     console.log(`[DEBUG] Found ${report.objectCount} objects in the image`);
//     return { success: true, debugHtml, reportPath, objectCount: report.objectCount };
//   } catch (error) {
//     console.error('[DEBUG] Failed to create debug report:', error);
//     return { success: false, error: error.message };
//   }
// }

// module.exports = {
//   createDebugHTMLVisualization,
//   createDebugReport,
// };


