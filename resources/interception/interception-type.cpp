// ============================================================================
// INTERCEPTION KEYBOARD TYPER
// ============================================================================
// Simple helper program that types text using Interception driver
// Compile on Windows: cl interception-type.cpp interception.lib
// Usage: interception-type.exe "text to type"

#include <windows.h>
#include <stdio.h>
#include "interception.h"

// Scan code map (US keyboard layout)
// Map ASCII characters to keyboard scan codes
unsigned short char_to_scancode(char c, bool &need_shift) {
    need_shift = false;

    // Lowercase letters (a-z)
    if (c >= 'a' && c <= 'z') {
        return 0x1E + (c - 'a'); // A=0x1E, B=0x30, etc.
    }

    // Uppercase letters (A-Z)
    if (c >= 'A' && c <= 'Z') {
        need_shift = true;
        return 0x1E + (c - 'A');
    }

    // Numbers (0-9)
    if (c >= '0' && c <= '9') {
        if (c == '0') return 0x0B;
        return 0x02 + (c - '1'); // 1=0x02, 2=0x03, etc.
    }

    // Special characters
    switch (c) {
        case ' ': return 0x39; // Space
        case '\n': return 0x1C; // Enter
        case '\t': return 0x0F; // Tab
        case '-': return 0x0C; // Minus
        case '=': return 0x0D; // Equals
        case '[': return 0x1A; // Left bracket
        case ']': return 0x1B; // Right bracket
        case '\\': return 0x2B; // Backslash
        case ';': return 0x27; // Semicolon
        case '\'': return 0x28; // Quote
        case '`': return 0x29; // Backtick
        case ',': return 0x33; // Comma
        case '.': return 0x34; // Period
        case '/': return 0x35; // Slash

        // Shifted characters
        case '!': need_shift = true; return 0x02; // 1
        case '@': need_shift = true; return 0x03; // 2
        case '#': need_shift = true; return 0x04; // 3
        case '$': need_shift = true; return 0x05; // 4
        case '%': need_shift = true; return 0x06; // 5
        case '^': need_shift = true; return 0x07; // 6
        case '&': need_shift = true; return 0x08; // 7
        case '*': need_shift = true; return 0x09; // 8
        case '(': need_shift = true; return 0x0A; // 9
        case ')': need_shift = true; return 0x0B; // 0
        case '_': need_shift = true; return 0x0C; // Minus
        case '+': need_shift = true; return 0x0D; // Equals
        case '{': need_shift = true; return 0x1A; // [
        case '}': need_shift = true; return 0x1B; // ]
        case '|': need_shift = true; return 0x2B; // Backslash
        case ':': need_shift = true; return 0x27; // Semicolon
        case '"': need_shift = true; return 0x28; // Quote
        case '~': need_shift = true; return 0x29; // Backtick
        case '<': need_shift = true; return 0x33; // Comma
        case '>': need_shift = true; return 0x34; // Period
        case '?': need_shift = true; return 0x35; // Slash

        default: return 0x00; // Unknown
    }
}

void send_key(InterceptionContext context, InterceptionDevice keyboard, unsigned short scancode, bool down) {
    InterceptionKeyStroke stroke;
    stroke.code = scancode;
    stroke.state = down ? INTERCEPTION_KEY_DOWN : INTERCEPTION_KEY_UP;
    stroke.information = 0;

    interception_send(context, keyboard, (InterceptionStroke*)&stroke, 1);
}

void type_text(InterceptionContext context, InterceptionDevice keyboard, const char* text, int delay_ms) {
    int len = strlen(text);

    for (int i = 0; i < len; i++) {
        bool need_shift = false;
        unsigned short scancode = char_to_scancode(text[i], need_shift);

        if (scancode == 0x00) {
            printf("Warning: Unknown character '%c' (0x%02X)\n", text[i], (unsigned char)text[i]);
            continue;
        }

        // Press shift if needed
        if (need_shift) {
            send_key(context, keyboard, 0x2A, true); // Left shift down
            Sleep(10);
        }

        // Press key
        send_key(context, keyboard, scancode, true);
        Sleep(10);

        // Release key
        send_key(context, keyboard, scancode, false);

        // Release shift if needed
        if (need_shift) {
            Sleep(10);
            send_key(context, keyboard, 0x2A, false); // Left shift up
        }

        // Delay between characters
        Sleep(delay_ms);

        printf("Typed: %c\n", text[i]);
    }
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("Usage: interception-type.exe \"text to type\" [delay_ms]\n");
        printf("Example: interception-type.exe \"password123\" 100\n");
        return 1;
    }

    const char* text = argv[1];
    int delay_ms = (argc >= 3) ? atoi(argv[2]) : 100;

    printf("Interception Keyboard Typer\n");
    printf("============================\n");
    printf("Text: %s\n", text);
    printf("Delay: %dms per character\n\n", delay_ms);

    // Create Interception context
    InterceptionContext context = interception_create_context();

    if (!context) {
        fprintf(stderr, "ERROR: Failed to create Interception context.\n");
        fprintf(stderr, "Is the Interception driver installed?\n");
        fprintf(stderr, "Run: install-interception.exe /install\n");
        return 1;
    }

    printf("Interception context created successfully\n");

    // Wait for any keyboard device (we need at least one keystroke to detect keyboard device)
    printf("Press any key on your keyboard...\n");
    interception_set_filter(context, interception_is_keyboard, INTERCEPTION_FILTER_KEY_DOWN);

    InterceptionDevice keyboard = interception_wait(context);

    if (interception_is_invalid(keyboard)) {
        fprintf(stderr, "ERROR: No keyboard device detected\n");
        interception_destroy_context(context);
        return 1;
    }

    printf("Keyboard device detected: %d\n", keyboard);

    // Clear the filter so we can send freely
    interception_set_filter(context, interception_is_keyboard, INTERCEPTION_FILTER_KEY_NONE);

    // Wait a moment before typing
    Sleep(500);

    printf("\nStarting to type in 2 seconds...\n");
    Sleep(2000);

    // Type the text
    type_text(context, keyboard, text, delay_ms);

    printf("\nDone! Typed %d characters\n", strlen(text));

    // Cleanup
    interception_destroy_context(context);

    return 0;
}
