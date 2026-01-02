/**
 * Example: Testing the Anthropic MAX Plan Router
 *
 * This demonstrates how to send requests to the router.
 * Make sure the router is running first: npm run router
 */

async function testRouter() {
  const ROUTER_URL = 'http://localhost:45554';

  // Test 1: Health check
  console.log('Testing health endpoint...');
  const healthResponse = await fetch(`${ROUTER_URL}/health`);
  const health = await healthResponse.json();
  console.log('Health:', health);
  console.log('');

  // Test 2: Simple message (router will inject system prompt)
  console.log('Sending message without system prompt...');
  const response1 = await fetch(`${ROUTER_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Say hello in one sentence.' }
      ]
    })
  });

  const data1 = await response1.json();
  console.log('Response:', JSON.stringify(data1, null, 2));
  console.log('');

  // Test 3: Message with system prompt already included (router will not duplicate)
  console.log('Sending message with system prompt already present...');
  const response2 = await fetch(`${ROUTER_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 100,
      system: [
        { type: 'text', text: "You are Claude Code, Anthropic's official CLI for Claude." },
        { type: 'text', text: "You are also a helpful assistant." }
      ],
      messages: [
        { role: 'user', content: 'What are you?' }
      ]
    })
  });

  const data2 = await response2.json();
  console.log('Response:', JSON.stringify(data2, null, 2));
}

testRouter().catch(console.error);
