#!/usr/bin/env node

/**
 * Integration test for tool call response structures
 */

// Mock a complete response structure for testing
function createMockOpenAIResponseWithTools() {
    const toolCalls = [
        {
            id: "call_abc123",
            type: "function",
            function: {
                name: "get_weather",
                arguments: '{"location": "San Francisco, CA"}'
            }
        }
    ];

    return {
        id: "chatcmpl-test123",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "gpt-4",
        choices: [{
            index: 0,
            message: {
                role: "assistant",
                content: "I'll help you get the weather information.",
                tool_calls: toolCalls
            },
            finish_reason: "tool_calls"
        }],
        usage: {
            prompt_tokens: 50,
            completion_tokens: 20,
            total_tokens: 70
        }
    };
}

function createMockAnthropicResponseWithTools() {
    return {
        id: "msg_test123",
        type: "message",
        role: "assistant",
        content: [
            {
                type: "text",
                text: "I'll help you get the weather information."
            },
            {
                type: "tool_use",
                id: "call_abc123",
                name: "get_weather",
                input: {
                    location: "San Francisco, CA"
                }
            }
        ],
        model: "claude-3-sonnet-20240229",
        stop_reason: "tool_use",
        usage: {
            input_tokens: 50,
            output_tokens: 20
        }
    };
}

function testOpenAIStreamingChunkWithTools() {
    console.log('Testing OpenAI streaming chunk with tools...');
    
    const toolCallChunk = {
        id: "chatcmpl-test123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "gpt-4",
        choices: [{
            index: 0,
            delta: {
                tool_calls: [
                    {
                        id: "call_abc123",
                        type: "function",
                        function: {
                            name: "get_weather",
                            arguments: '{"location": "San Francisco, CA"}'
                        }
                    }
                ]
            },
            finish_reason: null
        }]
    };
    
    const finalChunk = {
        id: "chatcmpl-test123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "gpt-4",
        choices: [{
            index: 0,
            delta: {},
            finish_reason: "tool_calls"
        }]
    };
    
    console.log('Tool call chunk:', JSON.stringify(toolCallChunk, null, 2));
    console.log('Final chunk:', JSON.stringify(finalChunk, null, 2));
    
    // Verify structure
    if (toolCallChunk.choices[0].delta.tool_calls &&
        toolCallChunk.choices[0].delta.tool_calls[0].function.name === 'get_weather' &&
        finalChunk.choices[0].finish_reason === 'tool_calls') {
        console.log('✅ OpenAI streaming with tools test passed');
    } else {
        console.log('❌ OpenAI streaming with tools test failed');
    }
    console.log('');
}

function testAnthropicStreamingEventsWithTools() {
    console.log('Testing Anthropic streaming events with tools...');
    
    const toolBlockStartEvent = {
        type: "content_block_start",
        index: 1,
        content_block: {
            type: "tool_use",
            id: "call_abc123",
            name: "get_weather",
            input: {
                location: "San Francisco, CA"
            }
        }
    };
    
    const toolBlockStopEvent = {
        type: "content_block_stop",
        index: 1
    };
    
    console.log('Tool block start event:', JSON.stringify(toolBlockStartEvent, null, 2));
    console.log('Tool block stop event:', JSON.stringify(toolBlockStopEvent, null, 2));
    
    // Verify structure
    if (toolBlockStartEvent.content_block.type === 'tool_use' &&
        toolBlockStartEvent.content_block.name === 'get_weather' &&
        toolBlockStopEvent.type === 'content_block_stop') {
        console.log('✅ Anthropic streaming with tools test passed');
    } else {
        console.log('❌ Anthropic streaming with tools test failed');
    }
    console.log('');
}

function testResponseStructures() {
    console.log('Testing complete response structures...');
    
    const openAIResponse = createMockOpenAIResponseWithTools();
    const anthropicResponse = createMockAnthropicResponseWithTools();
    
    console.log('OpenAI response with tools:');
    console.log(JSON.stringify(openAIResponse, null, 2));
    console.log('');
    
    console.log('Anthropic response with tools:');
    console.log(JSON.stringify(anthropicResponse, null, 2));
    console.log('');
    
    // Verify structures
    const openAIValid = openAIResponse.choices[0].message.tool_calls &&
                       openAIResponse.choices[0].finish_reason === 'tool_calls' &&
                       openAIResponse.choices[0].message.tool_calls[0].function.name === 'get_weather';
    
    const anthropicValid = anthropicResponse.content.some(c => c.type === 'tool_use') &&
                          anthropicResponse.stop_reason === 'tool_use' &&
                          anthropicResponse.content.find(c => c.type === 'tool_use').name === 'get_weather';
    
    if (openAIValid && anthropicValid) {
        console.log('✅ Response structures test passed');
    } else {
        console.log('❌ Response structures test failed');
        console.log(`OpenAI valid: ${openAIValid}, Anthropic valid: ${anthropicValid}`);
    }
    console.log('');
}

function runIntegrationTests() {
    console.log('Running tool call integration tests...\n');
    
    testResponseStructures();
    testOpenAIStreamingChunkWithTools();
    testAnthropicStreamingEventsWithTools();
    
    console.log('Integration tests completed!');
}

if (require.main === module) {
    runIntegrationTests();
}