/**
 * Arduino HID Keyboard Sketch
 *
 * Flash this onto an Arduino Leonardo or Pro Micro (ATmega32U4).
 * It listens on serial and types whatever it receives as a real USB keyboard.
 *
 * Board: Arduino Leonardo (or SparkFun Pro Micro)
 * Port:  Check Device Manager for COM port
 */

#include <Keyboard.h>

// Randomized delay: returns base +/- jitter
long randDelay(long base, long jitter) {
  return base + random(-jitter, jitter + 1);
}

void setup() {
  Serial.begin(9600);
  Keyboard.begin();
  randomSeed(analogRead(0));
  delay(1000);
  Serial.println("READY");
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.length() > 0) {
      Serial.print("TYPING ");
      Serial.print(input.length());
      Serial.println(" chars");

      // Random initial pause before typing (50-300ms)
      delay(random(50, 301));

      unsigned long startTime = millis();

      for (unsigned int i = 0; i < input.length(); i++) {
        // Hold duration: 147-347ms (247 +/- 100)
        long holdTime = randDelay(247, 100);
        // Gap between keys: 156-556ms (356 +/- 200)
        long gapTime = randDelay(356, 200);

        Keyboard.press(input[i]);
        delay(holdTime);
        Keyboard.release(input[i]);
        delay(gapTime);

        Serial.print("  char ");
        Serial.print(i + 1);
        Serial.print("/");
        Serial.print(input.length());
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
  }
}
