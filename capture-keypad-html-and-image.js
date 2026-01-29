/**
 * Capture Virtual Keypad HTML + Image + Layout Data
 *
 * Goal: Get complete picture of how keypad is rendered
 * 1. Download keypad sprite image
 * 2. Capture keypad layout JSON
 * 3. Capture actual HTML/DOM structure
 * 4. Compare to understand coord vs preCoord
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  console.log('🔬 Capture Keypad HTML + Image + Layout\n');
  console.log('═'.repeat(70));
  console.log('');

  const capturedData = {
    layouts: [],  // Array to store all three layouts
    images: []    // Array to store all three images
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();

  // Intercept keypad responses
  page.on('response', async response => {
    const url = response.url();

    if (url.includes('nppfs.keypad.jsp')) {
      const method = response.request().method();
      const postData = response.request().postData();

      // Capture layout JSON (ALL THREE)
      if (method === 'POST') {
        try {
          const responseText = await response.text();

          if (responseText.includes('keypadUuid') && responseText.includes('buttons')) {
            const keypadData = JSON.parse(responseText);

            // Determine which field this is for
            let fieldName = 'unknown';
            if (postData?.includes('i=pwd&') || postData?.includes('i=pwd"')) {
              fieldName = 'pwd';
            } else if (postData?.includes('i=pwd2')) {
              fieldName = 'pwd2';
            } else if (postData?.includes('i=pwd3')) {
              fieldName = 'pwd3';
            }

            console.log(`📊 Keypad layout ${capturedData.layouts.length + 1}/3 for field: ${fieldName}`);
            console.log(`   UUID: ${keypadData.info?.keypadUuid}`);

            const layoutEntry = {
              field: fieldName,
              uuid: keypadData.info?.keypadUuid,
              data: keypadData,
              imageSrc: keypadData.info?.src
            };

            capturedData.layouts.push(layoutEntry);

            // Save individual layout
            fs.writeFileSync(`keypad-layout-${fieldName}.json`, JSON.stringify(keypadData, null, 2));
            console.log(`   Saved to: keypad-layout-${fieldName}.json`);
            console.log('');
          }
        } catch (e) {
          // Not JSON
        }
      }
      // Capture images (ALL THREE)
      else if (method === 'GET' && response.headers()['content-type']?.includes('image')) {
        console.log(`📷 Keypad image: ${url.substring(0, 80)}...`);

        const imageBuffer = await response.body();
        const imageIndex = capturedData.images.length + 1;

        // Try to match with layout
        const matchingLayout = capturedData.layouts.find(l =>
          l.imageSrc && url.includes(l.imageSrc.split('?')[0].split('/').pop())
        );

        const fileName = matchingLayout
          ? `keypad-sprite-${matchingLayout.field}.png`
          : `keypad-sprite-${imageIndex}.png`;

        fs.writeFileSync(fileName, imageBuffer);

        capturedData.images.push({
          fileName: fileName,
          url: url,
          size: imageBuffer.length,
          matchedField: matchingLayout?.field || 'unknown'
        });

        console.log(`   Saved to: ${fileName} (${imageBuffer.length} bytes)`);
        if (matchingLayout) {
          console.log(`   ✅ Matched with ${matchingLayout.field} layout`);
        }
        console.log('');
      }
    }
  });

  console.log('🌐 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('🎯 Clicking password field to show keypad...');
  await page.locator('#pwd').click();
  await page.waitForTimeout(5000);

  // Capture the actual keypad HTML
  console.log('📋 Capturing keypad HTML structure...');

  const keypadInfo = await page.evaluate(() => {
    // Find the keypad container
    const keypadDiv = document.querySelector('#nppfs-keypad-pwd');

    if (!keypadDiv) {
      return { found: false };
    }

    // Get complete HTML
    const html = keypadDiv.outerHTML;

    // Get computed styles for key elements
    const styles = {
      container: window.getComputedStyle(keypadDiv),
      image: null,
      buttons: []
    };

    // Get image info
    const img = keypadDiv.querySelector('.kpd-image-button');
    if (img) {
      const imgStyle = window.getComputedStyle(img);
      styles.image = {
        width: imgStyle.width,
        height: imgStyle.height,
        marginTop: imgStyle.marginTop,
        position: imgStyle.position,
        left: imgStyle.left,
        top: imgStyle.top,
        src: img.src
      };
    }

    // Get button overlay info
    const buttons = keypadDiv.querySelectorAll('.kpd-button');
    buttons.forEach((btn, idx) => {
      if (idx < 10) {  // Sample first 10
        const btnStyle = window.getComputedStyle(btn);
        styles.buttons.push({
          index: idx,
          className: btn.className,
          position: btnStyle.position,
          left: btnStyle.left,
          top: btnStyle.top,
          width: btnStyle.width,
          height: btnStyle.height,
          onclick: btn.onclick ? 'has onclick' : 'no onclick'
        });
      }
    });

    return {
      found: true,
      html: html.substring(0, 5000),  // First 5000 chars
      htmlLength: html.length,
      styles: styles,
      dimensions: {
        containerWidth: keypadDiv.offsetWidth,
        containerHeight: keypadDiv.offsetHeight
      }
    };
  });

  if (keypadInfo.found) {
    console.log('✅ Keypad HTML captured');
    console.log(`   HTML length: ${keypadInfo.htmlLength} chars`);
    console.log(`   Container: ${keypadInfo.dimensions.containerWidth}×${keypadInfo.dimensions.containerHeight}px`);

    if (keypadInfo.styles.image) {
      console.log(`   Image: ${keypadInfo.styles.image.width} × ${keypadInfo.styles.image.height}`);
      console.log(`   Image margin-top: ${keypadInfo.styles.image.marginTop}`);
    }

    console.log(`   Button overlays: ${keypadInfo.styles.buttons.length} sampled`);
    console.log('');

    // Save HTML
    fs.writeFileSync('keypad-dom.html', keypadInfo.html);
    console.log('💾 Saved HTML to: keypad-dom.html (truncated)');

    // Save styles info
    fs.writeFileSync('keypad-styles.json', JSON.stringify(keypadInfo.styles, null, 2));
    console.log('💾 Saved styles to: keypad-styles.json');
  } else {
    console.log('⚠️  Keypad HTML not found');
  }

  console.log('');

  // Create analysis report
  console.log('═'.repeat(70));
  console.log('📊 CAPTURE SUMMARY');
  console.log('═'.repeat(70));
  console.log('');

  console.log(`Layouts captured: ${capturedData.layouts.length}/3`);
  capturedData.layouts.forEach((layout, i) => {
    console.log(`  ${i + 1}. ${layout.field} (UUID: ${layout.uuid})`);
  });
  console.log('');

  console.log(`Images captured: ${capturedData.images.length}/3`);
  capturedData.images.forEach((img, i) => {
    console.log(`  ${i + 1}. ${img.fileName} (${img.matchedField}) - ${img.size} bytes`);
  });
  console.log('');

  // Compare hashes across all three layouts
  if (capturedData.layouts.length === 3) {
    console.log('═'.repeat(70));
    console.log('🔍 HASH COMPARISON ACROSS KEYBOARDS');
    console.log('═'.repeat(70));
    console.log('');

    // Extract hashes from each layout
    const hashSets = capturedData.layouts.map(layout => {
      const hashes = new Set();
      layout.data.items.forEach(item => {
        item.buttons.forEach(btn => {
          if (btn.type === 'data' && btn.action) {
            const match = btn.action.match(/data:([a-f0-9]+):(.)/);
            if (match) {
              hashes.add(match[1]);
            }
          }
        });
      });
      return { field: layout.field, hashes: hashes };
    });

    console.log('Total unique hashes per keyboard:');
    hashSets.forEach(set => {
      console.log(`  ${set.field}: ${set.hashes.size} hashes`);
    });
    console.log('');

    // Check for overlap
    const [set1, set2, set3] = hashSets.map(s => s.hashes);
    const intersection12 = new Set([...set1].filter(h => set2.has(h)));
    const intersection13 = new Set([...set1].filter(h => set3.has(h)));
    const intersection23 = new Set([...set2].filter(h => set3.has(h)));
    const intersectionAll = new Set([...set1].filter(h => set2.has(h) && set3.has(h)));

    console.log('Hash overlap (same hashes in different keyboards):');
    console.log(`  pwd ∩ pwd2: ${intersection12.size} common hashes`);
    console.log(`  pwd ∩ pwd3: ${intersection13.size} common hashes`);
    console.log(`  pwd2 ∩ pwd3: ${intersection23.size} common hashes`);
    console.log(`  ALL three: ${intersectionAll.size} common hashes`);
    console.log('');

    if (intersectionAll.size > 50) {
      console.log('🎉 HASHES ARE SHARED ACROSS KEYBOARDS!');
      console.log('');
      console.log('This proves:');
      console.log('  ✅ Hashes are persistent IDs (not random per keyboard)');
      console.log('  ✅ Same hash = same character across all keyboards');
      console.log('  ✅ We can build a master database by mapping once!');
      console.log('');
    } else if (intersectionAll.size > 0) {
      console.log('🤔 Some hashes are shared, but not all');
      console.log(`   ${intersectionAll.size} common hashes found`);
      console.log('   Might be common characters (numbers, special chars)');
      console.log('');
    } else {
      console.log('❌ No hash overlap!');
      console.log('');
      console.log('This means:');
      console.log('  - Hashes are randomized per keyboard');
      console.log('  - Can\'t build persistent database');
      console.log('  - Each keyboard needs separate mapping');
      console.log('');
    }
  }

  console.log('');
  console.log('Files created:');
  console.log('  - keypad-layout-pwd.json, pwd2.json, pwd3.json → Layouts');
  console.log('  - keypad-sprite-pwd.png, pwd2.png, pwd3.png → Images');
  console.log('  - keypad-dom.html → HTML structure');
  console.log('  - keypad-styles.json → CSS styles');
  console.log('');

  // Save complete data package
  const complete = {
    captured: new Date().toISOString(),
    layouts: capturedData.layouts.map(l => ({
      field: l.field,
      uuid: l.uuid,
      buttonCount: l.data.items.reduce((sum, item) => sum + (item.buttons?.length || 0), 0)
    })),
    images: capturedData.images
  };

  fs.writeFileSync('keypad-capture-summary.json', JSON.stringify(complete, null, 2));
  console.log('💾 Summary saved to: keypad-capture-summary.json');
  console.log('');

  console.log('Press any key to close...');
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  await browser.close();
  process.exit(0);
})();
