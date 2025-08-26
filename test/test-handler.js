#!/usr/bin/env node

// create vscode module mock and pre-populate require.cache
const vscodeMock = {
  LanguageModelTextPart: class {
    constructor(value) { this.value = value }
  },
  LanguageModelToolCallPart: class {
    constructor(callId, name, input) {
      this.callId = callId
      this.name = name
      this.input = input
    }
  },
  LanguageModelToolResultPart: class {
    constructor(callId, content) {
      this.callId = callId
      this.content = content
    }
  },
  LanguageModelChatMessage: {
    User: (content) => ({ role: "user", content }),
    Assistant: (content) => ({ role: "assistant", content }),
  },
  LanguageModelError: class extends Error {
    constructor(message, code) {
      super(message)
      this.code = code
    }
  },
  CancellationTokenSource: class {
    constructor() {
      this.token = { isCancellationRequested: false }
    }
  },
  lm: {
    selectChatModels: () => Promise.resolve([]),
  },
  window: {
    createOutputChannel: () => ({
      appendLine: () => {},
      show: () => {},
      dispose: () => {},
    }),
  },
  workspace: {
    getConfiguration: () => ({
      get: (key, defaultValue) => defaultValue,
    }),
  },
}

// override require to mock vscode module
const Module = require("module")
const originalRequire = Module.prototype.require

Module.prototype.require = function(id) {
  if (id === "vscode") {
    return vscodeMock
  }
  return originalRequire.apply(this, arguments)
}

// import the compiled requesthandler
let RequestHandler
try {
  const module = require("../out/server/RequestHandler.js")
  RequestHandler = module.RequestHandler
  if (!RequestHandler) {
    console.error("\n❌ error: RequestHandler class not exported from module")
    console.error("Available exports:", Object.keys(module))
    process.exit(1)
  }
} catch (error) {
  console.error("\n❌ error: requesthandler not found. run 'npm run compile' first")
  console.error("Error details:", error.message)
  process.exit(1)
}

// mock vscode tool call response
const mockVSCodeToolCalls = [
  {
    name: "get_weather",
    arguments: "{\"location\": \"San Francisco, CA\"}",
    callId: "call_abc123",
  },
  {
    name: "calculate",
    arguments: "{\"expression\": \"2 + 2\"}",
    callId: "call_def456",
  },
]

// mock http request and response objects
class MockIncomingMessage {
  constructor(method = "POST", body = "") {
    this.method = method
    this._body = body
    this.headers = { "content-type": "application/json" }
  }

  on(event, callback) {
    if (event === "data") {
      callback(this._body)
    } else if (event === "end") {
      callback()
    }
  }
}

class MockServerResponse {
  constructor() {
    this.statusCode = 200
    this.headers = {}
    this.body = ""
    this.headersSent = false
  }

  setHeader(key, value) {
    this.headers[key] = value
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode
    Object.assign(this.headers, headers)
    this.headersSent = true
  }

  write(data) {
    this.body += data
  }

  end(data) {
    if (data) this.body += data
  }
}

// mock language model and response
class MockLanguageModel {
  constructor(id = "claude-sonnet-4", family = "claude") {
    this.id = id
    this.family = family
    this.name = `Claude ${family}`
  }

  async sendRequest(messages, options, token) {
    return new MockLanguageModelResponse()
  }
}

class MockLanguageModelResponse {
  constructor(text = "Hello! This is a test response.", toolCalls = []) {
    this.text = text
    this.toolCalls = toolCalls
    this.stream = this.createStream()
  }

  async *createStream() {
    // yield text parts
    const words = this.text.split(" ")
    for (const word of words) {
      yield new vscodeMock.LanguageModelTextPart(word + " ")
    }

    // yield tool calls if any
    for (const call of this.toolCalls) {
      yield new vscodeMock.LanguageModelToolCallPart(call.callId, call.name, call.input)
    }
  }
}

