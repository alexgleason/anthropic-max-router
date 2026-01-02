#!/usr/bin/env node

/**
 * Test script for OpenAI API compatibility endpoint
 *
 * This script tests the /v1/chat/completions endpoint to verify:
 * - Basic request/response translation
 * - Model mapping
 * - Streaming support
 * - Error handling
 *
 * Usage:
 *   1. Start the router with OpenAI endpoint enabled:
 *      npm run router -- --enable-openai
 *
 *   2. Run this test script in another terminal:
 *      node test-openai-endpoint.js
 */

const BASE_URL = 'http://localhost:45554';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bold');
  console.log('='.repeat(60));
}

async function test1_BasicRequest() {
  section('TEST 1: Basic OpenAI Chat Completion Request');

  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "Hello from OpenAI compatibility!" in one short sentence.' }
        ],
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const error = await response.json();
      log(`❌ FAILED: ${response.status} - ${JSON.stringify(error)}`, 'red');
      return false;
    }

    const data = await response.json();

    log('✅ Request successful!', 'green');
    log(`Model requested: gpt-4`, 'cyan');
    log(`Response ID: ${data.id}`, 'cyan');
    log(`Model in response: ${data.model}`, 'cyan');
    log(`Content: ${data.choices[0].message.content}`, 'yellow');
    log(`Finish reason: ${data.choices[0].finish_reason}`, 'cyan');
    log(`Tokens - Prompt: ${data.usage.prompt_tokens}, Completion: ${data.usage.completion_tokens}, Total: ${data.usage.total_tokens}`, 'cyan');

    return true;
  } catch (error) {
    log(`❌ FAILED: ${error.message}`, 'red');
    return false;
  }
}

async function test2_ModelMapping() {
  section('TEST 2: Model Name Mapping');

  const models = [
    { input: 'gpt-4', expected: 'claude-sonnet-4-5' },
    { input: 'gpt-4o', expected: 'claude-sonnet-4-5' },
    { input: 'gpt-5', expected: 'claude-sonnet-4-5' },
    { input: 'o1-mini', expected: 'claude-sonnet-4-5' },
    { input: 'gpt-3.5-turbo', expected: 'claude-haiku-4-5' },
  ];

  log('Testing model mappings (check router logs for "Model: <claude-model>")', 'cyan');

  for (const { input, expected } of models) {
    try {
      const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: input,
          messages: [
            { role: 'user', content: 'Say hi' }
          ],
          max_tokens: 10
        })
      });

      if (response.ok) {
        const data = await response.json();
        log(`  ${input} → should map to ${expected} (returns model: ${data.model})`, 'green');
      } else {
        log(`  ${input} → FAILED (${response.status})`, 'red');
      }
    } catch (error) {
      log(`  ${input} → ERROR: ${error.message}`, 'red');
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  log('\n💡 Check the router terminal to verify the actual Claude models used', 'yellow');
  return true;
}

async function test3_StreamingRequest() {
  section('TEST 3: Streaming Response');

  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Count from 1 to 5, one number per line.' }
        ],
        stream: true,
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const error = await response.text();
      log(`❌ FAILED: ${response.status} - ${error}`, 'red');
      return false;
    }

    log('✅ Streaming started!', 'green');
    log('Received chunks:', 'cyan');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            log('  [DONE] marker received', 'green');
          } else {
            try {
              const chunk = JSON.parse(data);
              if (chunk.choices[0].delta.content) {
                process.stdout.write(chunk.choices[0].delta.content);
                chunkCount++;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    }

    console.log(); // New line
    log(`\n✅ Streaming complete! Received ${chunkCount} content chunks`, 'green');
    return true;
  } catch (error) {
    log(`❌ FAILED: ${error.message}`, 'red');
    return false;
  }
}

