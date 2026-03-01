#!/usr/bin/env node

/**
 * Facebook MCP Server
 * -------------------
 * Model Context Protocol server for Facebook Graph API operations.
 * Enables Claude Code to post to Facebook Pages.
 *
 * Uses Facebook Graph API v18.0:
 * - /{page-id}/feed - Create posts
 * - /{page-id}/photos - Upload photos
 * - /{page-id}/videos - Upload videos
 * - /{page-id}/insights - Get analytics
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const VAULT_PATH = process.env.VAULT_PATH || path.join(__dirname, '../../AI_Employee_Vault');
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const DRY_RUN = process.env.DRY_RUN === 'true';

// Facebook Graph API base URL
const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

// Cache for page info
let cachedPageInfo = null;

// Available tools
const TOOLS = [
  {
    name: 'facebook_create_post',
    description: 'Create and publish a post on a Facebook Page',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The text content of the post'
        },
        link: {
          type: 'string',
          description: 'Optional URL to share'
        },
        picture: {
          type: 'string',
          description: 'Optional thumbnail image URL for link posts'
        },
        published: {
          type: 'boolean',
          description: 'Whether to publish immediately (default: true)',
          default: true
        }
      },
      required: ['message']
    }
  },
  {
    name: 'facebook_create_photo_post',
    description: 'Create a photo post on a Facebook Page',
    inputSchema: {
      type: 'object',
      properties: {
        caption: {
          type: 'string',
          description: 'Caption for the photo'
        },
        image_url: {
          type: 'string',
          description: 'URL of the image to upload'
        },
        published: {
          type: 'boolean',
          description: 'Whether to publish immediately (default: true)',
          default: true
        }
      },
      required: ['caption', 'image_url']
    }
  },
  {
    name: 'facebook_get_page_info',
    description: 'Get information about the Facebook Page',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'facebook_get_post_insights',
    description: 'Get insights/analytics for a Facebook post',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'The ID of the post to get insights for'
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Metrics to retrieve (e.g., post_impressions, post_clicks)',
          default: ['post_impressions', 'post_clicks', 'post_reactions_like_total', 'post_comments', 'post_shares']
        }
      },
      required: ['post_id']
    }
  },
  {
    name: 'facebook_get_page_insights',
    description: 'Get insights/analytics for the Facebook Page',
    inputSchema: {
      type: 'object',
      properties: {
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Page metrics to retrieve',
          default: ['page_impressions', 'page_engaged_users', 'page_post_engagements', 'page_likes']
        },
        since: {
          type: 'string',
          description: 'Start date (ISO 8601)'
        },
        until: {
          type: 'string',
          description: 'End date (ISO 8601)'
        }
      },
      required: []
    }
  },
  {
    name: 'facebook_delete_post',
    description: 'Delete a post from Facebook',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'The ID of the post to delete'
        }
      },
      required: ['post_id']
    }
  },
  {
    name: 'instagram_create_post',
    description: 'Create and publish a post on an Instagram Business account (requires image URL — Instagram does not allow text-only posts via API)',
    inputSchema: {
      type: 'object',
      properties: {
        image_url: {
          type: 'string',
          description: 'Publicly accessible URL of the image to post'
        },
        caption: {
          type: 'string',
          description: 'Caption text with hashtags (5-15 hashtags recommended)'
        }
      },
      required: ['image_url', 'caption']
    }
  },
  {
    name: 'instagram_create_image_post',
    description: 'Create an Instagram image post with explicit image URL and caption (alias of instagram_create_post with required image URL)',
    inputSchema: {
      type: 'object',
      properties: {
        image_url: {
          type: 'string',
          description: 'Publicly accessible URL of the image'
        },
        caption: {
          type: 'string',
          description: 'Caption for the image post including hashtags'
        }
      },
      required: ['image_url', 'caption']
    }
  },
  {
    name: 'instagram_get_account_info',
    description: 'Get information about the Instagram Business account (username, followers, media count, biography)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'instagram_get_weekly_summary',
    description: 'Get weekly Instagram insights including impressions, reach, profile views, and recent media',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

/**
 * Get Facebook Page info (cached)
 */
