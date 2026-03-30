/**
 * Arduino HID Keyboard + Mouse Sketch for Desktop Recorder
 *
 * Flash this onto an Arduino Leonardo or Pro Micro (ATmega32U4).
 * It listens on serial and performs keyboard AND mouse actions.
 *
 * Board: Arduino Leonardo (or SparkFun Pro Micro)
 * Port:  Check Device Manager for COM port
 *
 * Commands:
 *   TYPE:<text>       - Type text with natural timing
 *   KEY:RIGHT_ARROW   - Press right arrow key (and other special keys)
 *   COMBO:ALT+F4      - Press key combination (supports CTRL, ALT, SHIFT, WIN)
 *   MOUSE_MOVE:x,y    - Move mouse by relative pixels (e.g., MOUSE_MOVE:100,-50)
 *   MOUSE_CLICK:left  - Click mouse button (left/right/middle)
 */

#include <Keyboard.h>
#include <Mouse.h>

// Randomized delay: returns base +/- jitter
long randDelay(long base, long jitter) {
  return base + random(-jitter, jitter + 1);
}

void setup() {
  Serial.begin(9600);
  Keyboard.begin();
  Mouse.begin();
  randomSeed(analogRead(0));
  delay(1000);
  Serial.println("READY");
  Serial.println("Commands: TYPE:<text>, KEY:<key>, COMBO:<keys>, MOUSE_MOVE:<x>,<y>, MOUSE_CLICK:<button>");
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.length() > 0) {
      // Parse command
      if (input.startsWith("TYPE:")) {
        String text = input.substring(5);
        typeText(text);
      } else if (input.startsWith("KEY:")) {
        String key = input.substring(4);
        pressSpecialKey(key);
      } else if (input.startsWith("COMBO:")) {
        String combo = input.substring(6);
        pressKeyCombo(combo);
      } else if (input.startsWith("MOUSE_MOVE:")) {
        String coords = input.substring(11);
        moveMouse(coords);
      } else if (input.startsWith("MOUSE_CLICK:")) {
        String button = input.substring(12);
        clickMouse(button);
      } else {
        // Legacy mode: just type the input
        typeText(input);
      }
    }
  }
}

/**
 * Type text with natural timing
 */
void typeText(String text) {
  Serial.print("TYPING ");
  Serial.print(text.length());
  Serial.println(" chars");

  // Random initial pause before typing (50-300ms)
  delay(random(50, 301));

  unsigned long startTime = millis();

  for (unsigned int i = 0; i < text.length(); i++) {
    // Hold duration: 147-347ms (247 +/- 100)
    long holdTime = randDelay(247, 100);
    // Gap between keys: 156-556ms (356 +/- 200)
    long gapTime = randDelay(356, 200);

    Keyboard.press(text[i]);
    delay(holdTime);
    Keyboard.release(text[i]);
    delay(gapTime);

    Serial.print("  char ");
    Serial.print(i + 1);
    Serial.print("/");
    Serial.print(text.length());
    Serial.print(" hold=");
    Serial.print(holdTime);
    Serial.print("ms gap=");
    Serial.print(gapTime);
    Serial.print("ms at ");
    Serial.print(millis() - startTime);
    Serial.println("ms");
  }

  Serial.print("DONE in ");
  Serial.print(millis() - startTime);
  Serial.println("ms");
}

/**
 * Press a special key (arrow keys, Enter, etc.)
 */
