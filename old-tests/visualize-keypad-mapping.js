/**
 * Visualize Virtual Keypad Mapping
 *
 * Steps:
 * 1. Capture keypad layout response (get coords and hashes)
 * 2. Download keypad image (from nppfs.keypad.jsp)
 * 3. Get image dimensions
 * 4. Draw bounding boxes at each coord position
 * 5. Label with hash/character info
 * 6. Save annotated image
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

(async () => {
  console.log('🎨 Virtual Keypad Mapping Visualizer\n');
  console.log('═'.repeat(70));
  console.log('');

  const sessionData = {
    keypadLayout: null,
    keypadImageURL: null,
    buttons: []
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();

  // Intercept keypad response
  page.on('response', async response => {
    const url = response.url();

    if (url.includes('nppfs.keypad.jsp')) {
      const method = response.request().method();

      // Check if it's the image request
      if (method === 'GET' && response.headers()['content-type']?.includes('image')) {
        console.log(`📷 Keypad image found: ${url}`);

        sessionData.keypadImageURL = url;

        // Download the image
        const imageBuffer = await response.body();
        fs.writeFileSync('keypad-image.png', imageBuffer);

        console.log(`   Saved to: keypad-image.png`);
        console.log(`   Size: ${imageBuffer.length} bytes`);
        console.log('');
      }
      // Check if it's the layout response
      else if (method === 'POST') {
        try {
          const responseText = await response.text();

          if (responseText.includes('keypadUuid') && responseText.includes('buttons')) {
            const keypadData = JSON.parse(responseText);

            console.log(`📊 Keypad layout captured: ${keypadData.info?.keypadUuid}`);
            console.log(`   Image dimensions: ${keypadData.info?.tw} × ${keypadData.info?.th}`);
            console.log('');

            sessionData.keypadLayout = keypadData;

            // Extract all buttons
            keypadData.items.forEach(layout => {
              layout.buttons.forEach(button => {
                if (button.type === 'data' && button.action && button.coord) {
                  const match = button.action.match(/data:([a-f0-9]+):(.)/);
                  if (match) {
                    sessionData.buttons.push({
                      layout: layout.id,
                      coord: button.coord,
                      preCoord: button.preCoord,
                      hash: match[1],
                      maskChar: match[2]
                    });
                  }
                }
              });
            });

            console.log(`   Extracted ${sessionData.buttons.length} button mappings`);
            console.log('');
          }
        } catch (e) {
          // Not keypad layout response
        }
      }
    }
  });

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field to trigger keypad...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(5000);

  console.log('═'.repeat(70));
  console.log('🖼️  GENERATING ANNOTATED IMAGE');
  console.log('═'.repeat(70));
  console.log('');

  if (!sessionData.keypadLayout) {
    console.log('❌ No keypad layout captured!');
    console.log('   Keypad might not have loaded');
    await browser.close();
    process.exit(1);
  }

  if (!fs.existsSync('keypad-image.png')) {
    console.log('❌ Keypad image not downloaded!');
    console.log('   Image might have different URL or format');
    await browser.close();
    process.exit(1);
  }

  console.log('✅ Have layout data and image');
  console.log('');

  // Load the image
  console.log('📷 Loading keypad image...');
  const image = await loadImage('keypad-image.png');

  console.log(`   Image size: ${image.width} × ${image.height}`);
  console.log('');

  // Create canvas with same size as image
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  // Draw the original image
  ctx.drawImage(image, 0, 0);

  // Draw bounding boxes for each button
  console.log('🎨 Drawing bounding boxes...');
  console.log('');

  const colors = {
    'a': 'rgba(0, 255, 0, 0.5)',    // Green for lowercase
    'A': 'rgba(0, 0, 255, 0.5)',    // Blue for uppercase
    '1': 'rgba(255, 165, 0, 0.5)',  // Orange for numbers
    '_': 'rgba(255, 0, 255, 0.5)'   // Magenta for special
  };

  let drawnCount = 0;

  // Layout offsets (sprite sheet positions)
  const layoutOffsets = {
    'lower': 0,
    'upper': 278,
    'special': 556
  };

  sessionData.buttons.forEach(button => {
    const { coord, preCoord, maskChar, hash, layout } = button;

    // Use preCoord for drawing on the sprite sheet
    // Apply Y offset based on layout
    const yOffset = layoutOffsets[layout] || 0;
    const actualY1 = preCoord.y1 + yOffset;
    const actualY2 = preCoord.y2 + yOffset;

    // Draw rectangle using preCoord
    ctx.strokeStyle = colors[maskChar] || 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(preCoord.x1, actualY1, preCoord.x2 - preCoord.x1, actualY2 - actualY1);

    // Fill with semi-transparent color
    ctx.fillStyle = colors[maskChar] || 'rgba(255, 0, 0, 0.2)';
    ctx.fillRect(preCoord.x1, actualY1, preCoord.x2 - preCoord.x1, actualY2 - actualY1);

    // Draw hash (first 8 chars)
    ctx.fillStyle = 'white';
    ctx.font = '8px Arial';
    ctx.fillText(hash.substring(0, 8), preCoord.x1 + 2, actualY1 + 10);

    // Draw mask character
    ctx.fillStyle = 'yellow';
    ctx.font = 'bold 10px Arial';
    ctx.fillText(`[${maskChar}]`, preCoord.x1 + 2, actualY1 + 22);

    drawnCount++;
  });

  console.log(`   Drew ${drawnCount} bounding boxes`);
  console.log('');

  // Save annotated image
  const out = fs.createWriteStream('keypad-annotated.png');
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  await new Promise((resolve) => {
    out.on('finish', resolve);
  });

  console.log('✅ Saved annotated image to: keypad-annotated.png');
  console.log('');

  console.log('═'.repeat(70));
  console.log('📊 LEGEND');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Box colors:');
  console.log('  🟢 Green:   Lowercase letters (mask "a")');
  console.log('  🔵 Blue:    Uppercase letters (mask "A")');
  console.log('  🟠 Orange:  Numbers (mask "1")');
  console.log('  🟣 Magenta: Special characters (mask "_")');
  console.log('');
  console.log('Labels:');
  console.log('  Top:    First 8 chars of hash');
  console.log('  Bottom: [mask character]');
  console.log('');

  console.log('═'.repeat(70));
  console.log('💡 HOW TO USE');
  console.log('═'.repeat(70));
  console.log('');
  console.log('1. Open keypad-annotated.png');
  console.log('2. Look at the actual characters on the keypad');
  console.log('3. Match them with the bounding boxes');
  console.log('4. Now you know: char "a" → hash 4d567a87...');
  console.log('');
  console.log('Note: The image is a sprite sheet (1138×834)');
  console.log('  - Top portion (0-278px): "lower" layout');
  console.log('  - Middle portion (278-556px): "upper" layout');
  console.log('  - Bottom portion (556-834px): "special" layout');
  console.log('');

  // Also save the button data as JSON for reference
  const buttonData = {
    imageURL: sessionData.keypadImageURL,
    imageDimensions: {
      width: image.width,
      height: image.height
    },
    layoutDimensions: {
      width: sessionData.keypadLayout.info.tw,
      height: sessionData.keypadLayout.info.th
    },
    visibleDimensions: {
      width: sessionData.keypadLayout.info.iw,
      height: sessionData.keypadLayout.info.ih
    },
    buttons: sessionData.buttons,
    layouts: {
      lower: sessionData.buttons.filter(b => b.layout === 'lower').length,
      upper: sessionData.buttons.filter(b => b.layout === 'upper').length,
      special: sessionData.buttons.filter(b => b.layout === 'special').length
    }
  };

  fs.writeFileSync('keypad-button-data.json', JSON.stringify(buttonData, null, 2));
  console.log('💾 Button data saved to: keypad-button-data.json');
  console.log('');

  console.log('Press ENTER to close browser...');
  await new Promise(resolve => {
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });

  await browser.close();
  process.exit(0);
})();
