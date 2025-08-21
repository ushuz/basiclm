#!/usr/bin/env node

/**
 * Test script to verify error response formats for OpenAI and Anthropic APIs
 * Run this after starting the VS Code extension server
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

async function testOpenAIErrorFormat() {
    console.log('Testing unified error format on OpenAI endpoint...');
    try {
        // Test with invalid model to trigger an error
        const response = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            model: 'nonexistent-model',
            messages: [
                { role: 'user', content: 'Test' }
            ]
        });
        
        console.log('OpenAI Error Status:', response.statusCode);
        console.log('Unified Error Format:', JSON.stringify(response.body, null, 2));
        
        // Validate unified error format (compatible with both APIs)
        if (response.body.type === 'error' &&
            response.body.error && 
            typeof response.body.error.message === 'string' &&
            typeof response.body.error.type === 'string' &&
            response.body.error.hasOwnProperty('param') &&
            response.body.error.hasOwnProperty('code')) {
            console.log('✅ Unified error format is correct (OpenAI compatible)');
        } else {
            console.log('❌ Unified error format is incorrect');
        }
        
    } catch (error) {
        console.error('OpenAI error test failed:', error.message);
    }
}

async function testAnthropicErrorFormat() {
    console.log('\nTesting unified error format on Anthropic endpoint...');
    try {
        // Test with invalid model to trigger an error
        const response = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/v1/messages',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            model: 'nonexistent-claude-model',
            max_tokens: 50,
            messages: [
                { role: 'user', content: 'Test' }
            ]
        });
        
        console.log('Anthropic Error Status:', response.statusCode);
        console.log('Unified Error Format:', JSON.stringify(response.body, null, 2));
        
        // Validate unified error format (compatible with both APIs)
        if (response.body.type === 'error' &&
            response.body.error &&
            typeof response.body.error.type === 'string' &&
            typeof response.body.error.message === 'string' &&
            response.body.error.hasOwnProperty('param') &&
            response.body.error.hasOwnProperty('code')) {
            console.log('✅ Unified error format is correct (Anthropic compatible)');
        } else {
            console.log('❌ Unified error format is incorrect');
        }
        
    } catch (error) {
        console.error('Anthropic error test failed:', error.message);
    }
}

async function testInvalidEndpointErrorFormats() {
    console.log('\nTesting invalid endpoint error formats...');
    
    // Test invalid OpenAI-style endpoint
    try {
        const response1 = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/v1/chat/invalid',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('Invalid OpenAI endpoint error:', JSON.stringify(response1.body, null, 2));
        
        if (response1.body.type === 'error' && response1.body.error) {
            console.log('✅ Invalid OpenAI endpoint uses unified error format');
        } else {
            console.log('❌ Invalid OpenAI endpoint error format is incorrect');
        }
    } catch (error) {
        console.error('Invalid OpenAI endpoint test failed:', error.message);
    }
    
    // Test invalid Anthropic-style endpoint
    try {
        const response2 = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/v1/messages/invalid',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('Invalid Anthropic endpoint error:', JSON.stringify(response2.body, null, 2));
        
        if (response2.body.type === 'error' && response2.body.error) {
            console.log('✅ Invalid Anthropic endpoint uses unified error format');
        } else {
            console.log('❌ Invalid Anthropic endpoint error format is incorrect');
        }
    } catch (error) {
        console.error('Invalid Anthropic endpoint test failed:', error.message);
    }
}

async function runErrorFormatTests() {
    console.log('Starting error format tests...');
    console.log('Make sure the VS Code extension server is running first!\n');
    
    await testOpenAIErrorFormat();
    await testAnthropicErrorFormat();
    await testInvalidEndpointErrorFormats();
    
    console.log('\nError format tests completed!');
}

if (require.main === module) {
    runErrorFormatTests().catch(console.error);
}

module.exports = { runErrorFormatTests };