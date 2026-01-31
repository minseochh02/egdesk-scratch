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

void setup() {
  Serial.begin(9600);
  Keyboard.begin();
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

      unsigned long startTime = millis();

      for (unsigned int i = 0; i < input.length(); i++) {
        Keyboard.press(input[i]);
        delay(247);
        Keyboard.release(input[i]);
        delay(356);

        Serial.print("  char ");
        Serial.print(i + 1);
        Serial.print("/");
        Serial.print(input.length());
        Serial.print(" at ");
        Serial.print(millis() - startTime);
        Serial.println("ms");
      }

      Serial.print("DONE in ");
      Serial.print(millis() - startTime);
      Serial.println("ms");
    }
  }
}
