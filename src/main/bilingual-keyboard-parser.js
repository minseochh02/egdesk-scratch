// ============================================================================
// BILINGUAL KEYBOARD PARSER
// ============================================================================
// Parses bilingual keyboard key labels (English/Korean/Symbols)
// Handles various formats from AI-detected keyboard keys

/**
 * Parses bilingual keyboard key labels (English/Korean)
 * Handles formats like: "a_ㅏ", "Key: n / ㅜ", "q/ㅂ key", "1/!", etc.
 * @param {string} label - Key label from AI
 * @returns {Object} Parsed characters { english: string[], korean: string[], special: string[] }
 */
function parseBilingualKeyLabel(label) {
  if (!label || typeof label !== 'string') {
    return { english: [], korean: [], special: [] };
  }

  const result = {
    english: [],
    korean: [],
    special: []
  };

  // Normalize the label: trim and lowercase for processing
  const normalized = label.trim();
  const lowerLabel = normalized.toLowerCase();

  // Ignore non-functional keys (logos, decorations, etc.)
  const ignoredPatterns = ['logo', 'shinhan', 'bank', 'text', 'decoration', 'image'];
  if (ignoredPatterns.some(pattern => lowerLabel.includes(pattern))) {
    return result; // Return empty result for non-functional keys
  }

  // Handle key_char_* format: key_char_a, key_char_1, key_char_x, etc.
  const charMatch = normalized.match(/^key_char_([a-z0-9])$/i);
  if (charMatch) {
    const char = charMatch[1].toLowerCase();
    if (/[a-z]/.test(char)) {
      result.english.push(char);
      return result;
    } else if (/[0-9]/.test(char)) {
      result.english.push(char);
      return result;
    }
  }

  // Handle key_digit_* format: key_digit_1, key_digit_0, etc.
  const digitMatch = normalized.match(/^key_digit_([0-9])$/i);
  if (digitMatch) {
    result.english.push(digitMatch[1]);
    return result;
  }

  // Handle underscore-separated format: key_letter_a, key_number_1, key_dot_*, key_enter_left, etc.
  // Extended to cover more symbol types and split keys
  const underscoreMatch = normalized.match(/^key_(letter|number|shift|enter|backspace|tab|space|hyphen|equals|comma|semicolon|slash|left_bracket|right_bracket|won_symbol|dot|apostrophe|quote|tilde|backtick|backslash|pipe)_?(left|right|top_left|top_right|bottom_left|bottom_right|[a-z0-9]+)?$/i);
  if (underscoreMatch) {
    const keyType = underscoreMatch[1].toLowerCase();
    const keyValue = underscoreMatch[2] ? underscoreMatch[2].toLowerCase() : '';
    
    if (keyType === 'letter' && keyValue && /^[a-z]$/.test(keyValue)) {
      result.english.push(keyValue);
      return result;
    } else if (keyType === 'number' && keyValue && /^[0-9]$/.test(keyValue)) {
      result.english.push(keyValue);
      return result;
    } else if (keyType === 'shift') {
      // Handles all shift key variants: key_shift, key_shift_left, key_shift_right, etc.
      result.special.push('shift');
      return result;
    } else if (keyType === 'enter') {
      // Handles all enter key variants: key_enter, key_enter_left, key_enter_right, etc.
      result.special.push('enter');
      return result;
    } else if (keyType === 'backspace') {
      result.special.push('backspace');
      return result;
    } else if (keyType === 'tab') {
      result.special.push('tab');
      return result;
    } else if (keyType === 'space') {
      result.special.push(' ');
      return result;
    } else if (keyType === 'hyphen') {
      result.special.push('-');
      return result;
    } else if (keyType === 'equals') {
      result.special.push('=');
      return result;
    } else if (keyType === 'comma') {
      result.special.push(',');
      return result;
    } else if (keyType === 'semicolon') {
      result.special.push(';');
      return result;
    } else if (keyType === 'slash') {
      result.special.push('/');
      return result;
    } else if (keyType === 'left_bracket') {
      result.special.push('[');
      return result;
    } else if (keyType === 'right_bracket') {
      result.special.push(']');
      return result;
    } else if (keyType === 'won_symbol') {
      result.special.push('₩');
      return result;
    } else if (keyType === 'dot') {
      // Handle variations like key_dot_top_left, key_dot_bottom_right, or just key_dot
      result.special.push('.');
      return result;
    } else if (keyType === 'apostrophe') {
      result.special.push("'");
      return result;
    } else if (keyType === 'quote') {
      result.special.push('"');
      return result;
    } else if (keyType === 'tilde') {
      result.special.push('~');
      return result;
    } else if (keyType === 'backtick') {
      result.special.push('`');
      return result;
    } else if (keyType === 'backslash') {
      result.special.push('\\');
      return result;
    } else if (keyType === 'pipe') {
      result.special.push('|');
      return result;
    }
  }

  // Special keys (case-insensitive)
  const specialKeys = [
    { patterns: ['enter', 'return'], value: 'enter' },
    { patterns: ['shift'], value: 'shift' },
    { patterns: ['space', 'spacebar'], value: ' ' },
    { patterns: ['tab'], value: 'tab' },
    { patterns: ['backspace', 'back'], value: 'backspace' },
    { patterns: ['delete', 'del'], value: 'delete' },
    { patterns: ['escape', 'esc'], value: 'escape' },
    { patterns: ['control', 'ctrl'], value: 'ctrl' },
    { patterns: ['alt', 'option'], value: 'alt' },
    { patterns: ['command', 'cmd', 'meta'], value: 'cmd' },
    { patterns: ['caps', 'capslock'], value: 'capslock' }
  ];

  for (const specialKey of specialKeys) {
    for (const pattern of specialKey.patterns) {
      if (lowerLabel.includes(pattern)) {
        result.special.push(specialKey.value);
        return result; // Special keys don't have other characters
      }
    }
  }

  // Extract all potential characters from various formats
  const extractionPatterns = [
    // Format: "Key: n / ㅜ" or "key: a / ㅏ"
    /key:\s*([a-z0-9])\s*\/\s*([ㄱ-ㅎㅏ-ㅣ가-힣])/i,
    
    // Format: "a / ㅏ key" or "1 / ! key"
    /^([a-z0-9!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~])\s*\/\s*([ㄱ-ㅎㅏ-ㅣ가-힣!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~])/i,
    
    // Format: "a_ㅏ" or "n_ㅜ" (underscore separator)
    /^([a-z0-9])_([ㄱ-ㅎㅏ-ㅣ가-힣])$/i,
    
    // Format: "a-ㅏ" or "n-ㅜ" (hyphen separator)
    /^([a-z0-9])-([ㄱ-ㅎㅏ-ㅣ가-힣])$/i,
    
    // Format: "aㅏ" (no separator)
    /^([a-z0-9])([ㄱ-ㅎㅏ-ㅣ가-힣])$/i,
    
    // Format: "1/!" or "2/@" (number with symbol)
    /^([0-9])\s*\/\s*([!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~])$/,
    
    // Format: "Key: 1 / !" (number with symbol)
    /key:\s*([0-9])\s*\/\s*([!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~])/i
  ];

  let matched = false;
  for (const pattern of extractionPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      matched = true;
      
      // First capture group
      if (match[1]) {
        const char1 = match[1].toLowerCase();
        // Check if it's Korean
        if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(char1)) {
          if (!result.korean.includes(char1)) result.korean.push(char1);
        } else if (/[a-z0-9]/.test(char1)) {
          if (!result.english.includes(char1)) result.english.push(char1);
        } else {
          // Special symbol
          if (!result.special.includes(match[1])) result.special.push(match[1]);
        }
      }
      
      // Second capture group
      if (match[2]) {
        const char2 = match[2];
        // Check if it's Korean
        if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(char2)) {
          if (!result.korean.includes(char2)) result.korean.push(char2);
        } else if (/[a-z0-9]/.test(char2.toLowerCase())) {
          const lowerChar2 = char2.toLowerCase();
          if (!result.english.includes(lowerChar2)) result.english.push(lowerChar2);
        } else {
          // Special symbol (keep original case for symbols)
          if (!result.special.includes(char2)) result.special.push(char2);
        }
      }
      
      break; // Stop after first match
    }
  }

  // Fallback: try to extract any standalone characters if no pattern matched
  if (!matched) {
    // Extract single English letter or number
    const englishMatch = normalized.match(/\b([a-z0-9])\b/i);
    if (englishMatch) {
      result.english.push(englishMatch[1].toLowerCase());
    }
    
    // Extract Korean characters
    const koreanMatch = normalized.match(/([ㄱ-ㅎㅏ-ㅣ가-힣])/);
    if (koreanMatch) {
      result.korean.push(koreanMatch[1]);
    }
    
    // Extract symbols
    const symbolMatch = normalized.match(/([!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~])/);
    if (symbolMatch && !englishMatch && !koreanMatch) {
      result.special.push(symbolMatch[1]);
    }
  }

  return result;
}

