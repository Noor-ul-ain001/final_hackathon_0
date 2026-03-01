#!/usr/bin/env node

/**
 * Helper script to get your LinkedIn Person ID
 *
 * This script will try multiple endpoints to retrieve your LinkedIn member ID.
 *
 * Usage:
 *   node get-person-id.js YOUR_ACCESS_TOKEN
 *
 * Or set LINKEDIN_ACCESS_TOKEN environment variable:
 *   LINKEDIN_ACCESS_TOKEN=xxx node get-person-id.js
 */

const token = process.argv[2] || process.env.LINKEDIN_ACCESS_TOKEN;

if (!token) {
  console.error('Usage: node get-person-id.js YOUR_ACCESS_TOKEN');
  console.error('Or: LINKEDIN_ACCESS_TOKEN=xxx node get-person-id.js');
  process.exit(1);
}

async function tryGetPersonId() {
  console.log('Attempting to retrieve LinkedIn Person ID...\n');

  // Try /v2/userinfo (OpenID Connect)
  console.log('1. Trying /v2/userinfo (OpenID Connect)...');
  try {
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const text = await response.text();
    if (response.ok) {
      const data = JSON.parse(text);
      console.log('   SUCCESS! Your Person ID: ' + data.sub);
      console.log('   Full response:', JSON.stringify(data, null, 2));
      return data.sub;
    }
    console.log('   Failed:', response.status, text.substring(0, 200));
  } catch (e) {
    console.log('   Error:', e.message);
  }

  // Try /v2/me (Legacy)
  console.log('\n2. Trying /v2/me (Legacy API)...');
  try {
    const response = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    const text = await response.text();
    if (response.ok) {
      const data = JSON.parse(text);
      console.log('   SUCCESS! Your Person ID: ' + data.id);
      console.log('   Full response:', JSON.stringify(data, null, 2));
      return data.id;
    }
    console.log('   Failed:', response.status, text.substring(0, 200));
  } catch (e) {
    console.log('   Error:', e.message);
  }

  // Try /v2/me with version header
  console.log('\n3. Trying /v2/me with LinkedIn-Version header...');
  try {
    const response = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202401'
      }
    });
    const text = await response.text();
    if (response.ok) {
      const data = JSON.parse(text);
      console.log('   SUCCESS! Your Person ID: ' + data.id);
      console.log('   Full response:', JSON.stringify(data, null, 2));
      return data.id;
    }
    console.log('   Failed:', response.status, text.substring(0, 200));
  } catch (e) {
    console.log('   Error:', e.message);
  }

  // Try token introspection
  console.log('\n4. Trying token introspection...');
  try {
    const response = await fetch('https://www.linkedin.com/oauth/v2/introspectToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `token=${encodeURIComponent(token)}`
    });
    const text = await response.text();
    if (response.ok) {
      const data = JSON.parse(text);
      if (data.authorized_user) {
        console.log('   SUCCESS! Your Person ID: ' + data.authorized_user);
        return data.authorized_user;
      }
      console.log('   Response:', JSON.stringify(data, null, 2));
    }
    console.log('   Failed:', response.status, text.substring(0, 200));
  } catch (e) {
    console.log('   Error:', e.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Could not automatically retrieve your Person ID.');
  console.log('\nAlternative methods to get your LinkedIn Person ID:');
  console.log('');
  console.log('1. LinkedIn Developer Portal:');
  console.log('   - Go to https://www.linkedin.com/developers/apps');
  console.log('   - Select your app');
  console.log('   - Go to "Auth" tab > "OAuth 2.0 tools"');
  console.log('   - Generate a new token with "openid" and "profile" scopes');
  console.log('   - The response will include your member ID');
  console.log('');
  console.log('2. Check your LinkedIn profile URL:');
  console.log('   - Go to your LinkedIn profile');
  console.log('   - Look at the URL - it might contain your ID');
  console.log('   - Example: linkedin.com/in/john-doe-abc123');
  console.log('   - Note: This is your vanity URL, not necessarily the member ID');
  console.log('');
  console.log('3. View Page Source:');
  console.log('   - Go to your LinkedIn profile');
  console.log('   - Right-click and "View Page Source"');
  console.log('   - Search for "urn:li:fsd_profile:" or "publicIdentifier"');
  console.log('   - Your member ID should be there');
  console.log('');
  console.log('Once you have your Person ID, add it to mcp.json:');
  console.log('  "LINKEDIN_PERSON_ID": "your_person_id_here"');
  console.log('='.repeat(60));

  return null;
}

tryGetPersonId().then(personId => {
  if (personId) {
    console.log('\n' + '='.repeat(60));
    console.log('Add this to your mcp.json or .env:');
    console.log('');
    console.log(`  LINKEDIN_PERSON_ID=${personId}`);
    console.log('='.repeat(60));
  }
  process.exit(personId ? 0 : 1);
});
