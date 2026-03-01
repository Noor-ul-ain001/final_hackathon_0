#!/usr/bin/env node

/**
 * LinkedIn MCP Server
 *
 * A Model Context Protocol server for LinkedIn operations.
 * Enables Claude Code to post content to LinkedIn.
 *
 * Uses LinkedIn API v2 for posting:
 * - /v2/userinfo - Get authenticated user info
 * - /v2/posts - Create posts (new API)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const VAULT_PATH = process.env.VAULT_PATH || path.join(__dirname, '../../AI_Employee_Vault');
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_PERSON_ID = process.env.LINKEDIN_PERSON_ID; // Optional: manually set person ID
const DRY_RUN = process.env.DRY_RUN === 'true';

// LinkedIn API base URLs
const LINKEDIN_API_BASE = 'https://api.linkedin.com';
const LINKEDIN_REST_API = 'https://api.linkedin.com/rest';

// Cache for user info
let cachedUserInfo = null;
let cachedPersonId = LINKEDIN_PERSON_ID || null;

// Available tools
const TOOLS = [
  {
    name: 'linkedin_create_post',
    description: 'Create and publish a text post on LinkedIn',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The text content of the post (max 3000 characters)'
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS'],
          description: 'Who can see this post (default: PUBLIC)'
        },
        hashtags: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of hashtags (without # symbol)',
          maxItems: 5
        }
      },
      required: ['content']
    }
  },
  {
    name: 'linkedin_get_profile',
    description: 'Get the authenticated LinkedIn user profile information',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'linkedin_get_post_analytics',
    description: 'Get analytics for a LinkedIn post (requires additional permissions)',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'The ID of the post to get analytics for'
        }
      },
      required: ['post_id']
    }
  }
];

/**
 * Get LinkedIn user info (cached) - tries multiple endpoints
 */
async function getLinkedInUserInfo() {
  if (cachedUserInfo) {
    return cachedUserInfo;
  }

  if (!LINKEDIN_ACCESS_TOKEN) {
    throw new Error('LINKEDIN_ACCESS_TOKEN not configured');
  }

  console.error('Fetching LinkedIn user info...');

  // Try OpenID Connect userinfo endpoint first
  try {
    const response = await fetch(`${LINKEDIN_API_BASE}/v2/userinfo`, {
      headers: {
        'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202301'
      }
    });

    if (response.ok) {
      const userInfo = await response.json();
      console.error('LinkedIn user info (userinfo):', JSON.stringify(userInfo, null, 2));
      cachedUserInfo = userInfo;
      cachedPersonId = userInfo.sub;
      return userInfo;
    }
    console.error('userinfo endpoint failed:', response.status);
  } catch (e) {
    console.error('userinfo endpoint error:', e.message);
  }

  // Try the /v2/me endpoint (older API)
  try {
    const response = await fetch(`${LINKEDIN_API_BASE}/v2/me`, {
      headers: {
        'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202301'
      }
    });

    if (response.ok) {
      const meInfo = await response.json();
      console.error('LinkedIn user info (/v2/me):', JSON.stringify(meInfo, null, 2));
      cachedUserInfo = {
        sub: meInfo.id,
        name: `${meInfo.localizedFirstName || ''} ${meInfo.localizedLastName || ''}`.trim(),
        given_name: meInfo.localizedFirstName,
        family_name: meInfo.localizedLastName
      };
      cachedPersonId = meInfo.id;
      return cachedUserInfo;
    }
    console.error('/v2/me endpoint failed:', response.status);
  } catch (e) {
    console.error('/v2/me endpoint error:', e.message);
  }

  // If we have a manually configured person ID, use that
  if (LINKEDIN_PERSON_ID) {
    console.error('Using manually configured LINKEDIN_PERSON_ID:', LINKEDIN_PERSON_ID);
    cachedUserInfo = {
      sub: LINKEDIN_PERSON_ID,
      name: 'LinkedIn User'
    };
    return cachedUserInfo;
  }

  throw new Error('Could not retrieve LinkedIn user info. The access token may not have the required scopes (openid, profile). Please regenerate the token with proper scopes or set LINKEDIN_PERSON_ID manually.');
}

