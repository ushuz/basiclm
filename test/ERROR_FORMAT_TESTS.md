# Error Format Tests

This directory contains comprehensive tests for API error format compliance.

## Test Files

### `error-format-unit-test.js`
Unit tests for the core error formatting logic. These tests verify that the error formatting functions produce the correct JSON structures for both OpenAI and Anthropic APIs.

Run with: `npm run test-error-formats-unit`

### `error-handling-integration-test.js` 
Integration tests that simulate the complete error handling flow. These tests verify that errors are properly formatted in realistic request scenarios.

Run with: `npm run test-error-handling`

### `error-format-test.js`
Live API tests that require a running server. These test actual HTTP error responses from the endpoints.

Run with: `npm run test-error-formats` (requires running VS Code extension)

### `error-format-compliance-test.js`
Comprehensive test suite that runs all error format tests and validates compliance with official API specifications.

Run with: `npm run test-error-compliance`

## Error Format Specifications

### OpenAI Format
```json
{
  "error": {
    "message": "Error description",
    "type": "error_type",
    "code": "400"
  }
}
```

**Supported OpenAI Error Types:**
- `invalid_request_error` - Invalid request (400)
- `authentication_error` - Invalid authentication (401)
- `permission_error` - Permission denied (403)
- `not_found_error` - Not found (404)
- `request_too_large` - Request entity too large (413)
- `rate_limit_exceeded` - Rate limit exceeded (429)
- `api_error` - Internal server error (500)
- `overloaded_error` - Server overloaded (503)

### Anthropic Format
```json
{
  "type": "error",
  "error": {
    "type": "error_type", 
    "message": "Error description"
  }
}
```

**Supported Anthropic Error Types:**
- `invalid_request_error` - Invalid request (400)
- `authentication_error` - Invalid authentication (401)
- `permission_error` - Permission denied (403)
- `not_found_error` - Not found (404)
- `rate_limit_error` - Rate limit exceeded (429)
- `api_error` - Internal server error (500)
- `overloaded_error` - Server overloaded (503)

**Note:** The implementation automatically uses the correct error type based on the API endpoint (OpenAI vs Anthropic) and maps VS Code language model errors to the appropriate official error types.

## Running All Tests

To run all error format tests:
```bash
npm run test-error-compliance
```

This will run both unit tests and integration tests, providing a comprehensive validation of error format compliance.