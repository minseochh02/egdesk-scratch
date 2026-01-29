/**
 * Parse Keypad Data from id-flow-trace.json
 *
 * Makes the nppfs.keypad.jsp request/response data human-readable
 */

const fs = require('fs');

console.log('🔍 Parsing Keypad Data\n');
console.log('═'.repeat(70));
console.log('');

// Read the trace file
const traceData = JSON.parse(fs.readFileSync('old-results/id-flow-trace.json', 'utf8'));

console.log(`Total Shinhan responses captured: ${traceData.shinhanResponses.length}`);
console.log('');

// Filter for keypad responses
const keypadResponses = traceData.shinhanResponses.filter(r =>
  r.endpoint === 'nppfs.keypad.jsp' && r.responseFull.includes('keypadUuid')
);

console.log(`Keypad initialization responses: ${keypadResponses.length}`);
console.log('');

keypadResponses.forEach((response, idx) => {
  console.log('═'.repeat(70));
  console.log(`KEYPAD RESPONSE #${idx + 1}`);
  console.log('═'.repeat(70));
  console.log('');

  // Parse POST data parameters
  console.log('📤 REQUEST (POST parameters):');
  console.log('');

  try {
    const params = new URLSearchParams(response.postData);
    const paramObj = Object.fromEntries(params.entries());

    console.log('  Session/Field Info:');
    console.log(`    u (session ID):    ${paramObj.u || '(none)'}`);
    console.log(`    i (field name):    ${paramObj.i || '(none)'}`);
    console.log(`    ui (toggle ID):    ${paramObj.ui || '(none)'}`);
    console.log(`    f (form ID?):      ${paramObj.f || '(none)'}`);
    console.log('');

    console.log('  Display Config:');
    console.log(`    w (width):         ${paramObj.w || '(none)'}`);
    console.log(`    h (height):        ${paramObj.h || '(none)'}`);
    console.log(`    il (input length): ${paramObj.il || '(none)'}`);
    console.log(`    th (theme):        ${paramObj.th || '(none)'}`);
    console.log('');

    console.log('  Keypad Config:');
    console.log(`    m (mode):          ${paramObj.m || '(none)'}`);
    console.log(`    t (type):          ${paramObj.t || '(none)'}`);
    console.log(`    dp (display?):     ${paramObj.dp || '(none)'}`);
    console.log(`    ev (version):      ${paramObj.ev || '(none)'}`);
    console.log('');
  } catch (e) {
    console.log('  (Could not parse parameters)');
    console.log(`  Raw: ${response.postData.substring(0, 150)}...`);
    console.log('');
  }

  // Parse response JSON
  console.log('📥 RESPONSE:');
  console.log('');

  try {
    const responseJSON = JSON.parse(response.responseFull);

    if (responseJSON.info) {
      const info = responseJSON.info;

      console.log('  Keypad Info:');
      console.log(`    UUID:         ${info.keypadUuid || '(none)'}`);
      console.log(`    Type:         ${info.type || '(none)'}`);
      console.log(`    Mode:         ${info.mode || '(none)'}`);
      console.log(`    Width:        ${info.iw || '(none)'} × ${info.ih || '(none)'}`);
      console.log(`    Touch:        ${info.touch?.use ? 'Enabled' : 'Disabled'}`);
      console.log(`    Preview:      ${info.preview?.use ? 'Enabled' : 'Disabled'}`);
      console.log('');

      if (info.inputs) {
        console.log('  Input Field Mappings:');
        console.log(`    Hash field:   ${info.inputs.hash || '(none)'}`);
        console.log(`    Use-yn field: ${info.inputs.useyn || '(none)'}`);
        console.log(`    Info field:   ${info.inputs.info || '(none)'}`);
        console.log(`    Toggle:       ${info.inputs.toggle || '(none)'}`);
        console.log('');
      }

      if (info.dynamic && info.dynamic.length > 0) {
        console.log('  Dynamic Fields (Initial Values):');
        info.dynamic.forEach(field => {
          console.log(`    ${field.k}: ${field.v ? field.v.substring(0, 60) + '...' : '(empty)'}`);
        });
        console.log('');
      }

      if (responseJSON.items && responseJSON.items.length > 0) {
        console.log('  Keypad Layouts:');
        responseJSON.items.forEach(layout => {
          console.log(`    Layout: ${layout.id}`);
          console.log(`    Buttons: ${layout.buttons ? layout.buttons.length : 0}`);

          // Show sample buttons
          if (layout.buttons && layout.buttons.length > 0) {
            const dataButtons = layout.buttons.filter(b => b.type === 'data').slice(0, 5);
            if (dataButtons.length > 0) {
              console.log(`    Sample button mappings:`);
              dataButtons.forEach(btn => {
                const action = btn.action || '';
                const actionMatch = action.match(/data:([a-f0-9]+):(.)/);
                if (actionMatch) {
                  const hash = actionMatch[1];
                  const char = actionMatch[2];
                  console.log(`      Button → char:"${char}" hash:${hash.substring(0, 20)}...`);
                }
              });
            }
          }
          console.log('');
        });
      }
    }
  } catch (e) {
    console.log('  (Could not parse JSON response)');
    console.log(`  Error: ${e.message}`);
    console.log(`  Raw: ${response.responseFull.substring(0, 200)}...`);
    console.log('');
  }

  console.log('');
});

// Summary
console.log('═'.repeat(70));
console.log('📊 SUMMARY');
console.log('═'.repeat(70));
console.log('');

console.log('What This Data Tells Us:');
console.log('');
console.log('1. Keypad UUIDs:');
console.log('   - Each password field gets unique keypad UUID');
console.log('   - Used to identify which virtual keypad to display');
console.log('');
console.log('2. Button Mappings:');
console.log('   - Each button has coordinate mapping');
console.log('   - Action format: "data:<hash>:<character>"');
console.log('   - Hash identifies the button press');
console.log('   - Character is what gets typed');
console.log('');
console.log('3. Field Configuration:');
console.log('   - Multiple password fields (pwd, pwd2, pwd3)');
console.log('   - Each has associated hidden fields (__KH_, __KI_, __KU_)');
console.log('   - Toggle buttons for show/hide password');
console.log('');
console.log('4. Session Correlation:');
console.log('   - All requests include u=176965174957734 (session ID)');
console.log('   - Keypad UUID links to specific field');
console.log('   - Server tracks which keypad belongs to which session');
console.log('');

// Extract all keypad UUIDs
const allUUIDs = keypadResponses.map(r => {
  try {
    const json = JSON.parse(r.responseFull);
    return json.info?.keypadUuid;
  } catch (e) {
    return null;
  }
}).filter(u => u);

console.log('Keypad UUIDs found in this session:');
allUUIDs.forEach((uuid, i) => {
  console.log(`  ${i + 1}. ${uuid}`);
});
console.log('');

console.log('🎯 This data structure is for:');
console.log('   - Virtual keypad rendering (coordinates, layout)');
console.log('   - Click-to-type mapping (hash per button)');
console.log('   - Field identification (UUID per keypad)');
console.log('');
console.log('💡 Important: This is NOT keystroke timing data!');
console.log('   Still need to find where timing is sent/stored.');
console.log('');
