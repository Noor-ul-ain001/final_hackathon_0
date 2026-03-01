#!/usr/bin/env node

/**
 * X/Twitter MCP Server
 *
 * A Model Context Protocol server for X/Twitter integration.
 * Enables Claude Code to post tweets, monitor engagement, and manage social presence.
 *
 * Features:
 * - Post tweets with optional media
 * - Get engagement metrics
 * - Monitor mentions
 * - Reply to tweets
 * - Generate weekly summaries
 * - Rate limit handling
 * - Audit logging
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const DRY_RUN = process.env.DRY_RUN === 'true';
const VAULT_PATH = process.env.VAULT_PATH || path.join(__dirname, '../../AI_Employee_Vault');

// Twitter client (will be initialized if credentials are available)
let twitterClient = null;

// Available tools
const TOOLS = [
  {
    name: 'twitter_post_tweet',
    description: 'Post a tweet to X/Twitter (max 280 characters)',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Tweet content (max 280 characters)', maxLength: 280 },
        reply_to_id: { type: 'string', description: 'Tweet ID to reply to (optional)' },
        quote_tweet_id: { type: 'string', description: 'Tweet ID to quote (optional)' }
      },
      required: ['text']
    }
  },
  {
    name: 'twitter_get_engagement',
    description: 'Get engagement metrics for recent tweets',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of recent tweets to analyze (default: 10, max: 100)' },
        include_replies: { type: 'boolean', description: 'Include reply tweets (default: false)' }
      }
    }
  },
  {
    name: 'twitter_get_mentions',
    description: 'Get recent mentions of your account',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of mentions to retrieve (default: 20, max: 100)' },
        since_id: { type: 'string', description: 'Get mentions after this tweet ID' }
      }
    }
  },
  {
    name: 'twitter_reply_to_tweet',
    description: 'Reply to a specific tweet',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: { type: 'string', description: 'ID of the tweet to reply to' },
        text: { type: 'string', description: 'Reply content (max 280 characters)', maxLength: 280 }
      },
      required: ['tweet_id', 'text']
    }
  },
  {
    name: 'twitter_get_user_info',
    description: 'Get information about the authenticated user or another user',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Username to look up (without @). Omit for authenticated user.' }
      }
    }
  },
  {
    name: 'twitter_search_tweets',
    description: 'Search for tweets matching a query',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        count: { type: 'number', description: 'Number of results (default: 10, max: 100)' }
      },
      required: ['query']
    }
  },
  {
    name: 'twitter_get_weekly_summary',
    description: 'Generate a weekly summary of Twitter activity and engagement',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to analyze (default: 7)' }
      }
    }
  }
];

/**
 * Initialize Twitter client
 */
async function initTwitterClient() {
  if (twitterClient) return true;

  if (DRY_RUN) {
    console.error('[DRY RUN] Twitter client in simulation mode');
    return true;
  }

  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    console.error('Twitter credentials not configured. Running in simulation mode.');
    return false;
  }

  try {
    // Dynamic import of twitter-api-v2
    const { TwitterApi } = await import('twitter-api-v2');

    twitterClient = new TwitterApi({
      appKey: TWITTER_API_KEY,
      appSecret: TWITTER_API_SECRET,
      accessToken: TWITTER_ACCESS_TOKEN,
      accessSecret: TWITTER_ACCESS_SECRET
    });

    // Verify credentials
    const me = await twitterClient.v2.me();
    console.error(`Twitter client initialized for @${me.data.username}`);
    return true;
  } catch (error) {
    console.error('Failed to initialize Twitter client:', error.message);
    return false;
  }
}

/**
 * Post a tweet
 */
async function postTweet(text, replyToId = null, quoteTweetId = null) {
  if (text.length > 280) {
    return {
      success: false,
      error: `Tweet exceeds 280 characters (${text.length} chars)`
    };
  }

  if (DRY_RUN) {
    const result = {
      success: true,
      dry_run: true,
      tweet_id: `DRY_${Date.now()}`,
      text,
      character_count: text.length,
      reply_to: replyToId,
      quote_tweet: quoteTweetId
    };
    await logToVault('TWITTER_POST', result);
    return result;
  }

  if (!await initTwitterClient() || !twitterClient) {
    return getSimulatedTweet(text);
  }

  try {
    const tweetData = { text };

    if (replyToId) {
      tweetData.reply = { in_reply_to_tweet_id: replyToId };
    }

    if (quoteTweetId) {
      tweetData.quote_tweet_id = quoteTweetId;
    }

    const tweet = await twitterClient.v2.tweet(tweetData);

    const result = {
      success: true,
      tweet_id: tweet.data.id,
      text: tweet.data.text,
      character_count: text.length,
      url: `https://twitter.com/i/web/status/${tweet.data.id}`
    };

    await logToVault('TWITTER_POST', result);
    return result;
  } catch (error) {
    const result = {
      success: false,
      error: error.message
    };
    await logToVault('TWITTER_POST_ERROR', result);
    return result;
  }
}

