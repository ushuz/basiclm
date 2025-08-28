#!/usr/bin/env node

/**
 * Test script to verify server detection functionality
 */

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

// Import the compiled ServerUtils
let ServerUtils
try {
  ServerUtils = require("../out/utils/ServerUtils.js")
  if (!ServerUtils.isServerRunning) {
    console.error("\n❌ error: isServerRunning function not exported from ServerUtils")
    console.error("Available exports:", Object.keys(ServerUtils))
    process.exit(1)
  }
} catch (error) {
  console.error("\n❌ error: ServerUtils not found. run 'npm run compile' first")
  console.error("Error details:", error.message)
  process.exit(1)
}

async function testServerDetection() {
  console.log("🔍 Testing server detection functionality...\n")

  const testConfig = {
    port: 8099,
    host: "127.0.0.1",
    autoStart: true,
    enableLogging: false,
  }

  console.log("Testing server detection with config:", testConfig)

  // Test 1: Check when no server is running
  console.log("\n📡 Test 1: Checking if server is running (should be false)")
  try {
    const isRunning1 = await ServerUtils.isServerRunning(testConfig)
    console.log(`✅ Server running status: ${isRunning1}`)
    if (!isRunning1) {
      console.log("✅ Test 1 passed: No server detected as expected")
    } else {
      console.log("⚠️  Test 1: Server detected (may be running from another instance)")
    }
  } catch (error) {
    console.error("❌ Test 1 failed:", error.message)
  }

  // Test 2: Test server state key generation
  console.log("\n🔑 Test 2: Testing server state key generation")
  try {
    const stateKey = ServerUtils.getServerStateKey(testConfig)
    console.log(`✅ Generated state key: ${stateKey}`)
    const expectedKey = `basiclm.serverState.${testConfig.host}:${testConfig.port}`
    if (stateKey === expectedKey) {
      console.log("✅ Test 2 passed: State key format is correct")
    } else {
      console.log(`❌ Test 2 failed: Expected ${expectedKey}, got ${stateKey}`)
    }
  } catch (error) {
    console.error("❌ Test 2 failed:", error.message)
  }

  // Test 3: Test with different port (should definitely be false)
  console.log("\n📡 Test 3: Checking non-existent port (should be false)")
  const testConfig2 = { ...testConfig, port: 9999 }
  try {
    const isRunning3 = await ServerUtils.isServerRunning(testConfig2)
    console.log(`✅ Server running status on port 9999: ${isRunning3}`)
    if (!isRunning3) {
      console.log("✅ Test 3 passed: No server detected on unused port")
    } else {
      console.log("❌ Test 3 failed: Server detected on unused port")
    }
  } catch (error) {
    console.error("❌ Test 3 failed:", error.message)
  }

  console.log("\n🎉 Server detection tests completed!")
}

// Run the tests
testServerDetection().catch(error => {
  console.error("\n💥 Test execution failed:", error)
  process.exit(1)
})