void pressSpecialKey(String keyName) {
  Serial.print("PRESSING KEY: ");
  Serial.println(keyName);

  int keyCode = 0;

  if (keyName == "RIGHT_ARROW") {
    keyCode = KEY_RIGHT_ARROW;
  } else if (keyName == "LEFT_ARROW") {
    keyCode = KEY_LEFT_ARROW;
  } else if (keyName == "UP_ARROW") {
    keyCode = KEY_UP_ARROW;
  } else if (keyName == "DOWN_ARROW") {
    keyCode = KEY_DOWN_ARROW;
  } else if (keyName == "ENTER" || keyName == "RETURN") {
    keyCode = KEY_RETURN;
  } else if (keyName == "TAB") {
    keyCode = KEY_TAB;
  } else if (keyName == "ESC" || keyName == "ESCAPE") {
    keyCode = KEY_ESC;
  } else if (keyName == "BACKSPACE") {
    keyCode = KEY_BACKSPACE;
  } else if (keyName == "DELETE") {
    keyCode = KEY_DELETE;
  } else {
    Serial.println("ERROR: Unknown key");
    return;
  }

  // Press and release with natural timing
  Keyboard.press(keyCode);
  delay(random(50, 150)); // Hold time
  Keyboard.release(keyCode);
  delay(random(50, 150)); // Release time

  Serial.println("KEY DONE");
}

/**
 * Press a key combination (e.g., ALT+F4, CTRL+C)
 */
void pressKeyCombo(String combo) {
  Serial.print("COMBO: ");
  Serial.println(combo);

  combo.toUpperCase();

  // Parse modifiers and main key
  bool hasCtrl = combo.indexOf("CTRL") >= 0;
  bool hasAlt = combo.indexOf("ALT") >= 0;
  bool hasShift = combo.indexOf("SHIFT") >= 0;
  bool hasWin = combo.indexOf("WIN") >= 0;

  // Press modifiers
  if (hasCtrl) Keyboard.press(KEY_LEFT_CTRL);
  if (hasAlt) Keyboard.press(KEY_LEFT_ALT);
  if (hasShift) Keyboard.press(KEY_LEFT_SHIFT);
  if (hasWin) Keyboard.press(KEY_LEFT_GUI);

  delay(50);

  // Find and press main key (after last '+')
  int lastPlus = combo.lastIndexOf('+');
  if (lastPlus >= 0) {
    String mainKey = combo.substring(lastPlus + 1);
    mainKey.trim();

    // Check if it's a special key
    if (mainKey == "F4") {
      Keyboard.press(KEY_F4);
    } else if (mainKey.length() == 1) {
      Keyboard.press(mainKey[0]);
    }
  }

  delay(100);

  // Release all keys
  Keyboard.releaseAll();
  delay(50);

  Serial.println("COMBO DONE");
}

/**
 * Move mouse by relative coordinates
 * Format: "x,y" where x and y are signed integers
 * Example: "100,-50" moves right 100px and up 50px
 */
void moveMouse(String coords) {
  int commaIndex = coords.indexOf(',');
  if (commaIndex == -1) {
    Serial.println("ERROR: Invalid MOUSE_MOVE format");
    return;
  }

  int x = coords.substring(0, commaIndex).toInt();
  int y = coords.substring(commaIndex + 1).toInt();

  Serial.print("MOVING MOUSE: ");
  Serial.print(x);
  Serial.print(",");
  Serial.println(y);

  // Move in small increments for smoother movement
  int steps = max(abs(x), abs(y)) / 5; // Move in ~5px increments
  if (steps < 1) steps = 1;

  float dx = (float)x / steps;
  float dy = (float)y / steps;

  for (int i = 0; i < steps; i++) {
    Mouse.move((int)dx, (int)dy, 0);
    delay(5); // Small delay between movements for natural feel
  }

  // Move any remaining pixels
  int remainderX = x - ((int)dx * steps);
  int remainderY = y - ((int)dy * steps);
  if (remainderX != 0 || remainderY != 0) {
    Mouse.move(remainderX, remainderY, 0);
  }

  delay(50);
  Serial.println("MOUSE MOVED");
}

/**
 * Click mouse button
 * Supported: left, right, middle
 */
void clickMouse(String button) {
  Serial.print("CLICKING: ");
  Serial.println(button);

  button.toLowerCase();

  if (button == "left") {
    Mouse.click(MOUSE_LEFT);
  } else if (button == "right") {
    Mouse.click(MOUSE_RIGHT);
  } else if (button == "middle") {
    Mouse.click(MOUSE_MIDDLE);
  } else {
    Serial.println("ERROR: Unknown mouse button");
    return;
  }

  delay(100);
  Serial.println("CLICK DONE");
}