async function getFacebookPageInfo() {
  if (cachedPageInfo) {
    return cachedPageInfo;
  }

  if (!FACEBOOK_ACCESS_TOKEN) {
    throw new Error('FACEBOOK_ACCESS_TOKEN not configured');
  }

  if (!FACEBOOK_PAGE_ID) {
    throw new Error('FACEBOOK_PAGE_ID not configured');
  }

  console.error('Fetching Facebook Page info...');

  try {
    const response = await fetch(`${GRAPH_API_BASE}/${FACEBOOK_PAGE_ID}?fields=id,name,username,about,followers_count,likes&access_token=${FACEBOOK_ACCESS_TOKEN}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Facebook API error: ${error.error?.message || response.statusText}`);
    }

    const pageInfo = await response.json();
    console.error('Facebook Page info:', JSON.stringify(pageInfo, null, 2));
    cachedPageInfo = pageInfo;
    return pageInfo;
  } catch (error) {
    console.error('Error fetching page info:', error.message);
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
    const logFile = path.join(logDir, `facebook_${today}.json`);

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
 * Create a Facebook text/link post
 */
async function createFacebookPost(message, link = null, picture = null, published = true) {
  const timestamp = new Date().toISOString();

  // In dry run mode, just log the action
  if (DRY_RUN) {
    console.error('[DRY RUN] Would post to Facebook:');
    console.error(`Message: ${message}`);
    console.error(`Link: ${link || 'none'}`);
    console.error(`Picture: ${picture || 'none'}`);

    const result = {
      success: true,
      dry_run: true,
      post_id: 'dry_run_' + Date.now(),
      url: 'https://facebook.com/dry-run',
      message: 'Dry run - post not actually created',
      posted_at: timestamp
    };

    await logToVault('FACEBOOK_POST_DRY_RUN', result);
    return result;
  }

  // Check for credentials
  if (!FACEBOOK_ACCESS_TOKEN) {
    throw new Error('Facebook credentials not configured. Set FACEBOOK_ACCESS_TOKEN in .env');
  }

  if (!FACEBOOK_PAGE_ID) {
    throw new Error('Facebook Page ID not configured. Set FACEBOOK_PAGE_ID in .env');
  }

  // Build post parameters
  const params = new URLSearchParams({
    message: message,
    access_token: FACEBOOK_ACCESS_TOKEN
  });

  if (link) {
    params.append('link', link);
  }

  if (picture) {
    params.append('picture', picture);
  }

  if (published === false) {
    params.append('published', 'false');
  }

  console.error(`Posting to Facebook Page: ${FACEBOOK_PAGE_ID}`);
  console.error(`Message: ${message.substring(0, 100)}...`);

  try {
    const response = await fetch(`${GRAPH_API_BASE}/${FACEBOOK_PAGE_ID}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const responseData = await response.json();
    console.error('Facebook API response:', response.status, JSON.stringify(responseData));

    if (!response.ok) {
      await logToVault('FACEBOOK_POST_ERROR', {
        error: responseData.error?.message || response.statusText,
        message
      });
      throw new Error(`Facebook API error: ${responseData.error?.message || response.statusText}`);
    }

    const postId = responseData.id;
    const postUrl = `https://www.facebook.com/${postId}`;

    const result = {
      success: true,
      post_id: postId,
      url: postUrl,
      posted_at: timestamp,
      message_length: message.length,
      link: link,
      picture: picture
    };

    // Log success
    await logToVault('FACEBOOK_POST_SUCCESS', result);

    // Save to Done folder
    const doneDir = path.join(VAULT_PATH, 'Done');
    if (!fs.existsSync(doneDir)) {
      fs.mkdirSync(doneDir, { recursive: true });
    }

    const logFile = path.join(doneDir, `FACEBOOK_POST_${Date.now()}.md`);
    const logContent = `---
type: facebook_post
status: posted
posted_at: ${timestamp}
post_id: ${postId}
url: ${postUrl}
---

# Facebook Post

${message}

${link ? `**Link:** ${link}\n` : ''}

---
**Posted successfully via Facebook Graph API**
`;

    fs.writeFileSync(logFile, logContent);
    result.log_file = logFile;

    return result;
  } catch (error) {
    console.error('Facebook post error:', error.message);
    throw error;
  }
}

/**
 * Create a Facebook photo post
 */
async function createFacebookPhotoPost(caption, imageUrl, published = true) {
  const timestamp = new Date().toISOString();

  // In dry run mode, just log the action
  if (DRY_RUN) {
    console.error('[DRY RUN] Would post photo to Facebook:');
    console.error(`Caption: ${caption}`);
    console.error(`Image URL: ${imageUrl}`);

    const result = {
      success: true,
      dry_run: true,
      post_id: 'dry_run_' + Date.now(),
      url: 'https://facebook.com/dry-run',
      message: 'Dry run - post not actually created',
      posted_at: timestamp
    };

    await logToVault('FACEBOOK_PHOTO_POST_DRY_RUN', result);
    return result;
  }

  // Check for credentials
  if (!FACEBOOK_ACCESS_TOKEN) {
    throw new Error('Facebook credentials not configured. Set FACEBOOK_ACCESS_TOKEN in .env');
  }

  if (!FACEBOOK_PAGE_ID) {
    throw new Error('Facebook Page ID not configured. Set FACEBOOK_PAGE_ID in .env');
  }

  console.error(`Posting photo to Facebook Page: ${FACEBOOK_PAGE_ID}`);
  console.error(`Caption: ${caption.substring(0, 100)}...`);
  console.error(`Image URL: ${imageUrl}`);

  try {
    // First, download the image
    console.error('Downloading image...');
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Upload photo using FormData
    const formData = new FormData();
    formData.append('source', new Blob([imageBuffer], { type: 'image/jpeg' }));
    formData.append('caption', caption);
    formData.append('access_token', FACEBOOK_ACCESS_TOKEN);
    formData.append('published', published ? 'true' : 'false');

    const response = await fetch(`${GRAPH_API_BASE}/${FACEBOOK_PAGE_ID}/photos`, {
      method: 'POST',
      body: formData
    });

    const responseData = await response.json();
    console.error('Facebook Photo API response:', response.status, JSON.stringify(responseData));

    if (!response.ok) {
      await logToVault('FACEBOOK_PHOTO_POST_ERROR', {
        error: responseData.error?.message || response.statusText,
        caption
      });
      throw new Error(`Facebook API error: ${responseData.error?.message || response.statusText}`);
    }

    const postId = responseData.id;
    const postUrl = `https://www.facebook.com/${postId}`;

    const result = {
      success: true,
      post_id: postId,
      url: postUrl,
      posted_at: timestamp,
      caption_length: caption.length,
      image_url: imageUrl
    };

    // Log success
    await logToVault('FACEBOOK_PHOTO_POST_SUCCESS', result);

    // Save to Done folder
    const doneDir = path.join(VAULT_PATH, 'Done');
    if (!fs.existsSync(doneDir)) {
      fs.mkdirSync(doneDir, { recursive: true });
    }

    const logFile = path.join(doneDir, `FACEBOOK_PHOTO_POST_${Date.now()}.md`);
    const logContent = `---
type: facebook_photo_post
status: posted
posted_at: ${timestamp}
post_id: ${postId}
url: ${postUrl}
image_url: ${imageUrl}
---

# Facebook Photo Post

**Caption:**

${caption}

**Image:** ${imageUrl}

---
**Posted successfully via Facebook Graph API**
`;

    fs.writeFileSync(logFile, logContent);
    result.log_file = logFile;

    return result;
  } catch (error) {
    console.error('Facebook photo post error:', error.message);
    throw error;
  }
}

/**
 * Get post insights/analytics
 */
async function getPostInsights(postId, metrics = null) {
  if (!FACEBOOK_ACCESS_TOKEN) {
    throw new Error('FACEBOOK_ACCESS_TOKEN not configured');
  }

  const requestedMetrics = metrics || ['post_impressions', 'post_clicks', 'post_reactions_like_total', 'post_comments', 'post_shares'];

  if (DRY_RUN) {
    return {
      success: true,
      dry_run: true,
      post_id: postId,
      metrics: requestedMetrics.reduce((acc, metric) => {
        acc[metric] = Math.floor(Math.random() * 100) + 10;
        return acc;
      }, {}),
      message: 'Dry run - mock insights'
    };
  }

  try {
    const metricsParam = requestedMetrics.join(',');
    const response = await fetch(`${GRAPH_API_BASE}/${postId}/insights?metric=${metricsParam}&access_token=${FACEBOOK_ACCESS_TOKEN}`);
    
    const responseData = await response.json();
    console.error('Facebook Insights response:', JSON.stringify(responseData));

    if (!response.ok) {
      return {
        success: false,
        error: responseData.error?.message || response.statusText,
        post_id: postId
      };
    }

    // Parse insights
    const insights = {};
    if (responseData.data) {
      responseData.data.forEach(item => {
        insights[item.name] = item.values.length > 0 ? item.values[0].value : 0;
      });
    }

    return {
      success: true,
      post_id: postId,
      insights,
      retrieved_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching post insights:', error.message);
    return {
      success: false,
      error: error.message,
      post_id: postId
    };
  }
}

/**
 * Get page insights/analytics
 */
async function getPageInsights(metrics = null, since = null, until = null) {
  if (!FACEBOOK_ACCESS_TOKEN) {
    throw new Error('FACEBOOK_ACCESS_TOKEN not configured');
  }

  const requestedMetrics = metrics || ['page_impressions', 'page_engaged_users', 'page_post_engagements', 'page_likes'];

  if (DRY_RUN) {
    return {
      success: true,
      dry_run: true,
      metrics: requestedMetrics.reduce((acc, metric) => {
        acc[metric] = Math.floor(Math.random() * 1000) + 100;
        return acc;
      }, {}),
      message: 'Dry run - mock page insights'
    };
  }

  try {
    const metricsParam = requestedMetrics.join(',');
    let url = `${GRAPH_API_BASE}/${FACEBOOK_PAGE_ID}/insights?metric=${metricsParam}&access_token=${FACEBOOK_ACCESS_TOKEN}`;
    
    if (since) {
      url += `&since=${since}`;
    }
    if (until) {
      url += `&until=${until}`;
    }

    const response = await fetch(url);
    const responseData = await response.json();
    console.error('Facebook Page Insights response:', JSON.stringify(responseData));

    if (!response.ok) {
      return {
        success: false,
        error: responseData.error?.message || response.statusText
      };
    }

    // Parse insights
    const insights = {};
    if (responseData.data) {
      responseData.data.forEach(item => {
        insights[item.name] = item.values.length > 0 ? item.values[0].value : 0;
      });
    }

    return {
      success: true,
      insights,
      retrieved_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching page insights:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a Facebook post
 */
async function deleteFacebookPost(postId) {
  const timestamp = new Date().toISOString();

  if (!FACEBOOK_ACCESS_TOKEN) {
    throw new Error('FACEBOOK_ACCESS_TOKEN not configured');
  }

  if (DRY_RUN) {
    console.error('[DRY RUN] Would delete Facebook post:', postId);
    return {
      success: true,
      dry_run: true,
      post_id: postId,
      message: 'Dry run - post not actually deleted'
    };
  }

  try {
    const response = await fetch(`${GRAPH_API_BASE}/${postId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        access_token: FACEBOOK_ACCESS_TOKEN
      })
    });

    // Facebook returns "true" on successful delete
    const result = response.ok || response.status === 200;

    if (result) {
      await logToVault('FACEBOOK_POST_DELETED', { post_id: postId });
      return {
        success: true,
        post_id: postId,
        deleted_at: timestamp
      };
    } else {
      throw new Error('Failed to delete post');
    }
  } catch (error) {
    console.error('Error deleting post:', error.message);
    return {
      success: false,
      error: error.message,
      post_id: postId
    };
  }
}

/**
 * Create an Instagram post (two-step: create container → publish)
 */
async function createInstagramPost(imageUrl, caption) {
  const timestamp = new Date().toISOString();

  if (DRY_RUN) {
    console.error('[DRY RUN] Would post to Instagram:');
    console.error(`Caption: ${caption}`);
    console.error(`Image URL: ${imageUrl}`);
    const result = {
      success: true,
      dry_run: true,
      post_id: 'dry_run_' + Date.now(),
      url: 'https://instagram.com/dry-run',
      message: 'Dry run - post not actually created',
      posted_at: timestamp
    };
    await logToVault('instagram_post_dry_run', result);
    return result;
  }

  if (!INSTAGRAM_ACCESS_TOKEN) {
    throw new Error('INSTAGRAM_ACCESS_TOKEN not configured. Set it in .env');
  }
  if (!INSTAGRAM_ACCOUNT_ID) {
    throw new Error('INSTAGRAM_ACCOUNT_ID not configured. Set it in .env');
  }

  console.error(`Creating Instagram media container for account: ${INSTAGRAM_ACCOUNT_ID}`);

  try {
    // Step 1: Create media container
    const containerParams = new URLSearchParams({
      image_url: imageUrl,
      caption: caption,
      access_token: INSTAGRAM_ACCESS_TOKEN
    });

    const containerResponse = await fetch(`${GRAPH_API_BASE}/${INSTAGRAM_ACCOUNT_ID}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: containerParams
    });

    const containerData = await containerResponse.json();
    console.error('Instagram container response:', containerResponse.status, JSON.stringify(containerData));

    if (!containerResponse.ok) {
      await logToVault('instagram_post_error', {
        error: containerData.error?.message || containerResponse.statusText,
        caption
      });
      throw new Error(`Instagram API error (container): ${containerData.error?.message || containerResponse.statusText}`);
    }

    const creationId = containerData.id;

    // Step 2: Publish the container
    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: INSTAGRAM_ACCESS_TOKEN
    });

    const publishResponse = await fetch(`${GRAPH_API_BASE}/${INSTAGRAM_ACCOUNT_ID}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishParams
    });

    const publishData = await publishResponse.json();
    console.error('Instagram publish response:', publishResponse.status, JSON.stringify(publishData));

    if (!publishResponse.ok) {
      await logToVault('instagram_post_error', {
        error: publishData.error?.message || publishResponse.statusText,
        creation_id: creationId
      });
      throw new Error(`Instagram API error (publish): ${publishData.error?.message || publishResponse.statusText}`);
    }

    const postId = publishData.id;
    const postUrl = `https://www.instagram.com/p/${postId}/`;

    const result = {
      success: true,
      post_id: postId,
      url: postUrl,
      posted_at: timestamp,
      caption_length: caption.length,
      image_url: imageUrl
    };

    await logToVault('instagram_post_success', result);

    // Save to Done folder
    const doneDir = path.join(VAULT_PATH, 'Done');
    if (!fs.existsSync(doneDir)) {
      fs.mkdirSync(doneDir, { recursive: true });
    }

    const logFile = path.join(doneDir, `INSTAGRAM_POST_${Date.now()}.md`);
    const logContent = `---
type: instagram_post
status: posted
posted_at: ${timestamp}
post_id: ${postId}
url: ${postUrl}
image_url: ${imageUrl}
---

# Instagram Post

**Caption:**

${caption}

**Image:** ${imageUrl}

---
**Posted successfully via Instagram Graph API**
`;

    fs.writeFileSync(logFile, logContent);
    result.log_file = logFile;

    return result;
  } catch (error) {
    console.error('Instagram post error:', error.message);
    throw error;
  }
}

/**
 * Get Instagram account information
 */
async function getInstagramAccountInfo() {
  if (!INSTAGRAM_ACCESS_TOKEN) {
    throw new Error('INSTAGRAM_ACCESS_TOKEN not configured');
  }
  if (!INSTAGRAM_ACCOUNT_ID) {
    throw new Error('INSTAGRAM_ACCOUNT_ID not configured');
  }

  if (DRY_RUN) {
    return {
      success: true,
      dry_run: true,
      id: INSTAGRAM_ACCOUNT_ID,
      username: 'dry_run_account',
      followers_count: 1000,
      media_count: 42,
      biography: 'Dry run mode'
    };
  }

  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/${INSTAGRAM_ACCOUNT_ID}?fields=id,username,followers_count,media_count,biography&access_token=${INSTAGRAM_ACCESS_TOKEN}`
    );

    const data = await response.json();
    console.error('Instagram account info:', JSON.stringify(data));

    if (!response.ok) {
      throw new Error(`Instagram API error: ${data.error?.message || response.statusText}`);
    }

    return { success: true, ...data, retrieved_at: new Date().toISOString() };
  } catch (error) {
    console.error('Error fetching Instagram account info:', error.message);
    throw error;
  }
}

/**
 * Get Instagram weekly insights and recent media
 */
async function getInstagramWeeklySummary() {
  if (!INSTAGRAM_ACCESS_TOKEN) {
    throw new Error('INSTAGRAM_ACCESS_TOKEN not configured');
  }
  if (!INSTAGRAM_ACCOUNT_ID) {
    throw new Error('INSTAGRAM_ACCOUNT_ID not configured');
  }

  if (DRY_RUN) {
    return {
      success: true,
      dry_run: true,
      insights: { impressions: 5000, reach: 3200, profile_views: 800 },
      recent_media: [],
      message: 'Dry run - mock weekly summary'
    };
  }

  try {
    // Get account insights for the past week
    const insightsResponse = await fetch(
      `${GRAPH_API_BASE}/${INSTAGRAM_ACCOUNT_ID}/insights?metric=impressions,reach,profile_views&period=week&access_token=${INSTAGRAM_ACCESS_TOKEN}`
    );

    const insightsData = await insightsResponse.json();
    console.error('Instagram insights:', JSON.stringify(insightsData));

    // Get recent media list
    const mediaResponse = await fetch(
      `${GRAPH_API_BASE}/${INSTAGRAM_ACCOUNT_ID}/media?fields=id,caption,media_type,timestamp,like_count,comments_count&limit=10&access_token=${INSTAGRAM_ACCESS_TOKEN}`
    );

    const mediaData = await mediaResponse.json();
    console.error('Instagram recent media:', JSON.stringify(mediaData));

    const insights = {};
    if (insightsData.data) {
      insightsData.data.forEach(item => {
        insights[item.name] = item.values.length > 0 ? item.values[0].value : 0;
      });
    }

    return {
      success: true,
      insights,
      recent_media: mediaData.data || [],
      retrieved_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching Instagram weekly summary:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle tool execution
 */
async function executeTool(toolName, args) {
  try {
    switch (toolName) {
      case 'facebook_create_post':
        return await createFacebookPost(
          args.message,
          args.link,
          args.picture,
          args.published !== false
        );

      case 'facebook_create_photo_post':
        return await createFacebookPhotoPost(
          args.caption,
          args.image_url,
          args.published !== false
        );

      case 'facebook_get_page_info':
        return await getFacebookPageInfo();

      case 'facebook_get_post_insights':
        return await getPostInsights(args.post_id, args.metrics);

      case 'facebook_get_page_insights':
        return await getPageInsights(args.metrics, args.since, args.until);

      case 'facebook_delete_post':
        return await deleteFacebookPost(args.post_id);

      case 'instagram_create_post':
      case 'instagram_create_image_post':
        return await createInstagramPost(args.image_url, args.caption);

      case 'instagram_get_account_info':
        return await getInstagramAccountInfo();

      case 'instagram_get_weekly_summary':
        return await getInstagramWeeklySummary();

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
  console.error('Facebook MCP Server starting...');
  console.error(`Vault path: ${VAULT_PATH}`);
  console.error(`Dry run mode: ${DRY_RUN}`);
  console.error(`Access token configured: ${FACEBOOK_ACCESS_TOKEN ? 'Yes (' + FACEBOOK_ACCESS_TOKEN.substring(0, 10) + '...)' : 'No'}`);
  console.error(`Page ID configured: ${FACEBOOK_PAGE_ID || 'No'}`);

  if (!FACEBOOK_ACCESS_TOKEN || !FACEBOOK_PAGE_ID) {
    console.error('⚠️  Facebook credentials not configured');
    console.error('   Posts will fail without FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID');
    console.error('   Set them in .env to enable posting');
  } else {
    // Try to fetch page info on startup to validate the token
    try {
      const pageInfo = await getFacebookPageInfo();
      console.error(`✅ Facebook connected to: ${pageInfo.name} (${pageInfo.followers_count || 0} followers)`);
    } catch (error) {
      console.error(`⚠️  Failed to validate Facebook token: ${error.message}`);
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

  console.error('Facebook MCP Server ready');
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
              name: 'facebook-mcp-server',
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
