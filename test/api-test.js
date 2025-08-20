#!/usr/bin/env node

/**
 * Simple test script to verify the API endpoints work
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

async function testHealth() {
    console.log('Testing health endpoint...');
    try {
        const response = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/health',
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('Health Status:', response.statusCode);
        console.log('Health Response:', JSON.stringify(response.body, null, 2));
    } catch (error) {
        console.error('Health test failed:', error.message);
    }
}

async function testModels() {
    console.log('\nTesting models endpoint...');
    try {
        const response = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/v1/models',
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('Models Status:', response.statusCode);
        console.log('Models Count:', response.body.data?.length || 0);
        if (response.body.data && response.body.data.length > 0) {
            console.log('First Model:', response.body.data[0].id);
        }
    } catch (error) {
        console.error('Models test failed:', error.message);
    }
}

async function testOpenAI() {
    console.log('\nTesting OpenAI endpoint...');
    try {
        const response = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            model: 'gpt-5',
            messages: [
                { role: 'user', content: 'Say "Hello from OpenAI endpoint!"' }
            ],
            max_tokens: 50
        });
        
        console.log('OpenAI Status:', response.statusCode);
        if (response.body.choices) {
            console.log('OpenAI Response:', response.body.choices[0].message.content);
        } else {
            console.log('OpenAI Error:', response.body);
        }
    } catch (error) {
        console.error('OpenAI test failed:', error.message);
    }
}

async function testAnthropic() {
    console.log('\nTesting Anthropic endpoint...');
    try {
        const response = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/v1/messages',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            model: 'claude-sonnet-4',
            max_tokens: 50,
            messages: [
                { role: 'user', content: 'Say "Hello from Anthropic endpoint!"' }
            ]
        });
        
        console.log('Anthropic Status:', response.statusCode);
        if (response.body.content) {
            console.log('Anthropic Response:', response.body.content[0].text);
        } else {
            console.log('Anthropic Error:', response.body);
        }
    } catch (error) {
        console.error('Anthropic test failed:', error.message);
    }
}

async function testOpenAIWithTools() {
    console.log('\nTesting OpenAI endpoint with tools...');
    try {
        const response = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            model: 'gpt-5',
            messages: [
                { role: 'user', content: 'What tools are available to you?' }
            ],
            max_tokens: 100,
            tools: [
                {
                    type: 'function',
                    function: {
                        name: 'get_weather',
                        description: 'Get current weather information for a location',
                        parameters: {
                            type: 'object',
                            properties: {
                                location: {
                                    type: 'string',
                                    description: 'The city and state/country'
                                }
                            },
                            required: ['location']
                        }
                    }
                }
            ]
        });
        
        console.log('OpenAI with Tools Status:', response.statusCode);
        if (response.body.choices) {
            console.log('OpenAI with Tools Response:', response.body.choices[0].message.content);
        } else {
            console.log('OpenAI with Tools Error:', response.body);
        }
    } catch (error) {
        console.error('OpenAI with tools test failed:', error.message);
    }
}

async function testAnthropicWithTools() {
    console.log('\nTesting Anthropic endpoint with tools...');
    try {
        const response = await makeRequest({
            hostname: '127.0.0.1',
            port: 8099,
            path: '/v1/messages',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            model: 'claude-sonnet-4',
            max_tokens: 100,
            messages: [
                { role: 'user', content: 'What tools are available to you?' }
            ],
            tools: [
                {
                    name: 'calculate',
                    description: 'Perform mathematical calculations',
                    input_schema: {
                        type: 'object',
                        properties: {
                            expression: {
                                type: 'string',
                                description: 'Mathematical expression to evaluate'
                            }
                        },
                        required: ['expression']
                    }
                }
            ]
        });
        
        console.log('Anthropic with Tools Status:', response.statusCode);
        if (response.body.content) {
            console.log('Anthropic with Tools Response:', response.body.content[0].text);
        } else {
            console.log('Anthropic with Tools Error:', response.body);
        }
    } catch (error) {
        console.error('Anthropic with tools test failed:', error.message);
    }
}

async function runTests() {
    console.log('Starting API tests...');
    console.log('Make sure the VS Code extension server is running first!\n');
    
    await testHealth();
    await testModels();
    await testOpenAI();
    await testAnthropic();
    await testOpenAIWithTools();
    await testAnthropicWithTools();
    
    console.log('\nTests completed!');
}

if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests };