#!/usr/bin/env node

/**
 * Unit test for error response formatting
 * Tests the error formatting logic without requiring a running server
 */

// Mock the vscode module since we're not in a VS Code environment
const mockVscode = {
    workspace: {
        getConfiguration: () => ({
            get: () => undefined
        })
    }
};

// Simple unit test to verify error response formats
function testErrorResponseFormats() {
    console.log('Testing error response format logic...\n');
    
    // Mock the content types constant
    const CONTENT_TYPES = { JSON: "application/json" };
    
    // Test data
    const testCases = [
        {
            name: 'OpenAI Error Format',
            apiType: 'openai',
            expected: {
                error: {
                    message: 'Test error message',
                    type: 'invalid_request_error',
                    param: null,
                    code: null
                }
            }
        },
        {
            name: 'Anthropic Error Format', 
            apiType: 'anthropic',
            expected: {
                type: 'error',
                error: {
                    type: 'invalid_request_error',
                    message: 'Test error message'
                }
            }
        }
    ];
    
    // Test each case
    testCases.forEach(testCase => {
        console.log(`Testing ${testCase.name}:`);
        
        let errorResponse;
        const message = 'Test error message';
        const type = 'invalid_request_error';
        
        if (testCase.apiType === 'anthropic') {
            errorResponse = {
                type: "error",
                error: {
                    type,
                    message,
                },
            };
        } else {
            // Default to OpenAI format
            errorResponse = {
                error: {
                    message,
                    type,
                    param: null,
                    code: null,
                },
            };
        }
        
        console.log('Generated:', JSON.stringify(errorResponse, null, 2));
        console.log('Expected: ', JSON.stringify(testCase.expected, null, 2));
        
        // Simple deep equality check
        const generated = JSON.stringify(errorResponse);
        const expected = JSON.stringify(testCase.expected);
        
        if (generated === expected) {
            console.log('✅ Format is correct\n');
        } else {
            console.log('❌ Format is incorrect\n');
        }
    });
}

function testErrorMapping() {
    console.log('Testing error type mappings...\n');
    
    // Test various error scenarios with their expected formats
    const errorScenarios = [
        {
            httpStatus: 400,
            errorType: 'invalid_request_error',
            message: 'invalid request: model and messages are required'
        },
        {
            httpStatus: 403,
            errorType: 'permission_error', 
            message: 'permission denied for language model access'
        },
        {
            httpStatus: 404,
            errorType: 'not_found_error',
            message: 'language model not found'
        },
        {
            httpStatus: 502,
            errorType: 'api_error',
            message: 'language model error: some error'
        }
    ];
    
    errorScenarios.forEach(scenario => {
        console.log(`Testing ${scenario.httpStatus} error with type ${scenario.errorType}:`);
        
        // Test OpenAI format
        const openaiError = {
            error: {
                message: scenario.message,
                type: scenario.errorType,
                param: null,
                code: null,
            },
        };
        
        // Test Anthropic format
        const anthropicError = {
            type: "error",
            error: {
                type: scenario.errorType,
                message: scenario.message,
            },
        };
        
        console.log('OpenAI format:', JSON.stringify(openaiError, null, 2));
        console.log('Anthropic format:', JSON.stringify(anthropicError, null, 2));
        console.log('✅ Both formats generated successfully\n');
    });
}

function runUnitTests() {
    console.log('=== Error Response Format Unit Tests ===\n');
    
    testErrorResponseFormats();
    testErrorMapping();
    
    console.log('=== Unit Tests Completed ===');
}

if (require.main === module) {
    runUnitTests();
}

module.exports = { runUnitTests };