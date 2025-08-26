#!/usr/bin/env node

/**
 * simple test script to verify the api endpoints work
 * run this after starting the vs code extension server
 */

const http = require("http")

const BASICLM_HOST = "127.0.0.1"
const BASICLM_PORT = 8099
const BASICLM_MODEL = "claude-sonnet-4"

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = ""
      res.on("data", chunk => body += chunk)
      res.on("end", () => {
        try {
          const response = JSON.parse(body)
          resolve({ statusCode: res.statusCode, body: response })
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: body })
        }
      })
    })

    req.on("error", reject)

    if (data) {
      req.write(JSON.stringify(data))
    }
    req.end()
  })
}

async function testModels() {
  console.log("\ntesting models endpoint...")
  try {
    const response = await makeRequest({
      hostname: BASICLM_HOST,
      port: BASICLM_PORT,
      path: "/v1/models",
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })

    console.log("models status:", response.statusCode)
    console.log("models count:", response.body.data?.length || 0)
    if (response.body.data && response.body.data.length > 0) {
      console.log("first model:", response.body.data[0].id)
      console.log("✅ models endpoint working")
    } else {
      console.log("❌ no models available - check github copilot access")
    }
  } catch (error) {
    console.error("❌ models test failed:", error.message)
  }
}

async function testAnthropicMessages() {
  console.log("\ntesting anthropic messages endpoint...")
  try {
    const response = await makeRequest({
      hostname: BASICLM_HOST,
      port: BASICLM_PORT,
      path: "/v1/messages",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, {
      model: BASICLM_MODEL,
      max_tokens: 50,
      messages: [
        { role: "user", content: "say hello from anthropic endpoint!" },
      ],
    })

    console.log("anthropic status:", response.statusCode)
    if (response.body.content && response.body.content[0]) {
      console.log("anthropic response:", response.body.content[0].text)
      console.log("✅ anthropic messages endpoint working")
    } else {
      console.log("❌ anthropic error:", response.body)
    }
  } catch (error) {
    console.error("❌ anthropic test failed:", error.message)
  }
}

async function testAnthropicWithTools() {
  console.log("\ntesting anthropic endpoint with tools...")
  try {
    const response = await makeRequest({
      hostname: BASICLM_HOST,
      port: BASICLM_PORT,
      path: "/v1/messages",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, {
      model: BASICLM_MODEL,
      max_tokens: 100,
      messages: [
        { role: "user", content: "what tools are available to you?" },
      ],
      tools: [
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
      ],
    })

    console.log("anthropic with tools status:", response.statusCode)
    if (response.body.content) {
      console.log("anthropic with tools response:", response.body.content[0].text)
      console.log("✅ anthropic tools endpoint working")
    } else {
      console.log("❌ anthropic with tools error:", response.body)
    }
  } catch (error) {
    console.error("❌ anthropic with tools test failed:", error.message)
  }
}

async function testAnthropicStreaming() {
  console.log("\ntesting anthropic streaming endpoint...")
  try {
    const response = await makeRequest({
      hostname: BASICLM_HOST,
      port: BASICLM_PORT,
      path: "/v1/messages",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, {
      model: BASICLM_MODEL,
      max_tokens: 50,
      stream: true,
      messages: [
        { role: "user", content: "say hello and count to 3" },
      ],
    })

    console.log("anthropic streaming status:", response.statusCode)
    if (response.statusCode === 200) {
      console.log("streaming response received (truncated):")
      console.log(response.body.substring(0, 200) + "...")
      console.log("✅ anthropic streaming endpoint working")
    } else {
      console.log("❌ anthropic streaming error:", response.body)
    }
  } catch (error) {
    console.error("❌ anthropic streaming test failed:", error.message)
  }
}

async function testErrorHandling() {
  console.log("\ntesting error handling...")
  try {
    // test invalid model
    const response1 = await makeRequest({
      hostname: BASICLM_HOST,
      port: BASICLM_PORT,
      path: "/v1/messages",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, {
      model: "invalid-model",
      max_tokens: 50,
      messages: [
        { role: "user", content: "test" },
      ],
    })

    if (response1.statusCode === 404) {
      console.log("✅ invalid model error handling working")
    } else {
      console.log("❌ unexpected response for invalid model:", response1.statusCode)
    }

    // test missing required fields
    const response2 = await makeRequest({
      hostname: BASICLM_HOST,
      port: BASICLM_PORT,
      path: "/v1/messages",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, {
      model: BASICLM_MODEL,
      messages: [
        { role: "user", content: "test" },
      ],
      // missing max_tokens
    })

    if (response2.statusCode === 400) {
      console.log("✅ missing fields error handling working")
    } else {
      console.log("❌ unexpected response for missing fields:", response2.statusCode)
    }

  } catch (error) {
    console.error("❌ error handling test failed:", error.message)
  }
}

async function runTests() {
  console.log("starting api tests...")
  console.log("make sure the vs code extension server is running first!\n")

  await testModels()
  await testAnthropicMessages()
  await testAnthropicWithTools()
  await testAnthropicStreaming()
  await testErrorHandling()

  console.log("\ntests completed!")
}

if (require.main === module) {
  runTests().catch(console.error)
}