/**
 * Creates a character mapping from keyboard keys supporting bilingual input
 * @param {Object} keyboardKeys - Processed keyboard key data
 * @param {boolean} verbose - Whether to log detailed parsing information
 * @returns {Object} Character map { char: keyData }
 */
function createBilingualCharacterMap(keyboardKeys, verbose = true) {
  const charMap = {};
  
  if (verbose) {
    console.log('\n[BILINGUAL-PARSER] ===== PARSING KEYBOARD LABELS =====');
  }
  
  Object.entries(keyboardKeys).forEach(([keyLabel, keyData]) => {
    const label = keyData.label || '';
    const parsed = parseBilingualKeyLabel(label);
    
    // Log parsing result
    if (verbose) {
      const allChars = [
        ...parsed.english.map(c => `en:${c}`),
        ...parsed.korean.map(c => `ko:${c}`),
        ...parsed.special.map(c => `sp:${c}`)
      ];
      
      if (allChars.length > 0) {
        console.log(`[BILINGUAL-PARSER] "${label}" -> [${allChars.join(', ')}]`);
      } else {
        console.log(`[BILINGUAL-PARSER] "${label}" -> [no characters extracted]`);
      }
    }
    
    // Map all English characters
    parsed.english.forEach(char => {
      if (!charMap[char]) {
        charMap[char] = keyData;
      } else if (verbose) {
        console.warn(`[BILINGUAL-PARSER] Duplicate mapping for '${char}', keeping first occurrence`);
      }
    });
    
    // Map all Korean characters
    parsed.korean.forEach(char => {
      if (!charMap[char]) {
        charMap[char] = keyData;
      } else if (verbose) {
        console.warn(`[BILINGUAL-PARSER] Duplicate mapping for '${char}', keeping first occurrence`);
      }
    });
    
    // Map all special characters
    parsed.special.forEach(char => {
      if (!charMap[char]) {
        charMap[char] = keyData;
      } else if (verbose) {
        console.warn(`[BILINGUAL-PARSER] Duplicate mapping for '${char}', keeping first occurrence`);
      }
    });
  });
  
  if (verbose) {
    console.log('\n[BILINGUAL-PARSER] ===== CHARACTER MAP SUMMARY =====');
    console.log('[BILINGUAL-PARSER] Total mapped characters:', Object.keys(charMap).length);
    console.log('[BILINGUAL-PARSER] Available characters:', Object.keys(charMap).sort().join(', '));
  }
  
  return charMap;
}

