# BasicLM

A VS Code extension that bridges the VS Code Language Model API to Anthropic compatible HTTP endpoints.

## Features

- **Anthropic Compatibility**: Provides `/v1/messages` `/v1/models` endpoints compatible with Anthropic API
- **VS Code Integration**: Uses VS Code's built-in Language Model API (requires active GitHub Copilot subscription)
- **Streaming Support**: Both streaming and non-streaming responses
- **Local Server**: Runs locally for privacy and security

## Requirements

- VS Code 1.101.0 or higher
- GitHub Copilot subscription
- GitHub Copilot extension installed and activated

## Installation

### Install as VS Code Extension

1. **Package the extension**
   ```bash
   npm run package
   ```
   This creates a `.vsix` file.

2. **Install in VS Code**
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Click the "..." menu → "Install from VSIX..."
   - Select the generated `.vsix` file

### Using the Extension

**From Command Palette**
   - Open Command Palette (Ctrl+Shift+P)
   - Run "BasicLM: Start Server"
   - Check status bar for server status

**From Status Bar**
   - Click on the "BasicLM" status bar item
   - Select "Start Server" from the dropdown menu
   - Check status bar for server status

## Configuration

- `basiclm.port`: Server port (default: 8099)
- `basiclm.host`: Server host (default: 127.0.0.1)
- `basiclm.autoStart`: Auto-start server when VS Code starts (default: true)
- `basiclm.enableLogging`: Enable detailed logging (default: false)

## API Endpoints

```
POST /v1/messages
```
```
GET /v1/models
```

## Example Usage

```bash
curl -X POST http://127.0.0.1:8099/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4",
    "max_tokens": 100,
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

```bash
# GitHub Copilot doesn't offer Claude Code's default small fast model "claude-3-5-haiku", override to "gpt-4o-mini" instead
$ ANTHROPIC_BASE_URL=http://localhost:8099 ANTHROPIC_SMALL_FAST_MODEL=gpt-4o-mini claude
```

## Development

```bash
# Build/compile TypeScript
npm run compile

# Lint the code
npm run lint

# Package the extension
npm run package

# Test the API endpoints
npm run test-api
npm run test-handler
```

## Troubleshooting

1. **Server won't start**
   - Check if GitHub Copilot is working in VS Code
   - Verify port `8099` is not in use
   - Check Output panel "BasicLM" for logs

2. **No models available**
   - Ensure GitHub Copilot subscription is active
   - Try restarting VS Code
   - Check Copilot status in VS Code

3. **API calls fail**
   - Verify server is running (check status bar)
   - Check endpoint URLs are correct
   - Review logs in Output panel

## License

MIT