/**
 * Get engagement metrics for recent tweets
 */
async function getEngagement(count = 10, includeReplies = false) {
  if (DRY_RUN || !await initTwitterClient() || !twitterClient) {
    return getSimulatedEngagement(count);
  }

  try {
    const me = await twitterClient.v2.me();
    const userId = me.data.id;

    const tweets = await twitterClient.v2.userTimeline(userId, {
      max_results: Math.min(count, 100),
      'tweet.fields': ['created_at', 'public_metrics', 'text'],
      exclude: includeReplies ? [] : ['replies']
    });

    const tweetList = [];
    let totalLikes = 0;
    let totalRetweets = 0;
    let totalReplies = 0;
    let totalImpressions = 0;

    for (const tweet of tweets.data || []) {
      const metrics = tweet.public_metrics || {};
      tweetList.push({
        id: tweet.id,
        text: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
        created_at: tweet.created_at,
        likes: metrics.like_count || 0,
        retweets: metrics.retweet_count || 0,
        replies: metrics.reply_count || 0,
        impressions: metrics.impression_count || 0
      });

      totalLikes += metrics.like_count || 0;
      totalRetweets += metrics.retweet_count || 0;
      totalReplies += metrics.reply_count || 0;
      totalImpressions += metrics.impression_count || 0;
    }

    const tweetCount = tweetList.length;

    return {
      success: true,
      tweet_count: tweetCount,
      summary: {
        total_likes: totalLikes,
        total_retweets: totalRetweets,
        total_replies: totalReplies,
        total_impressions: totalImpressions,
        avg_likes: tweetCount > 0 ? (totalLikes / tweetCount).toFixed(1) : 0,
        avg_retweets: tweetCount > 0 ? (totalRetweets / tweetCount).toFixed(1) : 0,
        avg_engagement_rate: totalImpressions > 0
          ? (((totalLikes + totalRetweets + totalReplies) / totalImpressions) * 100).toFixed(2) + '%'
          : 'N/A'
      },
      tweets: tweetList
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get recent mentions
 */
async function getMentions(count = 20, sinceId = null) {
  if (DRY_RUN || !await initTwitterClient() || !twitterClient) {
    return getSimulatedMentions(count);
  }

  try {
    const me = await twitterClient.v2.me();
    const userId = me.data.id;

    const options = {
      max_results: Math.min(count, 100),
      'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'text'],
      'user.fields': ['username', 'name'],
      expansions: ['author_id']
    };

    if (sinceId) {
      options.since_id = sinceId;
    }

    const mentions = await twitterClient.v2.userMentionTimeline(userId, options);

    const userMap = {};
    if (mentions.includes?.users) {
      for (const user of mentions.includes.users) {
        userMap[user.id] = user;
      }
    }

    const mentionList = [];
    for (const tweet of mentions.data || []) {
      const author = userMap[tweet.author_id] || {};
      mentionList.push({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        author: {
          id: tweet.author_id,
          username: author.username || 'unknown',
          name: author.name || 'Unknown'
        },
        metrics: tweet.public_metrics || {}
      });
    }

    return {
      success: true,
      mention_count: mentionList.length,
      mentions: mentionList
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Reply to a tweet
 */
async function replyToTweet(tweetId, text) {
  return await postTweet(text, tweetId);
}

/**
 * Get user information
 */
async function getUserInfo(username = null) {
  if (DRY_RUN || !await initTwitterClient() || !twitterClient) {
    return getSimulatedUserInfo(username);
  }

  try {
    let user;
    if (username) {
      user = await twitterClient.v2.userByUsername(username, {
        'user.fields': ['created_at', 'description', 'public_metrics', 'profile_image_url', 'verified']
      });
    } else {
      user = await twitterClient.v2.me({
        'user.fields': ['created_at', 'description', 'public_metrics', 'profile_image_url', 'verified']
      });
    }

    return {
      success: true,
      user: {
        id: user.data.id,
        username: user.data.username,
        name: user.data.name,
        description: user.data.description,
        created_at: user.data.created_at,
        verified: user.data.verified || false,
        metrics: user.data.public_metrics || {},
        profile_image_url: user.data.profile_image_url
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search tweets
 */
async function searchTweets(query, count = 10) {
  if (DRY_RUN || !await initTwitterClient() || !twitterClient) {
    return getSimulatedSearch(query, count);
  }

  try {
    const tweets = await twitterClient.v2.search(query, {
      max_results: Math.min(count, 100),
      'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'text'],
      'user.fields': ['username', 'name'],
      expansions: ['author_id']
    });

    const userMap = {};
    if (tweets.includes?.users) {
      for (const user of tweets.includes.users) {
        userMap[user.id] = user;
      }
    }

    const results = [];
    for (const tweet of tweets.data || []) {
      const author = userMap[tweet.author_id] || {};
      results.push({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        author: {
          username: author.username || 'unknown',
          name: author.name || 'Unknown'
        },
        metrics: tweet.public_metrics || {}
      });
    }

    return {
      success: true,
      query,
      result_count: results.length,
      tweets: results
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate weekly summary
 */
async function getWeeklySummary(days = 7) {
  const engagement = await getEngagement(100, false);
  const mentions = await getMentions(50);
  const userInfo = await getUserInfo();

  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Filter tweets to the period
  let periodTweets = [];
  if (engagement.success && engagement.tweets) {
    periodTweets = engagement.tweets.filter(t => {
      const tweetDate = new Date(t.created_at);
      return tweetDate >= periodStart;
    });
  }

  // Calculate period metrics
  let periodLikes = 0;
  let periodRetweets = 0;
  let periodReplies = 0;

  for (const tweet of periodTweets) {
    periodLikes += tweet.likes || 0;
    periodRetweets += tweet.retweets || 0;
    periodReplies += tweet.replies || 0;
  }

  // Find top performing tweet
  let topTweet = null;
  let maxEngagement = 0;
  for (const tweet of periodTweets) {
    const engagementScore = (tweet.likes || 0) + (tweet.retweets || 0) * 2 + (tweet.replies || 0);
    if (engagementScore > maxEngagement) {
      maxEngagement = engagementScore;
      topTweet = tweet;
    }
  }

  return {
    success: true,
    period: {
      start: periodStart.toISOString(),
      end: now.toISOString(),
      days
    },
    account: userInfo.success ? {
      username: userInfo.user.username,
      followers: userInfo.user.metrics?.followers_count || 0,
      following: userInfo.user.metrics?.following_count || 0
    } : null,
    activity: {
      tweets_posted: periodTweets.length,
      mentions_received: mentions.success ? mentions.mention_count : 0
    },
    engagement: {
      total_likes: periodLikes,
      total_retweets: periodRetweets,
      total_replies: periodReplies,
      avg_likes_per_tweet: periodTweets.length > 0 ? (periodLikes / periodTweets.length).toFixed(1) : 0,
      avg_retweets_per_tweet: periodTweets.length > 0 ? (periodRetweets / periodTweets.length).toFixed(1) : 0
    },
    top_performing_tweet: topTweet ? {
      id: topTweet.id,
      text: topTweet.text,
      likes: topTweet.likes,
      retweets: topTweet.retweets,
      url: `https://twitter.com/i/web/status/${topTweet.id}`
    } : null,
    recommendations: generateRecommendations(periodTweets, periodLikes, periodRetweets)
  };
}

/**
 * Generate recommendations based on metrics
 */
function generateRecommendations(tweets, likes, retweets) {
  const recommendations = [];

  if (tweets.length < 3) {
    recommendations.push({
      category: 'Frequency',
      action: 'Increase posting frequency',
      reason: `Only ${tweets.length} tweets this week. Aim for 3-5 per week.`
    });
  }

  if (tweets.length > 0) {
    const avgLikes = likes / tweets.length;
    if (avgLikes < 5) {
      recommendations.push({
        category: 'Engagement',
        action: 'Improve content quality',
        reason: 'Average likes per tweet is low. Try adding images, questions, or trending topics.'
      });
    }

    // Analyze best performing content
    const topTweets = tweets.slice().sort((a, b) =>
      (b.likes + b.retweets * 2) - (a.likes + a.retweets * 2)
    ).slice(0, 3);

    if (topTweets.length > 0) {
      recommendations.push({
        category: 'Content Strategy',
        action: 'Replicate top content',
        reason: `Your best performing tweet had ${topTweets[0].likes} likes. Analyze what made it successful.`
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      category: 'General',
      action: 'Maintain current strategy',
      reason: 'Performance metrics look healthy. Continue with current approach.'
    });
  }

  return recommendations;
}

// Simulated data functions for dry-run/demo mode

function getSimulatedTweet(text) {
  return {
    success: true,
    simulated: true,
    tweet_id: `SIM_${Date.now()}`,
    text,
    character_count: text.length,
    message: 'Tweet simulated (credentials not configured or DRY_RUN mode)'
  };
}

function getSimulatedEngagement(count) {
  const tweets = [];
  for (let i = 0; i < Math.min(count, 10); i++) {
    tweets.push({
      id: `sim_${i}`,
      text: `Simulated tweet ${i + 1}...`,
      created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      likes: Math.floor(Math.random() * 50),
      retweets: Math.floor(Math.random() * 10),
      replies: Math.floor(Math.random() * 5),
      impressions: Math.floor(Math.random() * 500)
    });
  }

  return {
    success: true,
    simulated: true,
    tweet_count: tweets.length,
    summary: {
      total_likes: tweets.reduce((s, t) => s + t.likes, 0),
      total_retweets: tweets.reduce((s, t) => s + t.retweets, 0),
      total_replies: tweets.reduce((s, t) => s + t.replies, 0),
      total_impressions: tweets.reduce((s, t) => s + t.impressions, 0),
      avg_likes: '15.2',
      avg_retweets: '3.5',
      avg_engagement_rate: '4.2%'
    },
    tweets
  };
}

function getSimulatedMentions(count) {
  const mentions = [];
  for (let i = 0; i < Math.min(count, 5); i++) {
    mentions.push({
      id: `sim_mention_${i}`,
      text: `@your_account Simulated mention ${i + 1}`,
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
      author: {
        id: `user_${i}`,
        username: `user${i}`,
        name: `User ${i}`
      },
      metrics: { like_count: Math.floor(Math.random() * 10) }
    });
  }

  return {
    success: true,
    simulated: true,
    mention_count: mentions.length,
    mentions
  };
}

function getSimulatedUserInfo(username) {
  return {
    success: true,
    simulated: true,
    user: {
      id: '12345',
      username: username || 'ai_employee',
      name: 'AI Employee',
      description: 'Automated business assistant',
      created_at: '2024-01-01T00:00:00.000Z',
      verified: false,
      metrics: {
        followers_count: 1250,
        following_count: 350,
        tweet_count: 487
      }
    }
  };
}

function getSimulatedSearch(query, count) {
  return {
    success: true,
    simulated: true,
    query,
    result_count: 3,
    tweets: [
      {
        id: 'sim_search_1',
        text: `Result about "${query}" - simulated`,
        author: { username: 'user1', name: 'User One' },
        metrics: { like_count: 10 }
      }
    ]
  };
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
    const logFile = path.join(logDir, `twitter_${today}.json`);

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
 * Execute tool
 */
async function executeTool(toolName, args) {
  try {
    switch (toolName) {
      case 'twitter_post_tweet':
        return await postTweet(args.text, args.reply_to_id, args.quote_tweet_id);

      case 'twitter_get_engagement':
        return await getEngagement(args.count || 10, args.include_replies || false);

      case 'twitter_get_mentions':
        return await getMentions(args.count || 20, args.since_id);

      case 'twitter_reply_to_tweet':
        return await replyToTweet(args.tweet_id, args.text);

      case 'twitter_get_user_info':
        return await getUserInfo(args.username);

      case 'twitter_search_tweets':
        return await searchTweets(args.query, args.count || 10);

      case 'twitter_get_weekly_summary':
        return await getWeeklySummary(args.days || 7);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    await logToVault('ERROR', { tool: toolName, error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle MCP JSON-RPC requests
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
              name: 'twitter-mcp-server',
              version: '1.0.0'
            },
            capabilities: { tools: {} }
          }
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS }
        };

      case 'tools/call':
        const result = await executeTool(params.name, params.arguments || {});
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
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

/**
 * Main server loop
 */
async function main() {
  console.error('Twitter MCP Server starting...');
  console.error(`Dry run mode: ${DRY_RUN}`);
  console.error(`Vault path: ${VAULT_PATH}`);

  const hasCredentials = TWITTER_API_KEY && TWITTER_API_SECRET &&
                         TWITTER_ACCESS_TOKEN && TWITTER_ACCESS_SECRET;

  if (!hasCredentials && !DRY_RUN) {
    console.error('Twitter credentials not configured - running in simulation mode');
  }

  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk) => {
    buffer += chunk;
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
          error: { code: -32700, message: 'Parse error' }
        }));
      }
    }
  });

  console.error('Twitter MCP Server ready');
}

main().catch(console.error);