/**
 * Builds a JSON structure representing the keyboard layout with bilingual support
 * @param {Object} keyboardKeys - Processed keyboard key data
 * @returns {Object} JSON structure with complete keyboard mapping
 */
function buildBilingualKeyboardJSON(keyboardKeys) {
  const result = {
    metadata: {
      totalKeys: Object.keys(keyboardKeys).length,
      timestamp: new Date().toISOString(),
      languages: ['en', 'ko']
    },
    keys: [],
    characterMap: {}
  };

  // Process each key
  Object.entries(keyboardKeys).forEach(([keyLabel, keyData]) => {
    const label = keyData.label || '';
    const parsed = parseBilingualKeyLabel(label);
    
    // Build key entry
    const keyEntry = {
      id: keyLabel,
      label: label,
      position: keyData.position,
      bounds: keyData.bounds,
      normalized: keyData.normalized,
      characters: {
        english: parsed.english,
        korean: parsed.korean,
        special: parsed.special
      }
    };
    
    result.keys.push(keyEntry);
    
    // Add to character map (all languages)
    [...parsed.english, ...parsed.korean, ...parsed.special].forEach(char => {
      if (!result.characterMap[char]) {
        result.characterMap[char] = {
          character: char,
          keyId: keyLabel,
          label: label,
          position: keyData.position,
          type: parsed.english.includes(char) ? 'english' : 
                parsed.korean.includes(char) ? 'korean' : 'special'
        };
      }
    });
  });

  // Add statistics
  result.metadata.englishKeys = Object.values(result.characterMap).filter(k => k.type === 'english').length;
  result.metadata.koreanKeys = Object.values(result.characterMap).filter(k => k.type === 'korean').length;
  result.metadata.specialKeys = Object.values(result.characterMap).filter(k => k.type === 'special').length;

  return result;
}

/**
 * Exports the keyboard JSON to a file
 * @param {Object} keyboardKeys - Processed keyboard key data
 * @param {string} outputPath - Path to save JSON file
 * @returns {string} Path to saved JSON file
 */
function exportKeyboardJSON(keyboardKeys, outputPath) {
  const fs = require('fs');
  const json = buildBilingualKeyboardJSON(keyboardKeys);
  fs.writeFileSync(outputPath, JSON.stringify(json, null, 2), 'utf8');
  console.log(`[BILINGUAL-PARSER] Keyboard JSON exported to: ${outputPath}`);
  return outputPath;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  parseBilingualKeyLabel,
  createBilingualCharacterMap,
  buildBilingualKeyboardJSON,
  exportKeyboardJSON
};

