# BasicLM VS Code Extension

BasicLM is a VS Code extension that bridges the VS Code Language Model API to OpenAI and Anthropic compatible HTTP endpoints. It enables applications to use GitHub Copilot's language models through familiar API formats.

**ALWAYS FOLLOW THESE INSTRUCTIONS FIRST.** Only use additional search or bash commands when you encounter unexpected information that doesn't match what is documented here.

## Working Effectively

### Prerequisites and Setup
- **REQUIRED**: VS Code 1.92.0 or higher
- **REQUIRED**: Active GitHub Copilot subscription 
- **REQUIRED**: GitHub Copilot extension installed and working in VS Code
- **REQUIRED**: Node.js (any modern version - extension uses VS Code's built-in Node.js)

### Initial Setup Commands
Run these commands EXACTLY in order after cloning the repository:

```bash
npm install              # Takes ~40 seconds. NEVER CANCEL. Set timeout to 120+ seconds.
npm run compile         # Takes ~2 seconds. Quick TypeScript compilation.
npm run lint           # Takes ~2 seconds. ESLint validation.
```

### Build and Development Commands

**Core Development Workflow:**
```bash
npm run compile        # TypeScript compilation (~2 seconds)
npm run watch          # Start TypeScript watch mode (runs until stopped)
npm run lint           # ESLint validation (~2 seconds)
npm run package        # Create VSIX package (~4 seconds)
```

**Combined Build and Validation:**
```bash
npm run pretest        # Runs compile + lint (~4 seconds total)
```

**CRITICAL TIMING NOTES:**
- **npm install**: 40 seconds - NEVER CANCEL. Set timeout to 120+ seconds minimum.
- **npm run compile**: 2 seconds - Fast compilation
- **npm run lint**: 2 seconds - Quick linting
- **npm run package**: 4 seconds - VSIX creation (includes compilation)
- **npm run pretest**: 4 seconds - Combined compile + lint

### Testing and Validation

**API Testing:**
```bash
npm run test-api       # Tests API endpoints (~0.2 seconds when server not running)
```

**IMPORTANT**: The `npm test` command is configured but incomplete (missing test files). Use `npm run test-api` instead for testing functionality.

**Manual Validation Steps:**
1. **Always build first**: `npm run pretest`
2. **Package the extension**: `npm run package`
3. **Test API endpoints**: `npm run test-api` (will fail if server not running - this is expected)

**Complete End-to-End Validation Scenario:**
Since this is a VS Code extension, full validation requires VS Code:

1. Build and package: `npm run pretest && npm run package`
2. Install the `.vsix` file in VS Code via Extensions → Install from VSIX
3. Open Command Palette (Ctrl+Shift+P) and run "BasicLM: Start BasicLM Server"
4. Test endpoints: `npm run test-api` (should now succeed)
5. Verify in VS Code status bar that server is running
6. Test API calls manually:
   ```bash
   curl -X POST http://127.0.0.1:8099/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}]}'
   ```

### Development Workflow in VS Code

**Using the Extension Development Host:**
1. Open this project in VS Code
2. Press F5 or go to Run & Debug → "Run Extension"
3. This opens a new VS Code window with the extension loaded
4. In the new window, use Ctrl+Shift+P → "BasicLM: Start BasicLM Server"
5. Test with `npm run test-api` in the terminal

**File Change Detection:**
- Use `npm run watch` during development for automatic TypeScript recompilation
- The extension auto-reloads when you reload the Extension Development Host window

## Code Structure and Navigation

### Key Files and Directories
- **`src/extension.ts`** - Main extension entry point, VS Code commands, status bar
- **`src/server/LMAPIServer.ts`** - HTTP server implementation 
- **`src/server/RequestHandler.ts`** - API endpoint handlers (OpenAI/Anthropic compatibility)
- **`src/types/index.ts`** - TypeScript type definitions for APIs
- **`src/constants/index.ts`** - Configuration constants, HTTP status codes
- **`src/utils/Logger.ts`** - Logging utilities with VS Code output channel
- **`test/api-test.js`** - API endpoint integration tests
- **`package.json`** - Extension manifest and dependencies
- **`.vscode/launch.json`** - VS Code debugging configuration

### Configuration Options
Set these in VS Code Settings (Ctrl+,) or settings.json:
```json
{
  "basiclmapi.port": 8099,           // HTTP server port
  "basiclmapi.host": "127.0.0.1",   // Server host
  "basiclmapi.autoStart": false,     // Auto-start server
  "basiclmapi.enableLogging": true   // Enable debug logging
}
```

### Common Development Tasks

**When modifying server code (`src/server/`):**
1. Run `npm run compile` to rebuild
2. Restart the extension or server in VS Code
3. Test with `npm run test-api`

**When adding new API endpoints:**
1. Update `src/server/RequestHandler.ts` 
2. Add constants to `src/constants/index.ts`
3. Update types in `src/types/index.ts`
4. Always run `npm run lint` before committing

**When debugging issues:**
1. Check VS Code Output panel → "BasicLM" for logs
2. Verify GitHub Copilot is working: try Copilot suggestions in VS Code
3. Check server status in VS Code status bar
4. Test health endpoint: `curl http://127.0.0.1:8099/health`

### Build Validation Before Committing
ALWAYS run these commands before committing changes:
```bash
npm run pretest        # Compile + lint (~4 seconds)
npm run package        # Verify packaging works (~4 seconds)
npm run test-api       # Basic API structure test (~0.2 seconds)
npx tsc --noEmit       # TypeScript error checking (~2 seconds)
```

## API Endpoints Reference

The extension provides these endpoints when the server is running:

- **GET** `http://127.0.0.1:8099/health` - Health check
- **GET** `http://127.0.0.1:8099/v1/models` - List available models  
- **POST** `http://127.0.0.1:8099/v1/chat/completions` - OpenAI-compatible chat
- **POST** `http://127.0.0.1:8099/v1/messages` - Anthropic-compatible messages

## Common Issues and Solutions

**"BasicLM is not running" / Connection refused:**
- Ensure GitHub Copilot is working in VS Code first
- Start server: Ctrl+Shift+P → "BasicLM: Start BasicLM Server"
- Check port 8099 is not in use by another application

**"No language models available":**
- Verify GitHub Copilot subscription is active
- Try restarting VS Code completely
- Check Copilot status in VS Code status bar

**Build fails:**
- Run `npm install` again if dependencies are corrupted  
- Clean build: `rm -rf out/ && npm run compile`
- Check TypeScript errors: `npx tsc --noEmit`
- Clean all: `rm -rf node_modules package-lock.json out/ && npm install`

**VSIX packaging fails:**
- Ensure all files compile successfully first: `npm run pretest`
- Check that `out/` directory exists and contains compiled JavaScript

## Repository Information

- **Language**: TypeScript (compiles to JavaScript)
- **Runtime**: VS Code extension host (Node.js)
- **Package Manager**: npm
- **Build Tool**: TypeScript Compiler (tsc)
- **Linter**: ESLint with TypeScript support
- **Testing**: Integration tests via `test/api-test.js`
- **Distribution**: VSIX package for VS Code installation