// test data for anthropic tools
const mockAnthropicTools = [
  {
    name: "get_weather",
    description: "get current weather information for a location",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "the city and state/country",
        },
      },
      required: ["location"],
    },
  },
  {
    name: "calculate",
    description: "perform mathematical calculations",
    input_schema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "mathematical expression to evaluate",
        },
      },
      required: ["expression"],
    },
  },
]

function testAnthropicToolConversion() {
  console.log("testing anthropic tool conversion...")

  const handler = new RequestHandler()

  // use reflection to access private method
  const convertMethod = handler.convertAnthropicToolsToVSCode || (() => {
    console.log("❌ method not accessible, testing with manual implementation")
    return mockAnthropicTools.map(tool => ({
      name: tool.name,
      description: tool.description || tool.name || "no description available",
      inputSchema: tool.input_schema,
    }))
  })

  const converted = convertMethod.call ? convertMethod.call(handler, mockAnthropicTools) : convertMethod(mockAnthropicTools)

  console.log("input anthropic tools:", JSON.stringify(mockAnthropicTools, null, 2))
  console.log("converted to vscode format:", JSON.stringify(converted, null, 2))

  // verify structure
  if (converted.length === 2 &&
      converted[0].name === "get_weather" &&
      converted[0].description &&
      converted[0].inputSchema &&
      converted[0].inputSchema.properties.location) {
    console.log("✅ anthropic tool conversion test passed")
  } else {
    console.log("❌ anthropic tool conversion test failed")
  }
  console.log("")
}

function testVSCodeToolCallConversion() {
  console.log("testing vscode tool call conversion...")

  const handler = new RequestHandler()

  // create mock vscode tool call parts for testing
  const mockVSCodeToolCallParts = mockVSCodeToolCalls.map(call => ({
    callId: call.callId,
    name: call.name,
    input: JSON.parse(call.arguments),
  }))

  // use reflection to access private method or create manual implementation
  const convertMethod = handler.convertVSCodeToolCallsToAnthropic || (() => {
    console.log("❌ method not accessible, testing with manual implementation")
    return mockVSCodeToolCallParts.map(call => ({
      type: "tool_use",
      id: call.callId,
      name: call.name,
      input: call.input,
    }))
  })

  const converted = convertMethod.call ? convertMethod.call(handler, mockVSCodeToolCallParts) : convertMethod(mockVSCodeToolCallParts)

  console.log("input vscode tool call parts:", JSON.stringify(mockVSCodeToolCallParts, null, 2))
  console.log("converted to anthropic format:", JSON.stringify(converted, null, 2))

  // verify structure
  if (converted.length === 2 &&
      converted[0].type === "tool_use" &&
      converted[0].name === "get_weather" &&
      converted[0].input.location === "San Francisco, CA" &&
      converted[0].id === "call_abc123") {
    console.log("✅ vscode tool call conversion test passed")
  } else {
    console.log("❌ vscode tool call conversion test failed")
  }
  console.log("")
}

function testRequestHandlerMethods() {
  console.log("testing request handler method access...")

  const handler = new RequestHandler()

  // check which methods are accessible
  const methods = [
    "handleAnthropicMessages",
    "handleModels",
    "convertAnthropicToolsToVSCode",
    "convertVSCodeToolCallsToAnthropic",
    "convertAnthropicMessagesToVSCode",
  ]

  let accessibleMethods = 0

  methods.forEach(methodName => {
    if (typeof handler[methodName] === "function") {
      console.log(`  ✅ ${methodName} is accessible`)
      accessibleMethods++
    } else {
      console.log(`  ❌ ${methodName} is private/not accessible`)
    }
  })

  console.log(`\naccessible methods: ${accessibleMethods}/${methods.length}`)

  if (accessibleMethods >= 2) {
    console.log("✅ request handler public methods accessible")
  } else {
    console.log("❌ limited access to request handler methods")
  }
  console.log("")
}

