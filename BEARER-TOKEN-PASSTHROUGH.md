# Bearer Token Passthrough Feature

## Overview

The bearer token passthrough feature allows clients to use their own Anthropic API keys instead of the router's OAuth credentials. This is useful when:

- Tools already have valid Anthropic API keys
- You want requests to use different quota pools
- You want to mix OAuth MAX Plan usage with regular API usage

## Configuration

### Enable Passthrough (Default)
```bash
npm run router
# or explicitly
npm run router -- --allow-bearer-passthrough
```

### Disable Passthrough
```bash
npm run router -- --disable-bearer-passthrough
```

## Behavior

### When Passthrough is Enabled (Default)

| Client Request Has Bearer Token | Router Uses |
|--------------------------------|-------------|
| ✅ Yes | Client's bearer token (their quota) |
| ❌ No | Router's OAuth token (MAX Plan quota) |

### When Passthrough is Disabled

| Client Request Has Bearer Token | Router Uses |
|--------------------------------|-------------|
| ✅ Yes | Router's OAuth token (MAX Plan quota) |
| ❌ No | Router's OAuth token (MAX Plan quota) |

## Usage Examples

### Example 1: Using Client's API Key

Start the router with passthrough enabled (default):
```bash
npm run router
```

Make a request with your Anthropic API key:
```bash
curl -X POST http://localhost:45554/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANTHROPIC_API_KEY" \
  -d '{
    "model": "claude-sonnet-4",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**Result:** Uses your API key and your quota.

### Example 2: Force OAuth for All Requests

Start the router with passthrough disabled:
```bash
npm run router -- --disable-bearer-passthrough
```

Make a request (even with bearer token):
```bash
curl -X POST http://localhost:45554/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ANY_TOKEN_HERE" \
  -d '{
    "model": "claude-sonnet-4",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**Result:** Ignores the provided token and uses router's OAuth MAX Plan credentials.

### Example 3: OpenAI Format with Passthrough

Works with OpenAI-compatible endpoint too:
```bash
curl -X POST http://localhost:45554/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANTHROPIC_API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**Result:** Request is translated to Anthropic format and uses your API key.

## Logging

When running with `--verbose` flag, you'll see which authentication method is being used:

```bash
npm run router -- --verbose
```

Log output will show:
- `[Passthrough] Using client bearer token for request abc123` - when using client's token
- `[OAuth] Using router OAuth token for request abc123` - when using router's OAuth

## Use Cases

### Use Case 1: Development with Multiple Accounts
- Use passthrough to test with different API keys
- Each developer can use their own credentials
- Router still provides translation and system prompt injection

### Use Case 2: Mixed Usage
- Some tools use their own API keys (passthrough)
- Other tools without keys use MAX Plan (OAuth)
- Single router instance handles both scenarios

### Use Case 3: Migration Path
- Gradually migrate from API keys to OAuth
- Keep passthrough enabled during transition
- Tools work with either authentication method

## Technical Details

### Authentication Priority
1. If passthrough is enabled AND request has `Authorization: Bearer <token>` header
   - Extract and use the bearer token
2. Otherwise
   - Use router's OAuth access token
   - Auto-refresh OAuth token if expired

### System Prompt Injection
- System prompt "You are Claude Code..." is ALWAYS injected
- This happens regardless of authentication method
- Required for MAX Plan compatibility

### OAuth Token Management
- OAuth tokens are still required unless passthrough is enabled
- If no OAuth tokens exist and passthrough is enabled:
  - Router starts in "passthrough-only" mode
  - Only requests with bearer tokens will work
  - Requests without tokens will fail

## Environment Flags

```bash
# Authentication control
--allow-bearer-passthrough      # Enable passthrough (default)
--disable-bearer-passthrough    # Disable passthrough, force OAuth

# Can be combined with other flags
npm run router -- --verbose --disable-bearer-passthrough
npm run router -- --port 8080 --allow-bearer-passthrough
```

## Troubleshooting

### Issue: "Authentication error" when using bearer token
- **Check:** Is passthrough enabled? (It's enabled by default)
- **Solution:** Don't use `--disable-bearer-passthrough` flag

### Issue: Router uses OAuth instead of my bearer token
- **Check:** Is the `Authorization` header formatted correctly?
- **Format:** Must be exactly `Authorization: Bearer YOUR_TOKEN_HERE`
- **Solution:** Ensure "Bearer " prefix is present (with space after)

### Issue: Want to force all requests through OAuth
- **Solution:** Start with `npm run router -- --disable-bearer-passthrough`
