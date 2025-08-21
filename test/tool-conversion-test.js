#!/usr/bin/env node

/**
 * Test script to verify tool call response conversion
 */

// Mock VSCode tool call response
const mockVSCodeToolCalls = [
    {
        name: 'get_weather',
        arguments: '{"location": "San Francisco, CA"}',
        callId: 'call_abc123'
    },
    {
        name: 'calculate',
        arguments: '{"expression": "2 + 2"}',
        callId: 'call_def456'
    }
];

// Import the RequestHandler for testing (this would require the module to be built)
// For now, let's create a standalone test of the conversion logic

function convertVSCodeToolCallsToOpenAI(toolCalls) {
    if (!toolCalls || !Array.isArray(toolCalls)) {
        return []
    }

    return toolCalls.map(call => ({
        id: call.callId,
        type: "function",
        function: {
            name: call.name,
            arguments: call.arguments
        }
    }))
}

function convertVSCodeToolCallsToAnthropic(toolCalls) {
    if (!toolCalls || !Array.isArray(toolCalls)) {
        return []
    }

    return toolCalls.map(call => ({
        type: "tool_use",
        id: call.callId,
        name: call.name,
        input: JSON.parse(call.arguments || "{}")
    }))
}

function testOpenAIConversion() {
    console.log('Testing OpenAI tool call conversion...');
    
    const converted = convertVSCodeToolCallsToOpenAI(mockVSCodeToolCalls);
    
    console.log('Input VS Code tool calls:', JSON.stringify(mockVSCodeToolCalls, null, 2));
    console.log('Converted to OpenAI format:', JSON.stringify(converted, null, 2));
    
    // Verify structure
    if (converted.length === 2 &&
        converted[0].type === 'function' &&
        converted[0].function.name === 'get_weather' &&
        converted[0].id === 'call_abc123') {
        console.log('✅ OpenAI conversion test passed');
    } else {
        console.log('❌ OpenAI conversion test failed');
    }
    console.log('');
}

function testAnthropicConversion() {
    console.log('Testing Anthropic tool call conversion...');
    
    const converted = convertVSCodeToolCallsToAnthropic(mockVSCodeToolCalls);
    
    console.log('Input VS Code tool calls:', JSON.stringify(mockVSCodeToolCalls, null, 2));
    console.log('Converted to Anthropic format:', JSON.stringify(converted, null, 2));
    
    // Verify structure
    if (converted.length === 2 &&
        converted[0].type === 'tool_use' &&
        converted[0].name === 'get_weather' &&
        converted[0].input.location === 'San Francisco, CA' &&
        converted[0].id === 'call_abc123') {
        console.log('✅ Anthropic conversion test passed');
    } else {
        console.log('❌ Anthropic conversion test failed');
    }
    console.log('');
}

function extractToolCallsFromVSCodeResponse(response) {
    // The VS Code Language Model API might use different property names
    // Try common variations and provide defensive access
    const responseAny = response
    
    const toolCalls = responseAny.toolCalls || 
                     responseAny.tool_calls || 
                     responseAny.functionCalls ||
                     responseAny.function_calls ||
                     []
    
    if (Array.isArray(toolCalls)) {
      return toolCalls
    }
    
    return []
}

function testResponseExtraction() {
    console.log('Testing VS Code response extraction...');
    
    // Test different property names
    const testResponses = [
        { toolCalls: mockVSCodeToolCalls },
        { tool_calls: mockVSCodeToolCalls },
        { functionCalls: mockVSCodeToolCalls },
        { function_calls: mockVSCodeToolCalls },
        { text: "some text" }, // no tool calls
        {}
    ];
    
    let passed = 0;
    let total = testResponses.length;
    
    testResponses.forEach((response, index) => {
        const extracted = extractToolCallsFromVSCodeResponse(response);
        const expectedLength = index < 4 ? 2 : 0;
        
        if (extracted.length === expectedLength) {
            passed++;
            console.log(`  ✅ Test ${index + 1}: extracted ${extracted.length} tool calls`);
        } else {
            console.log(`  ❌ Test ${index + 1}: expected ${expectedLength}, got ${extracted.length}`);
        }
    });
    
    if (passed === total) {
        console.log('✅ Response extraction test passed');
    } else {
        console.log(`❌ Response extraction test failed (${passed}/${total})`);
    }
    console.log('');
}

function testEmptyInputs() {
    console.log('Testing empty inputs...');
    
    const openAIEmpty = convertVSCodeToolCallsToOpenAI([]);
    const anthropicEmpty = convertVSCodeToolCallsToAnthropic(null);
    
    if (openAIEmpty.length === 0 && anthropicEmpty.length === 0) {
        console.log('✅ Empty input test passed');
    } else {
        console.log('❌ Empty input test failed');
    }
    console.log('');
}

function runTests() {
    console.log('Running tool call conversion tests...\n');
    
    testOpenAIConversion();
    testAnthropicConversion();
    testResponseExtraction();
    testEmptyInputs();
    
    console.log('Tests completed!');
}

if (require.main === module) {
    runTests();
}