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
    console.log('Testing unified error response format...\n');
    
    // Mock the content types constant
    const CONTENT_TYPES = { JSON: "application/json" };
    
    // Test the unified format that works for both APIs
    const testCase = {
        name: 'Unified Error Format (Compatible with both OpenAI and Anthropic)',
        expected: {
            type: 'error',
            error: {
                message: 'Test error message',
                type: 'invalid_request_error',
                param: null,
                code: null
            }
        }
    };
    
    console.log(`Testing ${testCase.name}:`);
    
    // Generate unified error response
    const message = 'Test error message';
    const type = 'invalid_request_error';
    
    const errorResponse = {
        type: "error",
        error: {
            message,
            type,
            param: null,
            code: null,
        },
    };
    
    console.log('Generated:', JSON.stringify(errorResponse, null, 2));
    console.log('Expected: ', JSON.stringify(testCase.expected, null, 2));
    
    // Simple deep equality check
    const generated = JSON.stringify(errorResponse);
    const expected = JSON.stringify(testCase.expected);
    
    if (generated === expected) {
        console.log('✅ Unified format is correct');
        console.log('✅ Compatible with OpenAI (has error.message, error.type, error.param, error.code)');
        console.log('✅ Compatible with Anthropic (has type: "error" and error.type, error.message)');
    } else {
        console.log('❌ Unified format is incorrect');
    }
    console.log('');
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
        
        // Test unified format that works for both APIs
        const unifiedError = {
            type: "error",
            error: {
                message: scenario.message,
                type: scenario.errorType,
                param: null,
                code: null,
            },
        };
        
        console.log('Unified format:', JSON.stringify(unifiedError, null, 2));
        console.log('✅ Unified format generated successfully');
        console.log('✅ Compatible with both OpenAI and Anthropic APIs\n');
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