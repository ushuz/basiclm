#!/usr/bin/env node

/**
 * Test error response formats for OpenAI and Anthropic APIs
 */

const http = require('http');

function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        body: JSON.parse(body)
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        body: body
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function testOpenAIErrorFormat() {
    console.log('Testing OpenAI error format...');
    try {
        const response = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            // Invalid request - missing required fields
            model: 'test'
        });
        
        console.log('OpenAI Error Status:', response.statusCode);
        console.log('OpenAI Error Response:', JSON.stringify(response.body, null, 2));
        
        // Verify OpenAI format: { "error": { "message": "...", "type": "...", "code": "..." } }
        if (response.body.error && response.body.error.message && response.body.error.type && response.body.error.code) {
            console.log('✅ OpenAI error format is correct');
        } else {
            console.log('❌ OpenAI error format is incorrect');
        }
        
    } catch (error) {
        console.error('OpenAI error test failed:', error.message);
    }
}

async function testAnthropicErrorFormat() {
    console.log('\nTesting Anthropic error format...');
    try {
        const response = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/v1/messages',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            // Invalid request - missing required fields
            model: 'test'
        });
        
        console.log('Anthropic Error Status:', response.statusCode);
        console.log('Anthropic Error Response:', JSON.stringify(response.body, null, 2));
        
        // Verify Anthropic format: { "type": "error", "error": { "type": "...", "message": "..." } }
        if (response.body.type === 'error' && response.body.error && response.body.error.type && response.body.error.message) {
            console.log('✅ Anthropic error format is correct');
        } else {
            console.log('❌ Anthropic error format is incorrect');
        }
        
    } catch (error) {
        console.error('Anthropic error test failed:', error.message);
    }
}

async function testInvalidEndpointError() {
    console.log('\nTesting invalid endpoint error (should default to OpenAI format)...');
    try {
        const response = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/invalid',
            method: 'GET',
        });
        
        console.log('Invalid Endpoint Error Status:', response.statusCode);
        console.log('Invalid Endpoint Error Response:', JSON.stringify(response.body, null, 2));
        
        // Should default to OpenAI format
        if (response.body.error && response.body.error.message && response.body.error.type && response.body.error.code) {
            console.log('✅ Invalid endpoint error format is correct (defaults to OpenAI)');
        } else {
            console.log('❌ Invalid endpoint error format is incorrect');
        }
        
    } catch (error) {
        console.error('Invalid endpoint error test failed:', error.message);
    }
}

async function runErrorFormatTests() {
    console.log('Starting error format tests...');
    console.log('Make sure the VS Code extension server is running first!\n');
    
    await testOpenAIErrorFormat();
    await testAnthropicErrorFormat();
    await testInvalidEndpointError();
    
    console.log('\nError format tests completed!');
}

if (require.main === module) {
    runErrorFormatTests();
}

module.exports = {
    testOpenAIErrorFormat,
    testAnthropicErrorFormat,
    testInvalidEndpointError
};