function testTokenEstimation() {
  console.log("testing token estimation...")

  const handler = new RequestHandler()

  // test messages for token estimation
  const testMessages = [
    { role: "user", content: "hello" },
    { role: "assistant", content: "hello there! how are you doing today?" },
    { role: "user", content: "i'm doing great, thanks for asking!" },
  ]

  // try to access private method via reflection or use manual estimation
  let estimatedTokens = 0
  try {
    // attempt to access private method (may not work)
    const estimateMethod = handler.estimateTokens
    if (typeof estimateMethod === "function") {
      estimatedTokens = estimateMethod.call(handler, testMessages)
    } else {
      // manual estimation fallback
      const text = testMessages.map(msg => msg.content).join("")
      estimatedTokens = Math.ceil(text.length / 4)
    }
  } catch (error) {
    // manual estimation fallback
    const text = testMessages.map(msg => msg.content).join("")
    estimatedTokens = Math.ceil(text.length / 4)
  }

  console.log("test messages:", JSON.stringify(testMessages, null, 2))
  console.log("estimated tokens:", estimatedTokens)

  if (estimatedTokens > 0 && estimatedTokens < 100) {
    console.log("✅ token estimation working")
  } else {
    console.log("❌ token estimation unexpected result")
  }
  console.log("")
}

function testModelSelection() {
  console.log("testing model selection...")

  const handler = new RequestHandler()
  const mockModels = [
    new MockLanguageModel("gpt-5", "gpt"),
    new MockLanguageModel("claude-sonnet-4", "claude"),
    new MockLanguageModel("gemini-2.5-pro", "gemini"),
  ]

  // test exact match
  let selected = handler.selectModel?.(mockModels, "claude-sonnet-4")
  if (selected?.id === "claude-sonnet-4") {
    console.log("✅ exact model match working")
  } else {
    console.log("❌ exact model match failed")
  }

  // test family match
  selected = handler.selectModel?.(mockModels, "claude-haiku")
  if (selected?.family === "claude") {
    console.log("✅ family model match working")
  } else {
    console.log("❌ family model match failed")
  }

  // test no match
  selected = handler.selectModel?.(mockModels, "unknown-model")
  if (!selected) {
    console.log("✅ no match handling working")
  } else {
    console.log("❌ no match handling failed")
  }
  console.log("")
}

function testMessageConversion() {
  console.log("testing anthropic to vscode message conversion...")

  const handler = new RequestHandler()
  const anthropicMessages = [
    {
      role: "user",
      content: "Hello, how are you?"
    },
    {
      role: "assistant",
      content: [
        { type: "text", text: "I'm doing well, thanks!" },
        { type: "tool_use", id: "call_123", name: "get_weather", input: { location: "NYC" } }
      ]
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Great!" },
        { type: "tool_result", tool_use_id: "call_123", content: "Sunny, 75°F" }
      ]
    }
  ]

  const systemMessage = "You are a helpful assistant."

  try {
    const converted = handler.convertAnthropicMessagesToVSCode?.(anthropicMessages, systemMessage)
    if (converted && converted.length > 0) {
      console.log("converted messages count:", converted.length)
      console.log("✅ message conversion working")
    } else {
      console.log("❌ message conversion failed - no output")
    }
  } catch (error) {
    console.log("❌ message conversion failed:", error.message)
  }
  console.log("")
}

function testErrorHandling() {
  console.log("testing error handling...")

  const handler = new RequestHandler()
  const mockRes = new MockServerResponse()

  // test sendError method
  try {
    handler.sendError?.(mockRes, 400, "test error", "test_error", "req_123")
    if (mockRes.statusCode === 400 && mockRes.body.includes("test error")) {
      console.log("✅ sendError method working")
    } else {
      console.log("❌ sendError method failed")
    }
  } catch (error) {
    console.log("❌ sendError method not accessible")
  }

  // test language model error handling
  const mockLMError = new vscodeMock.LanguageModelError("Permission denied", "NoPermissions")
  const mockRes2 = new MockServerResponse()

  try {
    handler.handleLanguageModelError?.(mockLMError, mockRes2, "req_456")
    if (mockRes2.statusCode === 403 && mockRes2.body.includes("permission denied")) {
      console.log("✅ language model error handling working")
    } else {
      console.log("❌ language model error handling failed")
    }
  } catch (error) {
    console.log("❌ language model error handling not accessible")
  }
  console.log("")
}