async function test4_ErrorHandling() {
  section('TEST 4: Error Handling (Unsupported Features)');

  // Test n > 1 (should error)
  try {
    log('Testing n > 1 (should error)...', 'cyan');
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        n: 2,
        max_tokens: 50
      })
    });

    const data = await response.json();

    if (!response.ok && data.error && data.error.message.includes('Multiple completions')) {
      log('✅ Correctly rejected n > 1', 'green');
      log(`  Error message: ${data.error.message}`, 'cyan');
    } else {
      log('❌ Should have rejected n > 1', 'red');
    }
  } catch (error) {
    log(`❌ FAILED: ${error.message}`, 'red');
  }

  // Test logprobs (should error)
  try {
    log('\nTesting logprobs (should error)...', 'cyan');
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        logprobs: true,
        max_tokens: 50
      })
    });

    const data = await response.json();

    if (!response.ok && data.error && data.error.message.includes('logprobs')) {
      log('✅ Correctly rejected logprobs', 'green');
      log(`  Error message: ${data.error.message}`, 'cyan');
    } else {
      log('❌ Should have rejected logprobs', 'red');
    }
  } catch (error) {
    log(`❌ FAILED: ${error.message}`, 'red');
  }

  return true;
}

async function test5_SystemPromptHandling() {
  section('TEST 5: System Prompt Handling');

  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a pirate.' },
          { role: 'system', content: 'You speak in riddles.' },
          { role: 'user', content: 'Who are you?' }
        ],
        max_tokens: 100
      })
    });

    if (!response.ok) {
      const error = await response.json();
      log(`❌ FAILED: ${response.status} - ${JSON.stringify(error)}`, 'red');
      return false;
    }

    const data = await response.json();

    log('✅ Multiple system messages handled!', 'green');
    log(`Response: ${data.choices[0].message.content}`, 'yellow');
    log('\n💡 Check router logs to verify system messages were combined', 'yellow');

    return true;
  } catch (error) {
    log(`❌ FAILED: ${error.message}`, 'red');
    return false;
  }
}

async function test6_HealthCheck() {
  section('TEST 6: Health Check Endpoint');

  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();

    if (response.ok && data.status === 'ok') {
      log('✅ Health check passed!', 'green');
      log(`Service: ${data.service}`, 'cyan');
      return true;
    } else {
      log('❌ Health check failed', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ FAILED: ${error.message}`, 'red');
    log('\n💡 Make sure the router is running!', 'yellow');
    return false;
  }
}

async function runAllTests() {
  log('\n' + '█'.repeat(60), 'bold');
  log('  OpenAI API Compatibility Test Suite', 'bold');
  log('█'.repeat(60) + '\n', 'bold');

  log('Prerequisites:', 'yellow');
  log('  1. Router must be running with: npm run router -- --enable-openai', 'yellow');
  log('  2. OAuth authentication must be completed', 'yellow');
  log('  3. Router should be on http://localhost:45554\n', 'yellow');

  const results = {
    passed: 0,
    failed: 0
  };

  // Test 6 first (health check) to verify router is running
  if (await test6_HealthCheck()) {
    results.passed++;
  } else {
    results.failed++;
    log('\n⚠️  Router not responding. Cannot continue tests.', 'red');
    log('Start the router with: npm run router -- --enable-openai\n', 'yellow');
    return;
  }

  // Run remaining tests
  const tests = [
    test1_BasicRequest,
    test2_ModelMapping,
    test3_StreamingRequest,
    test4_ErrorHandling,
    test5_SystemPromptHandling
  ];

  for (const test of tests) {
    if (await test()) {
      results.passed++;
    } else {
      results.failed++;
    }
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  section('TEST RESULTS');
  log(`Total tests: ${results.passed + results.failed}`, 'cyan');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');

  if (results.failed === 0) {
    log('\n🎉 All tests passed!', 'green');
  } else {
    log(`\n⚠️  ${results.failed} test(s) failed`, 'red');
  }

  console.log('\n');
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
