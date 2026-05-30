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

### 1. Flash the Sketch

You can flash via **Arduino CLI** (recommended) or the **Arduino IDE**.

#### Option A: Arduino CLI (recommended)

Install:

```bash
# macOS
brew install arduino-cli

# Or download from https://github.com/arduino/arduino-cli/releases
```

One-time setup (install board core and libraries):

```bash
arduino-cli config init
arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli lib install Keyboard Mouse
```

Find your board and serial port (run this before every upload):

```bash
arduino-cli board list
```

Example output on Mac:

```
Port                   Board Name       FQBN
/dev/cu.usbmodemHIDFG1 Arduino Leonardo arduino:avr:leonardo
```

Compile and upload from this folder:

```bash
cd src/main/desktop-recorder/arduino-hid-sketch

arduino-cli compile --upload \
  -p /dev/cu.usbmodemHIDFG1 \
  --fqbn arduino:avr:leonardo .
```

Replace `/dev/cu.usbmodemHIDFG1` with the port from `board list`. On Windows use e.g. `COM3`.

**Leonardo port names change on reset.** After upload or unplug/replug, the suffix changes (e.g. `HIDPC1` → `HIDFG1`). Always run `arduino-cli board list` and use the current port.

Verify the sketch is running:

```bash
arduino-cli monitor -p /dev/cu.usbmodemHIDFG1 -c baudrate=9600
```

You should see `READY` on boot. Press Ctrl+C to exit the monitor.

For **SparkFun Pro Micro**, install the SparkFun core and use its FQBN:

```bash
arduino-cli core install SparkFun:avr
arduino-cli compile --upload -p <PORT> --fqbn SparkFun:avr:pro-micro .
```

#### Option B: Arduino IDE

1. Download from: https://www.arduino.cc/en/software
2. Open `arduino-hid-sketch.ino`
3. **Tools** → **Board** → **Arduino Leonardo** (or **SparkFun Pro Micro**)
4. **Tools** → **Port** → select your Arduino's port
5. Click **Upload** and wait for "Done uploading"

### 2. Find COM Port

After flashing, find the serial port for EGDesk configuration:

**Windows:**
- Device Manager → **Ports (COM & LPT)** → e.g. `Arduino Leonardo (COM3)`

**Mac:**
```bash
arduino-cli board list
# or
ls /dev/cu.usb*
```

Look for `/dev/cu.usbmodem*` (the suffix changes after each reset).

### 3. Install SerialPort Dependency

```bash
npm install serialport
```

### 4. Configure Desktop Recorder

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

**`Platform 'arduino:avr' not found`**
```bash
arduino-cli core install arduino:avr
```

**`Keyboard.h: No such file or directory`**
```bash
arduino-cli lib install Keyboard Mouse
```

**`cannot open port ... No such file or directory`**
- The Leonardo port name changed — run `arduino-cli board list` and use the current port
- Unplug/replug USB, then check again
- Close Serial Monitor, `arduino-cli monitor`, or any app using the port

**Other upload issues**
- Double-press the reset button to enter bootloader mode, then upload immediately
- Try **SparkFun Pro Micro** FQBN if Leonardo does not work
- Split compile and upload if combined upload fails:
  ```bash
  arduino-cli compile --fqbn arduino:avr:leonardo .
  arduino-cli upload -p <PORT> --fqbn arduino:avr:leonardo .
  ```

### Serial Connection Error
- Close Arduino IDE Serial Monitor, `arduino-cli monitor`, or EGDesk before uploading
- Only one program can access the serial port at a time
- Re-check the port with `arduino-cli board list` — it may have changed since last use

### Keys Not Working
- Verify sketch uploaded successfully (LED should blink)
- Monitor serial output at 9600 baud:
  ```bash
  arduino-cli monitor -p <PORT> -c baudrate=9600
  ```
- Check that Arduino sends `READY` after connecting

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

- [Arduino CLI](https://arduino.github.io/arduino-cli/latest/)
- [Arduino Keyboard Library](https://www.arduino.cc/reference/en/language/functions/usb/keyboard/)
- [ATmega32U4 Datasheet](https://www.microchip.com/wwwproducts/en/ATmega32U4)
- [Windows UAC Architecture](https://docs.microsoft.com/en-us/windows/security/identity-protection/user-account-control/how-user-account-control-works)
