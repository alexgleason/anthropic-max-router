/**
 * EDUCATIONAL AND ENTERTAINMENT PURPOSES ONLY
 *
 * This software is provided for educational, research, and entertainment purposes only.
 * It is not affiliated with, endorsed by, or sponsored by Anthropic PBC.
 * Use at your own risk. No warranties provided. Users are solely responsible for
 * ensuring compliance with Anthropic's Terms of Service and all applicable laws.
 *
 * Copyright (c) 2025 - Licensed under MIT License
 */

/**
 * Token management - save, load, and refresh tokens
 */

import Conf from 'conf';
import fs from 'fs/promises';
import path from 'path';
import type { OAuthTokens } from './types.js';
import { refreshAccessToken } from './oauth.js';

// Global config store - tokens are saved in OS-specific config directory
// Linux/Mac: ~/.config/anthropic-max-router/
// Windows: %APPDATA%\anthropic-max-router\
const config = new Conf({
  projectName: 'anthropic-max-router',
  // Use JSON for human readability
  serialize: (value: unknown) => JSON.stringify(value, null, 2),
  deserialize: JSON.parse,
});

/**
 * Save tokens to global config
 */
export async function saveTokens(tokens: OAuthTokens): Promise<void> {
  config.set('tokens', tokens);
  console.log(`✅ Tokens saved to global config: ${config.path}`);
}

/**
 * Migrate tokens from old local file to global config (backwards compatibility)
 */
async function migrateOldTokens(): Promise<boolean> {
  const oldTokenFile = '.oauth-tokens.json';

  try {
    // Check if old token file exists
    const content = await fs.readFile(oldTokenFile, 'utf-8');
    const oldTokens = JSON.parse(content) as OAuthTokens;

    // Save to new global config
    config.set('tokens', oldTokens);
    console.log(`✅ Migrated tokens from ${oldTokenFile} to global config: ${config.path}`);
    console.log(`   You can safely delete ${oldTokenFile} now.`);

    return true;
  } catch {
    // Old file doesn't exist or couldn't be read - that's fine
    return false;
  }
}

/**
 * Load tokens from global config
 * Automatically migrates from old .oauth-tokens.json if found
 */
export async function loadTokens(): Promise<OAuthTokens | null> {
  // First try to load from global config
  let tokens = config.get('tokens') as OAuthTokens | undefined;

  // If no tokens in global config, try to migrate from old location
  if (!tokens) {
    const migrated = await migrateOldTokens();
    if (migrated) {
      tokens = config.get('tokens') as OAuthTokens | undefined;
    }
  }

  return tokens || null;
}

/**
 * Check if token is expired (with 5 minute buffer)
 */
export function isTokenExpired(tokens: OAuthTokens): boolean {
  if (!tokens.expires_at) {
    return true;
  }

  const buffer = 5 * 60 * 1000; // 5 minutes
  return Date.now() >= tokens.expires_at - buffer;
}

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string> {
  const tokens = await loadTokens();

  if (!tokens) {
    throw new Error('No tokens found. Please run OAuth flow first: npm run oauth');
  }

  if (isTokenExpired(tokens)) {
    console.log('🔄 Token expired, refreshing...');
    const newTokens = await refreshAccessToken(tokens.refresh_token);

    // Preserve refresh token if not returned
    if (!newTokens.refresh_token) {
      newTokens.refresh_token = tokens.refresh_token;
    }

    await saveTokens(newTokens);
    console.log('✅ Token refreshed');
    return newTokens.access_token;
  }

  return tokens.access_token;
}
