#!/usr/bin/env python3
"""
Virtual HID Keyboard Driver (Python) - SAFE VERSION

This script creates OS-level keyboard events that go through the kernel input stack.
This makes the input indistinguishable from a real USB keyboard at the OS level.

IMPORTANT: This version includes proper cleanup to prevent keyboard from getting stuck.

Requirements:
    pip3 install pynput

Usage:
    python3 virtual-hid-keyboard.py "password_to_type" --delay 100
"""

import sys
import time
import argparse
import signal
import atexit
from pynput.keyboard import Controller, Key

# Global keyboard controller for cleanup
_keyboard_controller = None

def cleanup_keyboard():
    """Ensure keyboard is released on exit"""
    global _keyboard_controller
    if _keyboard_controller is not None:
        try:
            # Small delay to ensure all events are processed
            time.sleep(0.1)
            # Explicitly delete the controller
            del _keyboard_controller
            _keyboard_controller = None
            print("[Virtual-HID] Keyboard cleanup completed", file=sys.stderr)
        except Exception as e:
            print(f"[Virtual-HID] Cleanup warning: {e}", file=sys.stderr)

def signal_handler(signum, frame):
    """Handle interrupts gracefully"""
    print(f"[Virtual-HID] Received signal {signum}, cleaning up...", file=sys.stderr)
    cleanup_keyboard()
    sys.exit(1)

def type_text_with_delay(text, char_delay_ms=100, pre_delay_ms=500):
    """
    Type text using OS-level keyboard events.

    Args:
        text: Text to type
        char_delay_ms: Delay between characters in milliseconds
        pre_delay_ms: Initial delay before starting to type
    """
    global _keyboard_controller

    keyboard = None

    try:
        # Create keyboard controller
        keyboard = Controller()
        _keyboard_controller = keyboard

        # Convert delays to seconds
        char_delay = char_delay_ms / 1000.0
        pre_delay = pre_delay_ms / 1000.0

        print(f"[Virtual-HID] Preparing to type {len(text)} characters", file=sys.stderr)
        print(f"[Virtual-HID] Pre-delay: {pre_delay_ms}ms, Char delay: {char_delay_ms}ms", file=sys.stderr)

        # Initial delay to ensure focus is correct
        time.sleep(pre_delay)

        print("[Virtual-HID] Starting to type...", file=sys.stderr)

        # Type each character
        for i, char in enumerate(text):
            try:
                keyboard.type(char)

                # Progress reporting every 10 characters
                if (i + 1) % 10 == 0:
                    print(f"[Virtual-HID] Progress: {i + 1}/{len(text)}", file=sys.stderr)

                # Delay between characters (except after last char)
                if i < len(text) - 1:
                    time.sleep(char_delay)

            except Exception as e:
                print(f"[Virtual-HID] Error typing character '{char}' at position {i}: {e}", file=sys.stderr)
                # Continue with next character

        print(f"[Virtual-HID] Successfully typed {len(text)} characters", file=sys.stderr)

        # Small delay before cleanup to ensure all events are processed
        time.sleep(0.2)

        print("SUCCESS", file=sys.stdout)
        sys.stdout.flush()

    except Exception as e:
        print(f"[Virtual-HID] Error during typing: {e}", file=sys.stderr)
        raise

    finally:
        # Always cleanup, even if there was an error
        if keyboard is not None:
            try:
                time.sleep(0.1)
                del keyboard
                _keyboard_controller = None
                print("[Virtual-HID] Keyboard released", file=sys.stderr)
            except Exception as e:
                print(f"[Virtual-HID] Cleanup error: {e}", file=sys.stderr)

def main():
    # Register cleanup handlers
    atexit.register(cleanup_keyboard)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    parser = argparse.ArgumentParser(description='Type text using virtual HID keyboard')
    parser.add_argument('text', help='Text to type')
    parser.add_argument('--delay', type=int, default=100, help='Delay between characters in ms')
    parser.add_argument('--pre-delay', type=int, default=500, help='Initial delay before typing in ms')

    args = parser.parse_args()

    try:
        type_text_with_delay(args.text, args.delay, args.pre_delay)
    except KeyboardInterrupt:
        print("\n[Virtual-HID] Interrupted by user", file=sys.stderr)
        cleanup_keyboard()
        sys.exit(1)
    except Exception as e:
        print(f"[Virtual-HID] Fatal error: {e}", file=sys.stderr)
        cleanup_keyboard()
        sys.exit(1)

    # Final cleanup
    cleanup_keyboard()

if __name__ == "__main__":
    main()
