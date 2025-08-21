#!/usr/bin/env node

/**
 * Integration test simulating error handling in actual request scenarios
 */

// This test simulates the actual error handling flow without requiring a running VS Code extension

// Mock the HTTP response object
class MockHttpResponse {
    constructor() {
        this.statusCode = null;
        this.headers = {};
        this.body = '';
        this.headersSent = false;
    }

    writeHead(statusCode, headers) {
        this.statusCode = statusCode;
        if (headers) {
            Object.assign(this.headers, headers);
        }
        this.headersSent = true;
    }

    end(data) {
        this.body = data;
    }

    setHeader(key, value) {
        this.headers[key] = value;
    }
}

// Mock constants
const HTTP_STATUS = {
    BAD_REQUEST: 400,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503
};

const ERROR_CODES = {
    INVALID_REQUEST: "invalid_request_error",
    PERMISSION_ERROR: "permission_error",
    NOT_FOUND_ERROR: "not_found_error",
    API_ERROR: "api_error"
};

const CONTENT_TYPES = {
    JSON: "application/json"
};

const ApiType = {
    OPENAI: "openai",
    ANTHROPIC: "anthropic"
};

// Mock Logger
const Logger = {
    error: () => {},
    debug: () => {},
    info: () => {}
};

// Simplified version of the sendError method from RequestHandler
function sendError(res, statusCode, message, type, requestId, apiType) {
    if (res.headersSent) {
        return;
    }

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

    res.writeHead(statusCode, { "Content-Type": CONTENT_TYPES.JSON });
    res.end(JSON.stringify(errorResponse, null, 2));

    Logger.error(`error response: ${statusCode}`, new Error(message), { type, requestId });
}

// Test scenarios
function testOpenAIValidationError() {
    console.log('Testing OpenAI validation error...');
    
    const res = new MockHttpResponse();
    const requestId = 'req_test_openai_validation';
    
    // Simulate invalid request validation in handleOpenAIChatCompletions
    sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        "invalid request: model and messages are required",
        ERROR_CODES.INVALID_REQUEST,
        requestId,
        ApiType.OPENAI
    );
    
    const response = JSON.parse(res.body);
    console.log('OpenAI Validation Error Response:', JSON.stringify(response, null, 2));
    
    const isValid = res.statusCode === 400 &&
                   res.headers['Content-Type'] === 'application/json' &&
                   response.error &&
                   response.error.message === "invalid request: model and messages are required" &&
                   response.error.type === "invalid_request_error" &&
                   response.error.code === "400" &&
                   !response.type; // Should not have top-level type
    
    console.log(isValid ? '✅ OpenAI validation error correct' : '❌ OpenAI validation error incorrect');
    return isValid;
}

function testAnthropicValidationError() {
    console.log('\nTesting Anthropic validation error...');
    
    const res = new MockHttpResponse();
    const requestId = 'req_test_anthropic_validation';
    
    // Simulate invalid request validation in handleAnthropicMessages
    sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        "invalid request: model, messages, and max_tokens are required",
        ERROR_CODES.INVALID_REQUEST,
        requestId,
        ApiType.ANTHROPIC
    );
    
    const response = JSON.parse(res.body);
    console.log('Anthropic Validation Error Response:', JSON.stringify(response, null, 2));
    
    const isValid = res.statusCode === 400 &&
                   res.headers['Content-Type'] === 'application/json' &&
                   response.type === "error" &&
                   response.error &&
                   response.error.type === "invalid_request_error" &&
                   response.error.message === "invalid request: model, messages, and max_tokens are required" &&
                   !response.error.code; // Should not have code field
    
    console.log(isValid ? '✅ Anthropic validation error correct' : '❌ Anthropic validation error incorrect');
    return isValid;
}

function testOpenAIModelNotFoundError() {
    console.log('\nTesting OpenAI model not found error...');
    
    const res = new MockHttpResponse();
    const requestId = 'req_test_openai_model_not_found';
    
    // Simulate model not found in handleOpenAIChatCompletions
    sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        'model "gpt-nonexistent" not available',
        ERROR_CODES.INVALID_REQUEST,
        requestId,
        ApiType.OPENAI
    );
    
    const response = JSON.parse(res.body);
    console.log('OpenAI Model Not Found Error Response:', JSON.stringify(response, null, 2));
    
    const isValid = res.statusCode === 400 &&
                   response.error &&
                   response.error.message === 'model "gpt-nonexistent" not available' &&
                   response.error.type === "invalid_request_error" &&
                   response.error.code === "400";
    
    console.log(isValid ? '✅ OpenAI model not found error correct' : '❌ OpenAI model not found error incorrect');
    return isValid;
}

function testAnthropicNoModelsError() {
    console.log('\nTesting Anthropic no models available error...');
    
    const res = new MockHttpResponse();
    const requestId = 'req_test_anthropic_no_models';
    
    // Simulate no models available in handleAnthropicMessages
    sendError(
        res,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        "no language models available",
        ERROR_CODES.API_ERROR,
        requestId,
        ApiType.ANTHROPIC
    );
    
    const response = JSON.parse(res.body);
    console.log('Anthropic No Models Error Response:', JSON.stringify(response, null, 2));
    
    const isValid = res.statusCode === 503 &&
                   response.type === "error" &&
                   response.error &&
                   response.error.type === "api_error" &&
                   response.error.message === "no language models available";
    
    console.log(isValid ? '✅ Anthropic no models error correct' : '❌ Anthropic no models error incorrect');
    return isValid;
}

function testDefaultFormatForUnknownEndpoint() {
    console.log('\nTesting default format for unknown endpoint...');
    
    const res = new MockHttpResponse();
    const requestId = 'req_test_unknown_endpoint';
    
    // Simulate unknown endpoint error (should default to OpenAI format)
    sendError(
        res,
        HTTP_STATUS.NOT_FOUND,
        "endpoint not found",
        ERROR_CODES.API_ERROR,
        requestId
        // No API type specified - should default to OpenAI
    );
    
    const response = JSON.parse(res.body);
    console.log('Default Format Error Response:', JSON.stringify(response, null, 2));
    
    const isValid = res.statusCode === 404 &&
                   response.error &&
                   response.error.message === "endpoint not found" &&
                   response.error.type === "api_error" &&
                   response.error.code === "404" &&
                   !response.type; // Should not have top-level type (OpenAI format)
    
    console.log(isValid ? '✅ Default format error correct' : '❌ Default format error incorrect');
    return isValid;
}

function runIntegrationTests() {
    console.log('Starting error handling integration tests...\n');
    
    const results = [
        testOpenAIValidationError(),
        testAnthropicValidationError(),
        testOpenAIModelNotFoundError(),
        testAnthropicNoModelsError(),
        testDefaultFormatForUnknownEndpoint()
    ];
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`\nIntegration test results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All error handling integration tests passed!');
        console.log('\nSummary:');
        console.log('- OpenAI endpoints return errors in OpenAI format');
        console.log('- Anthropic endpoints return errors in Anthropic format');
        console.log('- Unknown endpoints default to OpenAI format');
        console.log('- All HTTP status codes and error types are preserved');
    } else {
        console.log('❌ Some error handling integration tests failed');
    }
    
    return passed === total;
}

if (require.main === module) {
    runIntegrationTests();
}

module.exports = {
    sendError,
    testOpenAIValidationError,
    testAnthropicValidationError,
    testOpenAIModelNotFoundError,
    testAnthropicNoModelsError,
    testDefaultFormatForUnknownEndpoint
};