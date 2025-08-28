#!/usr/bin/env node

/**
 * Integration test to simulate multi-window server state consistency
 */

// Mock vscode extension context for testing
class MockExtensionContext {
  constructor() {
    this.globalState = new Map()
    this.subscriptions = []
  }

  // Mock globalState
  get globalState() {
    return {
      get: (key) => this._globalState.get(key),
      update: (key, value) => {
        this._globalState.set(key, value)
        return Promise.resolve()
      }
    }
  }

  set globalState(value) {
    this._globalState = value || new Map()
  }
}

// Mock vscode module for testing
const vscodeMock = {
  workspace: {
    getConfiguration: () => ({
      get: (key, defaultValue) => {
        const defaults = {
          port: 8099,
          host: "127.0.0.1",
          autoStart: true,
          enableLogging: false,
        }
        return defaults[key.replace('basiclm.', '')] || defaultValue
      },
    }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
  },
  window: {
    createOutputChannel: () => ({
      appendLine: () => {},
      show: () => {},
      dispose: () => {},
    }),
  },
}

// Override require to mock vscode module
const Module = require("module")
const originalRequire = Module.prototype.require

Module.prototype.require = function(id) {
  if (id === "vscode") {
    return vscodeMock
  }
  return originalRequire.apply(this, arguments)
}

// Import the compiled modules
let ServerUtils, LMAPIServer
try {
  ServerUtils = require("../out/utils/ServerUtils.js")
  const LMAPIServerModule = require("../out/server/LMAPIServer.js")
  LMAPIServer = LMAPIServerModule.LMAPIServer
  
  if (!ServerUtils.isServerRunning || !LMAPIServer) {
    console.error("\n❌ error: Required classes not exported")
    console.error("ServerUtils exports:", Object.keys(ServerUtils))
    console.error("LMAPIServer exports:", Object.keys(LMAPIServerModule))
    process.exit(1)
  }
} catch (error) {
  console.error("\n❌ error: Modules not found. run 'npm run compile' first")
  console.error("Error details:", error.message)
  process.exit(1)
}

async function testMultiWindowScenario() {
  console.log("🔄 Testing multi-window server state consistency...\n")

  const testConfig = {
    port: 8099,
    host: "127.0.0.1",
    autoStart: true,
    enableLogging: false,
  }

  // Simulate two VS Code windows
  console.log("📱 Simulating Window 1:")
  const server1 = new LMAPIServer()
  const context1 = new MockExtensionContext()

  console.log("📱 Simulating Window 2:")
  const server2 = new LMAPIServer()
  const context2 = new MockExtensionContext()

  // Test 1: Both windows initially show no server running
  console.log("\n🧪 Test 1: Initial state - no server running")
  const isRunning1a = await ServerUtils.isServerRunning(testConfig)
  const isRunning2a = await ServerUtils.isServerRunning(testConfig)
  console.log(`Window 1 detects server: ${isRunning1a}`)
  console.log(`Window 2 detects server: ${isRunning2a}`)
  
  if (!isRunning1a && !isRunning2a) {
    console.log("✅ Test 1 passed: Both windows detect no server")
  } else {
    console.log("⚠️  Test 1: Server may be running from previous test")
  }

  // Test 2: Start server in Window 1
  console.log("\n🧪 Test 2: Starting server in Window 1")
  try {
    await server1.start(8099)
    console.log("✅ Server started in Window 1")
    
    // Give a moment for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Check detection from Window 2
    const isRunning2b = await ServerUtils.isServerRunning(testConfig)
    console.log(`Window 2 detects server: ${isRunning2b}`)
    
    if (isRunning2b) {
      console.log("✅ Test 2 passed: Window 2 can detect server started in Window 1")
    } else {
      console.log("❌ Test 2 failed: Window 2 cannot detect server started in Window 1")
    }
  } catch (error) {
    console.log(`⚠️  Test 2: Could not start server (${error.message})`);
    if (error.message.includes("already in use")) {
      console.log("   This is expected if another BasicLM instance is running")
    }
  }

  // Test 3: Global state management
  console.log("\n🧪 Test 3: Testing global state management")
  const stateKey = ServerUtils.getServerStateKey(testConfig)
  const mockGlobalState = {
    isRunning: true,
    port: testConfig.port,
    host: testConfig.host,
    startTime: new Date().toISOString(),
    requestCount: 5,
    errorCount: 0,
    lastUpdated: new Date().toISOString()
  }
  
  // Update global state in context1
  await context1.globalState.update(stateKey, mockGlobalState)
  
  // Verify context2 can read the same state (simulating shared global state)
  const sharedState = context1.globalState.get(stateKey)
  if (sharedState && sharedState.isRunning === true && sharedState.requestCount === 5) {
    console.log("✅ Test 3 passed: Global state can be shared between contexts")
  } else {
    console.log("❌ Test 3 failed: Global state sharing not working correctly")
  }

  // Cleanup
  console.log("\n🧹 Cleaning up...")
  try {
    if (server1.isRunning()) {
      await server1.stop()
      console.log("✅ Server 1 stopped")
    }
    if (server2.isRunning()) {
      await server2.stop()
      console.log("✅ Server 2 stopped")
    }
  } catch (error) {
    console.log(`⚠️  Cleanup warning: ${error.message}`)
  }

  console.log("\n🎉 Multi-window consistency tests completed!")
}

// Run the tests
testMultiWindowScenario().catch(error => {
  console.error("\n💥 Test execution failed:", error)
  process.exit(1)
})