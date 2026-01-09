# Test Suite

Comprehensive automated tests for the EtherNet/IP driver using the built-in PLC simulator.

## Running Tests

```bash
npm test
```

This will:
1. Automatically start the PLC simulator
2. Run all test cases
3. Stop the simulator
4. Report results

## Test Coverage

The test suite covers:

### Connection Tests
- ✅ Connection establishment
- ✅ Disconnection
- ✅ Reconnection
- ✅ Connection status checking
- ✅ Session handle management

### Data Type Tests
- ✅ BOOL (read/write)
- ✅ INT (read/write)
- ✅ DINT (read/write)
- ✅ UINT (read/write)
- ✅ REAL (read/write)
- ✅ STRING (read/write)

### Array Tests
- ✅ Reading arrays
- ✅ Writing arrays

### Advanced Tests
- ✅ Reading multiple tags
- ✅ Write and read back verification
- ✅ Large value handling
- ✅ Data type inference
- ✅ Tag information retrieval

### Error Handling Tests
- ✅ Invalid tag errors
- ✅ Not connected errors
- ✅ Error message validation

### Event Tests
- ✅ Connected event
- ✅ Disconnected event

## Test Structure

Each test:
1. Sets up required state
2. Performs the operation
3. Verifies the result
4. Cleans up if needed

## Adding New Tests

To add a new test:

1. Add a new test method to the `TestSuite` class:
```javascript
async testMyNewFeature() {
  console.log('Test: My New Feature');
  // Your test code here
  expectEqual(actual, expected, 'Description');
  console.log('');
}
```

2. Call it in `runTests()`:
```javascript
await this.testMyNewFeature();
```

## Test Output

Tests show:
- ✓ for passed tests
- ✗ for failed tests
- Summary with pass/fail counts
- List of failures (if any)

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test
```

## Notes

- Tests use the simulator, so no physical PLC is needed
- Tests run sequentially to avoid race conditions
- Each test is independent and cleans up after itself
- Test timeout is 10 seconds per test