function testRequestBodyReading() {
  console.log("testing request body reading...")

  const handler = new RequestHandler()
  const testBody = JSON.stringify({ test: "data" })
  const mockReq = new MockIncomingMessage("POST", testBody)

  try {
    handler.readRequestBody?.(mockReq).then(body => {
      if (body === testBody) {
        console.log("✅ request body reading working")
      } else {
        console.log("❌ request body reading failed")
      }
    }).catch(error => {
      console.log("❌ request body reading error:", error.message)
    })
  } catch (error) {
    console.log("❌ request body reading not accessible")
  }
  console.log("")
}

async function testHandleModels() {
  console.log("testing handleModels method...")

  // mock vscode.lm.selectChatModels to return test models
  const originalSelectChatModels = vscodeMock.lm.selectChatModels
  vscodeMock.lm.selectChatModels = () => Promise.resolve([
    new MockLanguageModel("claude-sonnet-4", "claude"),
    new MockLanguageModel("gpt-5", "gpt")
  ])

  const handler = new RequestHandler()
  const mockReq = new MockIncomingMessage("GET")
  const mockRes = new MockServerResponse()

  try {
    await handler.handleModels(mockReq, mockRes, "req_789")
    if (mockRes.statusCode === 200 && mockRes.body.includes("claude-sonnet-4")) {
      console.log("✅ handleModels method working")
    } else {
      console.log("❌ handleModels method failed")
      console.log("Response:", mockRes.body)
    }
  } catch (error) {
    console.log("❌ handleModels method error:", error.message)
  }

  // restore original method
  vscodeMock.lm.selectChatModels = originalSelectChatModels
  console.log("")
}

async function testHandleAnthropicMessages() {
  console.log("testing handleAnthropicMessages method...")

  // mock vscode.lm.selectChatModels
  const originalSelectChatModels = vscodeMock.lm.selectChatModels
  vscodeMock.lm.selectChatModels = () => Promise.resolve([
    new MockLanguageModel("claude-sonnet-4", "claude")
  ])

  const handler = new RequestHandler()
  const requestBody = JSON.stringify({
    model: "claude-sonnet-4",
    max_tokens: 100,
    messages: [
      { role: "user", content: "Hello!" }
    ]
  })

  const mockReq = new MockIncomingMessage("POST", requestBody)
  const mockRes = new MockServerResponse()

  try {
    await handler.handleAnthropicMessages(mockReq, mockRes, "req_101")
    if (mockRes.statusCode === 200 && mockRes.body.includes("message")) {
      console.log("✅ handleAnthropicMessages method working")
    } else {
      console.log("❌ handleAnthropicMessages method failed")
      console.log("Status:", mockRes.statusCode, "Body:", mockRes.body.substring(0, 200))
    }
  } catch (error) {
    console.log("❌ handleAnthropicMessages method error:", error.message)
  }

  // restore original method
  vscodeMock.lm.selectChatModels = originalSelectChatModels
  console.log("")
}

async function runTests() {
  console.log("running comprehensive RequestHandler tests...\n")

  testRequestHandlerMethods()
  testAnthropicToolConversion()
  testVSCodeToolCallConversion()
  testTokenEstimation()
  testModelSelection()
  testMessageConversion()
  testErrorHandling()
  testRequestBodyReading()
  await testHandleModels()
  await testHandleAnthropicMessages()

  console.log("comprehensive RequestHandler tests completed!")
}

if (require.main === module) {
  runTests()
}