/**
 * Get LinkedIn person URN
 */
async function getPersonUrn() {
  // If we have a cached person ID, use it
  if (cachedPersonId) {
    return `urn:li:person:${cachedPersonId}`;
  }

  try {
    const userInfo = await getLinkedInUserInfo();
    return `urn:li:person:${userInfo.sub}`;
  } catch (error) {
    // If we can't get user info but have a person ID, use it
    if (LINKEDIN_PERSON_ID) {
      return `urn:li:person:${LINKEDIN_PERSON_ID}`;
    }
    throw error;
  }
}

/**
 * Log action to vault
 */
async function logToVault(action, data) {
  try {
    const logDir = path.join(VAULT_PATH, 'Logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `linkedin_${today}.json`);

    let logs = [];
    if (fs.existsSync(logFile)) {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }

    logs.push({
      timestamp: new Date().toISOString(),
      action,
      data
    });

    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Failed to log to vault:', error.message);
  }
}

/**
 * Create a LinkedIn post - tries multiple API formats
 */
async function createLinkedInPost(content, visibility = 'PUBLIC', hashtags = []) {
  const timestamp = new Date().toISOString();

  // Add hashtags to content if provided
  let fullContent = content;
  if (hashtags && hashtags.length > 0) {
    const formattedHashtags = hashtags.map(tag => `#${tag.replace('#', '')}`).join(' ');
    fullContent = `${content}\n\n${formattedHashtags}`;
  }

  // In dry run mode, just log the action
  if (DRY_RUN) {
    console.error('[DRY RUN] Would post to LinkedIn:');
    console.error(`Content: ${fullContent}`);
    console.error(`Visibility: ${visibility}`);

    const result = {
      success: true,
      dry_run: true,
      post_id: 'dry_run_' + Date.now(),
      url: 'https://linkedin.com/posts/dry-run',
      message: 'Dry run - post not actually created',
      posted_at: timestamp
    };

    await logToVault('LINKEDIN_POST_DRY_RUN', result);
    return result;
  }

  // Check for credentials
  if (!LINKEDIN_ACCESS_TOKEN) {
    throw new Error('LinkedIn credentials not configured. Set LINKEDIN_ACCESS_TOKEN in .env');
  }

  // Get the author URN - this might fail if we don't have profile permissions
  let authorUrn;
  try {
    authorUrn = await getPersonUrn();
  } catch (error) {
    // If we can't get the person URN, we can't post
    throw new Error(`Cannot post without user ID: ${error.message}. Set LINKEDIN_PERSON_ID in .env to your LinkedIn member ID.`);
  }

  console.error(`Posting as: ${authorUrn}`);

  // Map visibility
  const visibilityValue = visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC';

  // Try the REST API first (newer, recommended)
  let result = await tryRestApiPost(authorUrn, fullContent, visibilityValue, timestamp);

  // If REST API fails, try the older UGC Posts API
  if (!result.success && result.error?.includes('403')) {
    console.error('REST API failed, trying UGC Posts API...');
    result = await tryUgcPostsApi(authorUrn, fullContent, visibilityValue, timestamp);
  }

  // If UGC also fails, try the shares API (legacy)
  if (!result.success && result.error?.includes('403')) {
    console.error('UGC API failed, trying legacy shares API...');
    result = await trySharesApi(authorUrn, fullContent, visibilityValue, timestamp);
  }

  if (result.success) {
    // Log success
    await logToVault('LINKEDIN_POST_SUCCESS', result);

    // Save to Done folder
    const doneDir = path.join(VAULT_PATH, 'Done');
    if (!fs.existsSync(doneDir)) {
      fs.mkdirSync(doneDir, { recursive: true });
    }

    const logFile = path.join(doneDir, `LINKEDIN_POST_${Date.now()}.md`);
    const logContent = `---
type: linkedin_post
status: posted
posted_at: ${timestamp}
post_id: ${result.post_id}
url: ${result.url}
visibility: ${visibilityValue}
---

# LinkedIn Post

${fullContent}

---
**Posted successfully via LinkedIn API**
`;

    fs.writeFileSync(logFile, logContent);
    result.log_file = logFile;
  } else {
    await logToVault('LINKEDIN_POST_ERROR', {
      error: result.error,
      content: fullContent
    });
  }

  return result;
}

/**
 * Try posting using the REST API (newer format)
 */
async function tryRestApiPost(authorUrn, content, visibility, timestamp) {
  try {
    const postBody = {
      author: authorUrn,
      commentary: content,
      visibility: visibility,
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: []
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false
    };

    console.error('Trying REST API (/rest/posts)...');
    console.error('Request body:', JSON.stringify(postBody, null, 2));

    const response = await fetch(`${LINKEDIN_REST_API}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(postBody)
    });

    const responseText = await response.text();
    console.error('REST API response:', response.status, responseText);

    if (!response.ok) {
      return { success: false, error: `${response.status}: ${responseText}` };
    }

    let postId = response.headers.get('x-restli-id') || response.headers.get('x-linkedin-id');
    if (responseText) {
      try {
        const data = JSON.parse(responseText);
        postId = postId || data.id || data.urn;
      } catch (e) {}
    }

    return {
      success: true,
      post_id: postId || `post_${Date.now()}`,
      url: `https://www.linkedin.com/feed/update/${postId}`,
      posted_at: timestamp,
      visibility,
      content_length: content.length,
      api_used: 'REST'
    };
  } catch (error) {
    console.error('REST API error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Try posting using UGC Posts API (v2)
 */
async function tryUgcPostsApi(authorUrn, content, visibility, timestamp) {
  try {
    const postBody = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': visibility
      }
    };

    console.error('Trying UGC Posts API (/v2/ugcPosts)...');
    console.error('Request body:', JSON.stringify(postBody, null, 2));

    const response = await fetch(`${LINKEDIN_API_BASE}/v2/ugcPosts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202301'
      },
      body: JSON.stringify(postBody)
    });

    const responseText = await response.text();
    console.error('UGC API response:', response.status, responseText);

    if (!response.ok) {
      return { success: false, error: `${response.status}: ${responseText}` };
    }

    let postId = response.headers.get('x-restli-id');
    if (responseText) {
      try {
        const data = JSON.parse(responseText);
        postId = postId || data.id;
      } catch (e) {}
    }

    return {
      success: true,
      post_id: postId || `ugc_${Date.now()}`,
      url: `https://www.linkedin.com/feed/update/${postId}`,
      posted_at: timestamp,
      visibility,
      content_length: content.length,
      api_used: 'UGC'
    };
  } catch (error) {
    console.error('UGC API error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Try posting using legacy Shares API
 */
async function trySharesApi(authorUrn, content, visibility, timestamp) {
  try {
    const postBody = {
      content: {
        contentEntities: [],
        title: content.substring(0, 100)
      },
      distribution: {
        linkedInDistributionTarget: {}
      },
      owner: authorUrn,
      subject: content.substring(0, 100),
      text: {
        text: content
      }
    };

    console.error('Trying Shares API (/v2/shares)...');
    console.error('Request body:', JSON.stringify(postBody, null, 2));

    const response = await fetch(`${LINKEDIN_API_BASE}/v2/shares`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202301'
      },
      body: JSON.stringify(postBody)
    });

    const responseText = await response.text();
    console.error('Shares API response:', response.status, responseText);

    if (!response.ok) {
      return { success: false, error: `${response.status}: ${responseText}` };
    }

    let postId = response.headers.get('x-restli-id');
    if (responseText) {
      try {
        const data = JSON.parse(responseText);
        postId = postId || data.id || data.activity;
      } catch (e) {}
    }

    return {
      success: true,
      post_id: postId || `share_${Date.now()}`,
      url: `https://www.linkedin.com/feed/update/${postId}`,
      posted_at: timestamp,
      visibility,
      content_length: content.length,
      api_used: 'Shares'
    };
  } catch (error) {
    console.error('Shares API error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get LinkedIn user profile
 */
async function getLinkedInProfile() {
  if (DRY_RUN) {
    return {
      success: true,
      dry_run: true,
      profile: {
        id: 'dry_run_user',
        name: 'Test User',
        email: 'test@example.com'
      }
    };
  }

  if (!LINKEDIN_ACCESS_TOKEN) {
    throw new Error('LINKEDIN_ACCESS_TOKEN not configured');
  }

  const userInfo = await getLinkedInUserInfo();

  return {
    success: true,
    profile: {
      id: userInfo.sub,
      name: userInfo.name,
      given_name: userInfo.given_name,
      family_name: userInfo.family_name,
      email: userInfo.email,
      picture: userInfo.picture,
      locale: userInfo.locale
    }
  };
}

/**
 * Get post analytics (requires Marketing Developer Platform access)
 */
async function getPostAnalytics(postId) {
  if (DRY_RUN) {
    return {
      success: true,
      dry_run: true,
      post_id: postId,
      views: 150,
      likes: 12,
      comments: 3,
      shares: 2,
      engagement_rate: 0.08,
      message: 'Dry run - mock analytics'
    };
  }

  // Note: Post analytics requires Marketing Developer Platform access
  // which has stricter approval requirements
  return {
    success: false,
    post_id: postId,
    message: 'Analytics requires Marketing Developer Platform access. Please check your LinkedIn app permissions.',
    documentation: 'https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/share-api'
  };
}

/**
 * Handle tool execution
 */
async function executeTool(toolName, args) {
  try {
    switch (toolName) {
      case 'linkedin_create_post':
        return await createLinkedInPost(
          args.content,
          args.visibility || 'PUBLIC',
          args.hashtags || []
        );

      case 'linkedin_get_profile':
        return await getLinkedInProfile();

      case 'linkedin_get_post_analytics':
        return await getPostAnalytics(args.post_id);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * MCP Server main loop
 */
async function main() {
  console.error('LinkedIn MCP Server starting...');
  console.error(`Vault path: ${VAULT_PATH}`);
  console.error(`Dry run mode: ${DRY_RUN}`);
  console.error(`Access token configured: ${LINKEDIN_ACCESS_TOKEN ? 'Yes (' + LINKEDIN_ACCESS_TOKEN.substring(0, 10) + '...)' : 'No'}`);

  if (!LINKEDIN_ACCESS_TOKEN) {
    console.error('⚠️  LinkedIn credentials not configured');
    console.error('   Posts will fail without LINKEDIN_ACCESS_TOKEN');
    console.error('   Set LINKEDIN_ACCESS_TOKEN in .env to enable posting');
  } else {
    // Try to fetch user info on startup to validate the token
    try {
      const userInfo = await getLinkedInUserInfo();
      console.error(`✅ LinkedIn connected as: ${userInfo.name} (${userInfo.email})`);
    } catch (error) {
      console.error(`⚠️  Failed to validate LinkedIn token: ${error.message}`);
    }
  }

  // MCP Protocol: Read JSON-RPC messages from stdin
  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk) => {
    buffer += chunk;

    // Process complete messages (newline-delimited JSON)
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const request = JSON.parse(line);
        const response = await handleRequest(request);
        console.log(JSON.stringify(response));
      } catch (error) {
        console.error('Error processing request:', error);
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error'
          }
        }));
      }
    }
  });

  console.error('LinkedIn MCP Server ready');
}

/**
 * Handle JSON-RPC requests
 */
async function handleRequest(request) {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '0.1.0',
            serverInfo: {
              name: 'linkedin-mcp-server',
              version: '1.0.0'
            },
            capabilities: {
              tools: {}
            }
          }
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS
          }
        };

      case 'tools/call':
        const result = await executeTool(params.name, params.arguments || {});
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        };

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message
      }
    };
  }
}

// Start the server
main().catch(console.error);
