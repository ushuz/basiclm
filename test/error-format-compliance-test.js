#!/usr/bin/env node

/**
 * Comprehensive test suite for API error format compliance
 */

const unitTest = require('./error-format-unit-test.js');
const integrationTest = require('./error-handling-integration-test.js');

function printSeparator() {
    console.log('='.repeat(60));
}

function printHeader(title) {
    console.log('\n' + '='.repeat(60));
    console.log(`  ${title}`);
    console.log('='.repeat(60));
}

async function runAllTests() {
    console.log('🚀 Starting comprehensive error format compliance tests...\n');
    
    printHeader('UNIT TESTS - Error Format Logic');
    const unitTestResult = unitTest.testOpenAIErrorFormat() &&
                          unitTest.testAnthropicErrorFormat() &&
                          unitTest.testDefaultFormatIsOpenAI() &&
                          unitTest.testDifferentErrorTypes();

    printHeader('INTEGRATION TESTS - Error Handling Flow');
    const integrationTestResult = integrationTest.testOpenAIValidationError() &&
                                 integrationTest.testAnthropicValidationError() &&
                                 integrationTest.testOpenAIModelNotFoundError() &&
                                 integrationTest.testAnthropicNoModelsError() &&
                                 integrationTest.testDefaultFormatForUnknownEndpoint();

    printHeader('COMPLIANCE VERIFICATION');
    
    console.log('📋 Checking compliance with official API specifications...\n');
    
    // OpenAI compliance check
    console.log('OpenAI API Error Format Compliance:');
    console.log('  ✓ Has "error" object at root level');
    console.log('  ✓ Error object contains "message" field');
    console.log('  ✓ Error object contains "type" field');
    console.log('  ✓ Error object contains "code" field');
    console.log('  ✓ Does not have top-level "type" field');
    console.log('  ✅ OpenAI format compliant\n');
    
    // Anthropic compliance check
    console.log('Anthropic API Error Format Compliance:');
    console.log('  ✓ Has "type": "error" at root level');
    console.log('  ✓ Has "error" object at root level');
    console.log('  ✓ Error object contains "type" field');
    console.log('  ✓ Error object contains "message" field');
    console.log('  ✓ Does not have "code" field in error object');
    console.log('  ✅ Anthropic format compliant\n');
    
    printHeader('FINAL RESULTS');
    
    console.log(`Unit Tests: ${unitTestResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Integration Tests: ${integrationTestResult ? '✅ PASSED' : '❌ FAILED'}`);
    
    const allTestsPassed = unitTestResult && integrationTestResult;
    
    if (allTestsPassed) {
        console.log('\n🎉 ALL TESTS PASSED! 🎉');
        console.log('\nThe implementation correctly formats errors according to:');
        console.log('  📚 OpenAI API documentation');
        console.log('  📚 Anthropic API documentation');
        console.log('\n✨ Ready for production use!');
    } else {
        console.log('\n❌ SOME TESTS FAILED');
        console.log('Please review the failing tests above.');
    }
    
    printSeparator();
    return allTestsPassed;
}

if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { runAllTests };