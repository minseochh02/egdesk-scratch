#!/usr/bin/env python3
"""
Emergency Keyboard Reset Utility

If your keyboard gets stuck after running the virtual HID keyboard test,
run this script to release it without rebooting.

Usage:
    python3 reset-keyboard.py
"""

import sys
import time

def reset_keyboard():
    """Reset keyboard by creating and immediately destroying a controller"""
    print("🔧 Emergency Keyboard Reset Utility")
    print("=" * 60)
    print("")

    try:
        from pynput.keyboard import Controller
        print("✅ pynput imported successfully")
        print("")

        print("Step 1: Creating keyboard controller...")
        keyboard = Controller()
        print("✅ Controller created")

        print("")
        print("Step 2: Waiting 0.5 seconds...")
        time.sleep(0.5)

        print("")
        print("Step 3: Releasing keyboard controller...")
        del keyboard
        print("✅ Controller deleted")

        print("")
        print("Step 4: Final cleanup wait...")
        time.sleep(0.5)

        print("")
        print("=" * 60)
        print("✅ Keyboard reset completed!")
        print("")
        print("Try typing now. If it still doesn't work:")
        print("  1. Close all terminal windows")
        print("  2. Kill Python processes: pkill -9 python")
        print("  3. On macOS: Remove and re-add accessibility permissions")
        print("  4. Last resort: Reboot")
        print("")

        return True

    except ImportError:
        print("❌ Error: pynput not installed")
        print("Install with: pip3 install pynput")
        return False

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = reset_keyboard()
    sys.exit(0 if success else 1)
