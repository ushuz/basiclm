#!/usr/bin/env node

/**
 * Unit tests for error response formatting logic
 */

// Mock the required types
const ApiType = {
    OPENAI: "openai",
    ANTHROPIC: "anthropic"
};

const ERROR_CODES = {
    INVALID_REQUEST: "invalid_request_error",
    PERMISSION_ERROR: "permission_error",
    NOT_FOUND_ERROR: "not_found_error",
    API_ERROR: "api_error"
};

const HTTP_STATUS = {
    BAD_REQUEST: 400,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
};

// Mock the error formatting logic from sendError method
function formatError(statusCode, message, type, apiType) {
    let errorResponse;

    if (apiType === ApiType.ANTHROPIC) {
        errorResponse = {
            type: "error",
            error: {
                type,
                message,
            },
        };
    } else {
        // Default to OpenAI format for backward compatibility
        errorResponse = {
            error: {
                message,
                type,
                code: statusCode.toString(),
            },
        };
    }

    return errorResponse;
}

function testOpenAIErrorFormat() {
    console.log('Testing OpenAI error format...');
    
    const error = formatError(
        HTTP_STATUS.BAD_REQUEST,
        "invalid request: model and messages are required",
        ERROR_CODES.INVALID_REQUEST,
        ApiType.OPENAI
    );
    
    console.log('OpenAI Error Response:', JSON.stringify(error, null, 2));
    
    // Verify OpenAI format: { "error": { "message": "...", "type": "...", "code": "..." } }
    const isValid = error.error && 
                   error.error.message && 
                   error.error.type && 
                   error.error.code &&
                   !error.type; // Should not have top-level type
    
    if (isValid) {
        console.log('✅ OpenAI error format is correct');
    } else {
        console.log('❌ OpenAI error format is incorrect');
    }
    
    return isValid;
}

function testAnthropicErrorFormat() {
    console.log('\nTesting Anthropic error format...');
    
    const error = formatError(
        HTTP_STATUS.BAD_REQUEST,
        "invalid request: model, messages, and max_tokens are required",
        ERROR_CODES.INVALID_REQUEST,
        ApiType.ANTHROPIC
    );
    
    console.log('Anthropic Error Response:', JSON.stringify(error, null, 2));
    
    // Verify Anthropic format: { "type": "error", "error": { "type": "...", "message": "..." } }
    const isValid = error.type === 'error' && 
                   error.error && 
                   error.error.type && 
                   error.error.message &&
                   !error.error.code; // Should not have code field
    
    if (isValid) {
        console.log('✅ Anthropic error format is correct');
    } else {
        console.log('❌ Anthropic error format is incorrect');
    }
    
    return isValid;
}

function testDefaultFormatIsOpenAI() {
    console.log('\nTesting default format (should be OpenAI)...');
    
    const error = formatError(
        HTTP_STATUS.NOT_FOUND,
        "endpoint not found",
        ERROR_CODES.API_ERROR
        // No API type specified - should default to OpenAI
    );
    
    console.log('Default Error Response:', JSON.stringify(error, null, 2));
    
    // Should default to OpenAI format
    const isValid = error.error && 
                   error.error.message && 
                   error.error.type && 
                   error.error.code &&
                   !error.type; // Should not have top-level type
    
    if (isValid) {
        console.log('✅ Default error format is correct (OpenAI)');
    } else {
        console.log('❌ Default error format is incorrect');
    }
    
    return isValid;
}

function testDifferentErrorTypes() {
    console.log('\nTesting different error types...');
    
    const permissionError = formatError(
        HTTP_STATUS.FORBIDDEN,
        "permission denied for language model access",
        ERROR_CODES.PERMISSION_ERROR,
        ApiType.ANTHROPIC
    );
    
    const notFoundError = formatError(
        HTTP_STATUS.NOT_FOUND,
        "language model not found",
        ERROR_CODES.NOT_FOUND_ERROR,
        ApiType.OPENAI
    );
    
    console.log('Anthropic Permission Error:', JSON.stringify(permissionError, null, 2));
    console.log('OpenAI Not Found Error:', JSON.stringify(notFoundError, null, 2));
    
    const anthropicValid = permissionError.type === 'error' && 
                          permissionError.error.type === ERROR_CODES.PERMISSION_ERROR;
    
    const openaiValid = notFoundError.error && 
                       notFoundError.error.type === ERROR_CODES.NOT_FOUND_ERROR &&
                       notFoundError.error.code === HTTP_STATUS.NOT_FOUND.toString();
    
    if (anthropicValid && openaiValid) {
        console.log('✅ Different error types are formatted correctly');
    } else {
        console.log('❌ Different error types are not formatted correctly');
    }
    
    return anthropicValid && openaiValid;
}

function runUnitTests() {
    console.log('Starting error formatting unit tests...\n');
    
    const results = [
        testOpenAIErrorFormat(),
        testAnthropicErrorFormat(),
        testDefaultFormatIsOpenAI(),
        testDifferentErrorTypes()
    ];
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`\nUnit test results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All error formatting unit tests passed!');
    } else {
        console.log('❌ Some error formatting unit tests failed');
    }
    
    return passed === total;
}

if (require.main === module) {
    runUnitTests();
}

module.exports = {
    formatError,
    testOpenAIErrorFormat,
    testAnthropicErrorFormat,
    testDefaultFormatIsOpenAI,
    testDifferentErrorTypes
};