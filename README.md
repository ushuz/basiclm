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

1. Install the extension in VS Code
2. Ensure you have GitHub Copilot enabled and working
3. Start the server using Command Palette: "BasicLM: Start BasicLM Server"

## Configuration

- `basiclmapi.port`: Server port (default: 8099)
- `basiclmapi.host`: Server host (default: 127.0.0.1) 
- `basiclmapi.autoStart`: Auto-start server when VS Code starts
- `basiclmapi.enableLogging`: Enable detailed logging

## API Endpoints

### OpenAI Chat Completions
```
POST http://127.0.0.1:8099/v1/chat/completions
```

Compatible with OpenAI's chat completions API format.

### Anthropic Messages
```  
POST http://127.0.0.1:8099/v1/messages
```

Compatible with Anthropic's messages API format.

### Models List
```
GET http://127.0.0.1:8099/v1/models
```

### Health Check
```
GET http://127.0.0.1:8099/health
```

## Example Usage

### OpenAI Format
```bash
curl -X POST http://127.0.0.1:8099/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
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
    "model": "claude-3-sonnet-20240229",
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

## License

MIT