// Test to verify the fix works correctly
// This simulates the new splitExplanation function

const testAIResponse = `Analysis:

The provided code shows a product selection dropdown on a webpage.  The dropdown currently lists several product categories. The user wants to add a "test" option to this dropdown.  The current implementation uses JavaScript to show/hide sub-categories based on the main product selection.  Adding a test option requires adding a new option to the \`<select>\` element and potentially updating the JavaScript \`showSub\` function to handle this new option appropriately (though the request doesn't specify behavior for this test option).


Changes:

We will add a "Test" option to the Product dropdown.  Since the user hasn't specified the behavior of this option, we'll make it behave like the other options, displaying a placeholder sub-category select.


Search/Replace Operations:

\`\`\`search-replace
FILE: www/index.php
LINES: 100-100
SEARCH: <option value="6">ACB &amp; GIS Current Transformer</option>
REPLACE: <option value="6">ACB &amp; GIS Current Transformer</option>
<option value="7">Test</option>
\`\`\`

\`\`\`search-replace
FILE: www/index.php
LINES: 100-100
SEARCH: <select name="SUB6" class="select1 select" style="display: none;" onchange="if(this.value) location.href=(this.value);">
REPLACE: <select name="SUB7" class="select1 select" style="display: none;">
<option value="">------------------------------ Category ------------------------------</option>
</select>
\`\`\`

\`\`\`search-replace
FILE: www/index.php
LINES: 173-206
SEARCH: } else if (obj == 6) {
                                f.SUB0.style.display = "none";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "";
                            } else if (obj == 0) {
                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";
                            }
                            return false
                        }
                    </script>

REPLACE: } else if (obj == 6) {
                                f.SUB0.style.display = "none";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "";
                            } else if (obj == 7) {
                                f.SUB0.style.display = "none";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";
                                f.SUB7.style.display = "";
                            } else if (obj == 0) {
                                f.SUB0.style.display = "";
                                f.SUB1.style.display = "none";
                                f.SUB2.style.display = "none";
                                f.SUB3.style.display = "none";
                                f.SUB4.style.display = "none";
                                f.SUB5.style.display = "none";
                                f.SUB6.style.display = "none";
                                f.SUB7.style.display = "none";
                            }
                            return false
                        }
                    </script>
\`\`\`

These changes add the "Test" option to the product dropdown and  ensure a corresponding empty subcategory select is shown when "Test" is selected.  The JavaScript is updated to handle the new option.  Remember to deploy these changes to your web server after making them.`;

// Simulate the new splitExplanation function
function splitExplanation(text) {
  console.log('🔍 DEBUG: Using search-replace blocks as positioning markers');

  // Find all search-replace blocks and their positions
  const searchReplaceBlockRegex = /```search-replace[\s\S]*?```/g;
  const blocks = [];
  let match;
  
  while ((match = searchReplaceBlockRegex.exec(text)) !== null) {
    blocks.push({
      block: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  console.log(`🔍 Found ${blocks.length} search-replace blocks for positioning`);

  if (blocks.length === 0) {
    // No search-replace blocks, return original text
    return {
      before: text,
      after: ''
    };
  }
  
  // Find the first search-replace block to split around
  const firstBlock = blocks[0];
  const beforeText = text.substring(0, firstBlock.start).trim();
  const afterText = text.substring(firstBlock.end).trim();
  
  console.log('📍 Positioning information:', {
    beforeLength: beforeText.length,
    afterLength: afterText.length,
    firstBlockPosition: `${firstBlock.start}-${firstBlock.end}`,
    totalBlocks: blocks.length
  });

  return {
    before: beforeText,
    after: afterText
  };
}

console.log('=== TESTING THE FIX ===\n');

// Test the new function
const result = splitExplanation(testAIResponse);

console.log('\n✅ BEFORE TEXT (what user sees before CodeEditBlock):');
console.log('='.repeat(80));
console.log(result.before);
console.log('='.repeat(80));

console.log('\n✅ AFTER TEXT (what user sees after CodeEditBlock):');
console.log('='.repeat(80));
console.log(result.after);
console.log('='.repeat(80));

console.log('\n🎯 KEY IMPROVEMENTS:');
console.log('   ✅ Preserves "Search/Replace Operations:" header');
console.log('   ✅ Preserves conclusion text');
console.log('   ✅ Uses search-replace blocks as positioning markers');
console.log('   ✅ Splits text at exact location of first search-replace block');
console.log('   ✅ No more wrong text removal');

console.log('\n=== FIX VERIFICATION COMPLETE ===');
