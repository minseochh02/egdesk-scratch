# Arduino HID for UAC Prompt Handling

This Arduino sketch enables the Desktop Recorder to handle **UAC (User Account Control)** prompts on Windows by sending physical keyboard input via an Arduino Leonardo or Pro Micro.

## Why Arduino?

When Windows shows a UAC prompt, it switches to a **"Secure Desktop"** - a separate, isolated desktop session that:
- Dims/blurs the normal desktop
- **Blocks all software-based input** (uiohook, SendInput, etc.)
- Prevents automation from clicking "Yes" automatically (security feature)

Since the Arduino acts as a **physical USB keyboard**, it bypasses this restriction and can send keypresses that work on the secure desktop.

## Hardware Requirements

### Compatible Boards
- **Arduino Leonardo** (recommended)
- **SparkFun Pro Micro** (ATmega32U4)
- **Arduino Micro**
- Any Arduino board with **ATmega32U4** chip (native USB HID support)

**Note:** Arduino Uno/Nano **will NOT work** - they use ATmega328P which lacks native USB HID support.

### Where to Buy
- Arduino Leonardo: ~$25 USD
- SparkFun Pro Micro: ~$20 USD
- Amazon, Adafruit, SparkFun, AliExpress

## Setup Instructions

### 1. Install Arduino IDE
Download from: https://www.arduino.cc/en/software

### 2. Flash the Sketch

1. Open `arduino-hid-sketch.ino` in Arduino IDE
2. Select board:
   - **Tools** → **Board** → **Arduino Leonardo** (or **SparkFun Pro Micro**)
3. Select port:
   - **Tools** → **Port** → Select your Arduino's COM port
   - On Windows: Usually `COM3`, `COM4`, etc.
   - On Mac: Usually `/dev/cu.usbmodem*`
4. Click **Upload** (→ button)
5. Wait for "Done uploading" message

### 3. Find COM Port

After flashing, find the COM port:

**Windows:**
- Open Device Manager
- Expand "Ports (COM & LPT)"
- Look for "Arduino Leonardo (COM3)" or similar

**Mac:**
- Open Terminal
- Run: `ls /dev/cu.usb*`
- Look for `/dev/cu.usbmodem12345` or similar

### 4. Install SerialPort Dependency

```bash
npm install serialport
```

### 5. Configure Desktop Recorder

```typescript
import { DesktopRecorder } from './desktop-recorder';

const recorder = new DesktopRecorder();

// Enable UAC detection and set Arduino port
recorder.enableUACDetection('COM3'); // Use your COM port

// Start recording
await recorder.startRecording();
```

## Testing Arduino Connection

You can test the Arduino separately using the test utility:

```typescript
import { ArduinoHIDManager } from './utils/arduino-hid-manager';

const arduino = new ArduinoHIDManager('COM3');
await arduino.connect();

// Test typing
await arduino.typeText('Hello World');

// Test arrow keys
await arduino.pressKey('RIGHT_ARROW');
await arduino.pressKey('ENTER');

// Test UAC navigation
await arduino.acceptUAC(); // Right Arrow + Enter

await arduino.disconnect();
```

## How UAC Handling Works

### During Recording
1. Desktop Recorder monitors active window titles
2. Detects UAC prompt when title contains "User Account Control" or Korean equivalent
3. Records a `uacPrompt` action with `requiresArduino: true` flag
4. Logs warning that clicks cannot be recorded (secure desktop)

### During Replay
1. When `uacPrompt` action is encountered:
   - If Arduino is configured: Connects and sends Right Arrow + Enter
   - If no Arduino: Pauses for 10 seconds for manual handling
2. Arduino sends physical keyboard input that works on secure desktop
3. UAC prompt is accepted automatically

## Supported Commands

The Arduino sketch supports these commands:

### Type Text
```
TYPE:Hello World
```
Types text with natural human-like timing (randomized delays)

### Special Keys
```
KEY:RIGHT_ARROW
KEY:LEFT_ARROW
KEY:UP_ARROW
KEY:DOWN_ARROW
KEY:ENTER
KEY:TAB
KEY:ESC
KEY:BACKSPACE
KEY:DELETE
```

### Key Combinations
```
COMBO:CTRL+C
COMBO:ALT+F4
COMBO:CTRL+SHIFT+ESC
```

## Troubleshooting

### Arduino Not Detected
- Make sure you're using Leonardo/Pro Micro (ATmega32U4)
- Try different USB cable (some cables are charge-only)
- Try different USB port
- Check Device Manager for COM port

### Upload Failed
- Double-press the reset button to enter bootloader mode
- Try selecting "SparkFun Pro Micro" if Leonardo doesn't work
- Check that correct board and port are selected

### Serial Connection Error
- Close Arduino IDE Serial Monitor before running code
- Only one program can access the serial port at a time
- Check that COM port number is correct

### Keys Not Working
- Verify sketch uploaded successfully (LED should blink)
- Open Arduino IDE Serial Monitor (9600 baud) to see debug output
- Check that Arduino is sending "READY" message after connecting

## Security Considerations

- Arduino HID can type **anything** - keep physical access secure
- Only use for legitimate automation (testing, UAC handling)
- Don't store sensitive credentials in code - use environment variables
- The Arduino acts as a physical keyboard - it will work on **any** computer it's plugged into

## Advanced Usage

### Custom Timing
Edit the sketch to adjust typing speed:
```cpp
long holdTime = randDelay(247, 100);  // Adjust these values
long gapTime = randDelay(356, 200);   // for faster/slower typing
```

### Multiple Arduinos
You can use multiple Arduinos on different COM ports for parallel automation.

## References

- [Arduino Keyboard Library](https://www.arduino.cc/reference/en/language/functions/usb/keyboard/)
- [ATmega32U4 Datasheet](https://www.microchip.com/wwwproducts/en/ATmega32U4)
- [Windows UAC Architecture](https://docs.microsoft.com/en-us/windows/security/identity-protection/user-account-control/how-user-account-control-works)
