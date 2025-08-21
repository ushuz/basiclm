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
    AUTHENTICATION_ERROR: "authentication_error",
    PERMISSION_ERROR: "permission_error",
    NOT_FOUND_ERROR: "not_found_error",
    REQUEST_TOO_LARGE: "request_too_large",
    RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
    RATE_LIMIT_ERROR: "rate_limit_error",
    API_ERROR: "api_error",
    OVERLOADED_ERROR: "overloaded_error"
};

const HTTP_STATUS = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    REQUEST_TOO_LARGE: 413,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
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

    // Test new error types
    const authenticationError = formatError(
        HTTP_STATUS.UNAUTHORIZED,
        "invalid api key",
        ERROR_CODES.AUTHENTICATION_ERROR,
        ApiType.OPENAI
    );

    const rateLimitErrorOpenAI = formatError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        "rate limit exceeded",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        ApiType.OPENAI
    );

    const rateLimitErrorAnthropic = formatError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        "rate limit exceeded",
        ERROR_CODES.RATE_LIMIT_ERROR,
        ApiType.ANTHROPIC
    );

    const requestTooLargeError = formatError(
        HTTP_STATUS.REQUEST_TOO_LARGE,
        "request entity too large",
        ERROR_CODES.REQUEST_TOO_LARGE,
        ApiType.OPENAI
    );

    const overloadedError = formatError(
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        "server overloaded",
        ERROR_CODES.OVERLOADED_ERROR,
        ApiType.ANTHROPIC
    );
    
    console.log('Anthropic Permission Error:', JSON.stringify(permissionError, null, 2));
    console.log('OpenAI Not Found Error:', JSON.stringify(notFoundError, null, 2));
    console.log('OpenAI Authentication Error:', JSON.stringify(authenticationError, null, 2));
    console.log('OpenAI Rate Limit Error:', JSON.stringify(rateLimitErrorOpenAI, null, 2));
    console.log('Anthropic Rate Limit Error:', JSON.stringify(rateLimitErrorAnthropic, null, 2));
    console.log('OpenAI Request Too Large Error:', JSON.stringify(requestTooLargeError, null, 2));
    console.log('Anthropic Overloaded Error:', JSON.stringify(overloadedError, null, 2));
    
    const anthropicValid = permissionError.type === 'error' && 
                          permissionError.error.type === ERROR_CODES.PERMISSION_ERROR;
    
    const openaiValid = notFoundError.error && 
                       notFoundError.error.type === ERROR_CODES.NOT_FOUND_ERROR &&
                       notFoundError.error.code === HTTP_STATUS.NOT_FOUND.toString();

    const newErrorTypesValid = 
        authenticationError.error.type === ERROR_CODES.AUTHENTICATION_ERROR &&
        rateLimitErrorOpenAI.error.type === ERROR_CODES.RATE_LIMIT_EXCEEDED &&
        rateLimitErrorAnthropic.error.type === ERROR_CODES.RATE_LIMIT_ERROR &&
        requestTooLargeError.error.type === ERROR_CODES.REQUEST_TOO_LARGE &&
        overloadedError.error.type === ERROR_CODES.OVERLOADED_ERROR;
    
    if (anthropicValid && openaiValid && newErrorTypesValid) {
        console.log('✅ All error types are formatted correctly');
    } else {
        console.log('❌ Some error types are not formatted correctly');
    }
    
    return anthropicValid && openaiValid && newErrorTypesValid;
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