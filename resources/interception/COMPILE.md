# Compiling interception-type.exe on Windows

This helper program uses the Interception driver to type text with virtual HID keyboard events.

## Prerequisites (On Windows)

1. **Visual Studio** (Community Edition is free)
   - Download from: https://visualstudio.microsoft.com/downloads/
   - Install "Desktop development with C++" workload

OR

2. **Visual Studio Build Tools** (lighter weight)
   - Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

## Compilation Steps

### Method 1: Using Visual Studio Developer Command Prompt

1. Open **"Developer Command Prompt for VS 2022"** (or your VS version)

2. Navigate to this directory:
   ```cmd
   cd path\to\egdesk-scratch\resources\interception
   ```

3. Compile:
   ```cmd
   cl /O2 /EHsc interception-type.cpp library\x64\interception.lib /link /OUT:interception-type.exe
   ```

4. Verify:
   ```cmd
   dir interception-type.exe
   ```

### Method 2: Using CMake (Cross-platform)

1. Create `CMakeLists.txt`:
   ```cmake
   cmake_minimum_required(VERSION 3.10)
   project(InterceptionType)

   add_executable(interception-type interception-type.cpp)
   target_link_libraries(interception-type ${CMAKE_CURRENT_SOURCE_DIR}/library/x64/interception.lib)
   ```

2. Build:
   ```cmd
   mkdir build
   cd build
   cmake ..
   cmake --build . --config Release
   ```

## Testing

After compiling:

```cmd
REM Install Interception driver first (requires admin)
install-interception.exe /install

REM Restart computer

REM Test the typing program
interception-type.exe "hello world" 100
```

**Important:** The program will ask you to press any key first - this is required so Interception can detect your keyboard device.

## Bundling with App

Once compiled, copy `interception-type.exe` to `resources/interception/` and it will be bundled with your Electron app.

The Node.js code will call it like this:
```javascript
exec('interception-type.exe "password123" 100');
```

## Troubleshooting

**"Failed to create Interception context"**
- Driver not installed
- Run `install-interception.exe /install` as admin
- Restart computer

**"No keyboard device detected"**
- Press a key when prompted
- Ensure you have a keyboard connected

**Compile errors**
- Ensure Visual Studio installed
- Use Developer Command Prompt
- Check path to interception.lib
