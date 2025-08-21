#!/usr/bin/env node

/**
 * Test script to verify unified error response format for both OpenAI and Anthropic APIs
 */

const http = require('http');

const BASE_URL = 'http://127.0.0.1:8099';

function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve({ statusCode: res.statusCode, body: response });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: body });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

/**
 * Test various error scenarios to verify unified error response format
 */
async function testUnifiedErrorFormat() {
    const tests = [
        {
            name: "OpenAI endpoint - missing model",
            endpoint: "/v1/chat/completions",
            method: "POST",
            data: {
                messages: [{ role: 'user', content: 'test' }]
            },
            expectedError: "invalid_request_error"
        },
        {
            name: "OpenAI endpoint - invalid model",
            endpoint: "/v1/chat/completions", 
            method: "POST",
            data: {
                model: "non-existent-model",
                messages: [{ role: 'user', content: 'test' }]
            },
            expectedError: "invalid_request_error"
        },
        {
            name: "Anthropic endpoint - missing model",
            endpoint: "/v1/messages",
            method: "POST", 
            data: {
                max_tokens: 50,
                messages: [{ role: 'user', content: 'test' }]
            },
            expectedError: "invalid_request_error"
        },
        {
            name: "Anthropic endpoint - invalid model",
            endpoint: "/v1/messages",
            method: "POST",
            data: {
                model: "non-existent-model",
                max_tokens: 50,
                messages: [{ role: 'user', content: 'test' }]
            },
            expectedError: "invalid_request_error"
        },
        {
            name: "Non-existent endpoint",
            endpoint: "/v1/invalid",
            method: "GET",
            data: null,
            expectedError: "not_found_error"
        },
        {
            name: "OpenAI endpoint - wrong method",
            endpoint: "/v1/chat/completions",
            method: "GET",
            data: null,
            expectedError: "invalid_request_error"
        },
        {
            name: "Anthropic endpoint - wrong method", 
            endpoint: "/v1/messages",
            method: "GET",
            data: null,
            expectedError: "invalid_request_error"
        }
    ];

    console.log('Testing unified error response format...\n');

    let passedTests = 0;
    let totalTests = tests.length;

    for (const test of tests) {
        try {
            console.log(`Testing: ${test.name}`);
            
            const response = await makeRequest({
                hostname: '127.0.0.1',
                port: 8099,
                path: test.endpoint,
                method: test.method,
                headers: { 'Content-Type': 'application/json' }
            }, test.data);

            // Verify error response structure
            const isValidErrorFormat = validateErrorFormat(response.body, test.expectedError);
            
            if (isValidErrorFormat) {
                console.log(`✓ PASS: Error format is valid`);
                console.log(`  Status: ${response.statusCode}`);
                console.log(`  Error Type: ${response.body.error?.type}`);
                console.log(`  Message: ${response.body.error?.message}`);
                console.log(`  Code: ${response.body.error?.code}`);
                console.log(`  RequestId: ${response.body.error?.requestId ? 'Present' : 'Not present'}`);
                passedTests++;
            } else {
                console.log(`✗ FAIL: Invalid error format`);
                console.log(`  Expected error type: ${test.expectedError}`);
                console.log(`  Actual response:`, JSON.stringify(response.body, null, 2));
            }
            
        } catch (error) {
            console.log(`✗ FAIL: Request failed - ${error.message}`);
        }
        
        console.log('');
    }

    console.log(`\nTest Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All unified error format tests passed!');
        return true;
    } else {
        console.log('❌ Some tests failed. Error format may not be unified correctly.');
        return false;
    }
}

/**
 * Validate that error response follows the expected unified format
 */
function validateErrorFormat(response, expectedErrorType) {
    // Check that response has error structure
    if (!response || !response.error) {
        console.log(`  ✗ Missing error object`);
        return false;
    }

    const error = response.error;

    // Check required fields
    if (!error.message || typeof error.message !== 'string') {
        console.log(`  ✗ Missing or invalid message field`);
        return false;
    }

    if (!error.type || typeof error.type !== 'string') {
        console.log(`  ✗ Missing or invalid type field`);
        return false;
    }

    if (!error.code || typeof error.code !== 'string') {
        console.log(`  ✗ Missing or invalid code field`);
        return false;
    }

    // Check that error type matches expected
    if (error.type !== expectedErrorType) {
        console.log(`  ✗ Error type mismatch. Expected: ${expectedErrorType}, Got: ${error.type}`);
        return false;
    }

    // Optional fields validation
    if (error.param && typeof error.param !== 'string') {
        console.log(`  ✗ Invalid param field type`);
        return false;
    }

    if (error.requestId && typeof error.requestId !== 'string') {
        console.log(`  ✗ Invalid requestId field type`);
        return false;
    }

    return true;
}

async function runErrorTests() {
    console.log('Starting unified error format tests...');
    console.log('Make sure the VS Code extension server is running first!\n');
    
    const success = await testUnifiedErrorFormat();
    
    console.log('\nError format tests completed!');
    process.exit(success ? 0 : 1);
}

if (require.main === module) {
    runErrorTests().catch(console.error);
}

module.exports = { testUnifiedErrorFormat };