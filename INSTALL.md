# Installation Instructions

## Install as VS Code Extension

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

## Using the Extension

1. **Start the server:**
   - Open Command Palette (Ctrl+Shift+P)
   - Run "BasicLM: Start BasicLM Server"
   - Check status bar for server status

2. **Test the endpoints:**
   ```bash
   npm run test-api
   ```

3. **Manual API calls:**

   **OpenAI Format:**
   ```bash
   curl -X POST http://127.0.0.1:8099/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-4",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```

   **Anthropic Format:**
   ```bash
   curl -X POST http://127.0.0.1:8099/v1/messages \
     -H "Content-Type: application/json" \
     -d '{
       "model": "claude-3-sonnet-20240229", 
       "max_tokens": 100,
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```

## Configuration

Access via VS Code Settings (Ctrl+,) or settings.json:

```json
{
  "basiclmapi.port": 8099,
  "basiclmapi.host": "127.0.0.1",
  "basiclmapi.autoStart": false,
  "basiclmapi.enableLogging": true
}
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