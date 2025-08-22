# BasicLM

A VS Code extension that bridges the VS Code Language Model API to OpenAI and Anthropic compatible HTTP endpoints.

## Features

- **OpenAI Compatibility**: Provides `/v1/chat/completions` endpoint compatible with OpenAI's API
- **Anthropic Compatibility**: Provides `/v1/messages` endpoint compatible with Anthropic's API  
- **VS Code Integration**: Uses VS Code's built-in Language Model API (requires active GitHub Copilot subscription)
- **Streaming Support**: Both streaming and non-streaming responses for both endpoints
- **Multi-modal Support**: Basic support for text and image content (text extraction)
- **Local Server**: Runs locally for privacy and security

## Installation

### Install as VS Code Extension

1. **Package the extension:**
   ```bash
   npm run package
   ```
   This creates a `.vsix` file.

2. **Install in VS Code:**
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Click the "..." menu → "Install from VSIX..."
   - Select the generated `.vsix` file

3. **Prerequisites:**
   - Ensure GitHub Copilot extension is installed and active
   - Have a valid GitHub Copilot subscription
   - VS Code 1.92.0 or higher

### Using the Extension

1. **Start the server:**
   - Open Command Palette (Ctrl+Shift+P)
   - Run "BasicLM: Start BasicLM Server"
   - Check status bar for server status

2. **Test the endpoints:**
   ```bash
   npm run test-api
   ```

## Configuration

- `basiclm.port`: Server port (default: 8099)
- `basiclm.host`: Server host (default: 127.0.0.1)
- `basiclm.autoStart`: Auto-start server when VS Code starts
- `basiclm.enableLogging`: Enable detailed logging

## API Endpoints

```
POST /v1/chat/completions
```
```
POST /v1/messages
```
```
GET /v1/models
```
```
GET /health
```

## Example Usage

### OpenAI Format
```bash
curl -X POST http://127.0.0.1:8099/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Anthropic Format
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

## Requirements

- VS Code 1.92.0 or higher
- Active GitHub Copilot subscription
- Access to VS Code Language Model API

## Development

```bash
npm install
npm run compile
npm run lint
```

## Troubleshooting

1. **Server won't start:**
   - Check if GitHub Copilot is working in VS Code
   - Verify port 8099 is not in use
   - Check Output panel "BasicLM" for logs

2. **No models available:**
   - Ensure GitHub Copilot subscription is active
   - Try restarting VS Code
   - Check Copilot status in VS Code

3. **API calls fail:**
   - Verify server is running (check status bar)
   - Check endpoint URLs are correct
   - Review logs in Output panel

## License

MIT
