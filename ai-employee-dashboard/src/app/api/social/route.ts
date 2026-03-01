import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from main project
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(process.cwd(), '..');
config({ path: path.join(PROJECT_ROOT, '.env') });

const VAULT_PATH = path.join(PROJECT_ROOT, 'AI_Employee_Vault');
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Groq API configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Generate content using Groq AI
async function generateWithGroq(topic: string, platform: 'twitter' | 'linkedin', postType: string): Promise<{ content: string; hashtags: string[] } | null> {
  if (!GROQ_API_KEY) {
    console.log('GROQ_API_KEY not found, falling back to templates');
    return null;
  }

  const maxChars = platform === 'twitter' ? 250 : 2500;
  const platformName = platform === 'twitter' ? 'X (Twitter)' : 'LinkedIn';

  const systemPrompt = `You are a professional social media content creator. Create engaging ${platformName} posts that are authentic, valuable, and drive engagement. Never use placeholder text or generic phrases like "[Your Company]" - write complete, ready-to-post content.`;

  const userPrompt = platform === 'twitter'
    ? `Create a ${postType} tweet about "${topic}".

Requirements:
- Maximum ${maxChars} characters (strict limit)
- Engaging and conversational tone
- Include 1-2 relevant emojis
- End with a call-to-action or question
- Do NOT include hashtags in the main content (they'll be added separately)

Return ONLY the tweet text, nothing else.`
    : `Create a ${postType} LinkedIn post about "${topic}".

Requirements:
- Professional yet engaging tone
- Use line breaks for readability
- Include 2-3 relevant emojis
- Structure with a hook, value content, and call-to-action
- Maximum ${maxChars} characters
- Do NOT include hashtags in the main content (they'll be added separately)

Return ONLY the post text, nothing else.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      console.error('Groq API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return null;
    }

    // Generate hashtags
    const hashtagPrompt = `Generate 4-5 relevant hashtags for a ${platformName} post about "${topic}".
Return ONLY the hashtags separated by spaces, without the # symbol. Example: AI Automation Business Tech`;

    const hashtagResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'user', content: hashtagPrompt }
        ],
        max_tokens: 50,
        temperature: 0.5,
      }),
    });

    let hashtags = ['Business', 'Innovation'];
    if (hashtagResponse.ok) {
      const hashtagData = await hashtagResponse.json();
      const hashtagText = hashtagData.choices?.[0]?.message?.content?.trim() || '';
      hashtags = hashtagText
        .replace(/#/g, '')
        .split(/[\s,]+/)
        .filter((tag: string) => tag.length > 0 && tag.length < 30)
        .slice(0, 5);
    }

    return { content, hashtags };
  } catch (error) {
    console.error('Groq API error:', error);
    return null;
  }
}

// AI-generated post templates based on business context
const POST_TEMPLATES = {
  twitter: {
    insight: [
      "🚀 {topic} is transforming how businesses operate. Here's what you need to know: {insight}\n\n#AI #Automation #Business",
      "💡 Quick tip for {audience}: {tip}\n\nThis simple change can save you hours every week.\n\n#Productivity #BusinessTips",
      "📊 The data is clear: {statistic}\n\nAre you adapting to this shift? {callToAction}\n\n#Digital #Growth",
    ],
    engagement: [
      "What's your biggest challenge with {topic}? 🤔\n\nDrop a comment below - I'd love to hear your experience!\n\n#Community #Discussion",
      "Poll: How do you handle {task}?\n\n🅰️ Manual process\n🅱️ Partial automation\n🅲️ Fully automated\n🅳️ What's that?\n\n#Poll #Tech",
      "Agree or disagree: {statement}\n\nShare your thoughts! 👇\n\n#Debate #Opinion",
    ],
    promotional: [
      "🎯 Struggling with {painPoint}?\n\nOur AI-powered solution helps you {benefit}.\n\nLearn more: {link}\n\n#Solution #AI",
      "✨ Just helped a client {achievement}!\n\nHere's how we did it: {howTo}\n\n#CaseStudy #Success",
    ]
  },
  linkedin: {
    insight: [
      "🔍 Industry Insight\n\n{topic} is no longer optional for businesses looking to scale.\n\nHere's what I've learned working with {industry} clients:\n\n1️⃣ {point1}\n2️⃣ {point2}\n3️⃣ {point3}\n\nWhat's your experience with {topic}?\n\n#BusinessGrowth #Innovation #Leadership",
      "📈 The Future of {industry}\n\nI've been analyzing trends and one thing is clear: {insight}\n\nCompanies that adapt early will have a significant advantage.\n\nHere's why:\n\n{explanation}\n\nThoughts? Let's discuss in the comments.\n\n#FutureOfWork #Strategy #Technology",
    ],
    casestudy: [
      "🎯 Client Success Story\n\nChallenge: {challenge}\n\nSolution: {solution}\n\nResult: {result}\n\n---\n\nThis transformation was possible because {reason}.\n\nIf you're facing similar challenges, let's connect.\n\n#CaseStudy #Results #BusinessTransformation",
    ],
    thought_leadership: [
      "💭 A thought that's been on my mind...\n\n{thought}\n\nAs someone who works in {field}, I've seen this play out countless times.\n\nThe key takeaway: {takeaway}\n\nDo you agree? I'd love to hear different perspectives.\n\n#ThoughtLeadership #Professional #Insights",
    ],
    engagement: [
      "📊 Quick Poll for my network:\n\nWhat's your top priority for 2026?\n\n🅰️ Revenue growth\n🅱️ Process optimization\n🅲️ Team building\n🅳️ Work-life balance\n\nComment with your answer and why!\n\n#Poll #Career #Goals",
    ]
  }
};

// Read business goals for context
function readBusinessGoals(): Record<string, string> {
  const goalsPath = path.join(VAULT_PATH, 'Business_Goals.md');
  try {
    if (fs.existsSync(goalsPath)) {
      const content = fs.readFileSync(goalsPath, 'utf-8');
      // Extract key information
      const valueProposition = content.match(/Value Proposition\s*\n([^\n]+)/)?.[1] || '';
      const industry = content.match(/Industry\s*:\s*\[?([^\]\n]+)/)?.[1] || 'Technology';
      const services = content.match(/Services & Offerings\s*\n([^\n]+)/)?.[1] || '';

      return {
        valueProposition,
        industry,
        services,
        rawContent: content.substring(0, 2000) // First 2000 chars for context
      };
    }
  } catch (error) {
    console.error('Failed to read business goals:', error);
  }
  return {
    valueProposition: 'AI-powered automation solutions',
    industry: 'Technology',
    services: 'Automation consulting',
    rawContent: ''
  };
}

// Topic-specific content ideas
const TOPIC_CONTENT: Record<string, { insight: string; tip: string; statistic: string; painPoint: string; benefit: string; challenge: string; solution: string; result: string }> = {
  'ai': {
    insight: 'AI is transforming how businesses operate, with automation handling repetitive tasks 24/7',
    tip: 'Start with AI for your most time-consuming repetitive tasks',
    statistic: '76% of businesses plan to increase AI investments in 2026',
    painPoint: 'spending hours on tasks AI could handle in seconds',
    benefit: 'automate repetitive work and focus on what matters',
    challenge: 'Manual processes consuming 40% of employee time',
    solution: 'AI-powered workflow automation',
    result: '60% reduction in manual work hours'
  },
  'automation': {
    insight: 'Businesses using automation save an average of 15+ hours per week on routine tasks',
    tip: 'Identify your top 3 repetitive tasks and automate the simplest one first',
    statistic: 'Companies with automation see 30% higher productivity',
    painPoint: 'drowning in repetitive manual tasks',
    benefit: 'free up 15+ hours weekly for strategic work',
    challenge: 'Team spending 60% of time on repetitive tasks',
    solution: 'End-to-end process automation',
    result: '70% time savings on routine operations'
  },
  'productivity': {
    insight: 'The most productive people automate their workflows and focus on high-impact work',
    tip: 'Block 2 hours daily for deep work with no interruptions',
    statistic: 'Remote workers are 13% more productive when given autonomy',
    painPoint: 'constant context switching killing your focus',
    benefit: 'achieve more in less time with smart systems',
    challenge: 'Fragmented workday with constant interruptions',
    solution: 'Structured time blocking + automated task management',
    result: '40% increase in focused work time'
  },
  'business': {
    insight: 'The most successful businesses in 2026 are those that leverage technology effectively',
    tip: 'Review your processes quarterly and eliminate inefficiencies',
    statistic: 'Digital-first companies grow 2x faster than traditional ones',
    painPoint: 'falling behind competitors who move faster',
    benefit: 'scale your operations without scaling your team',
    challenge: 'Growing business with limited resources',
    solution: 'Smart automation + AI-powered insights',
    result: '50% cost reduction while doubling output'
  },
  'marketing': {
    insight: 'Consistent content creation is the key to building brand authority',
    tip: 'Repurpose one piece of content into 5 different formats',
    statistic: 'Companies that blog get 67% more leads than those that don\'t',
    painPoint: 'struggling to maintain consistent social presence',
    benefit: 'build your brand on autopilot with smart scheduling',
    challenge: 'Inconsistent posting hurting engagement',
    solution: 'AI-generated content + automated scheduling',
    result: '3x increase in engagement within 90 days'
  },
  'email': {
    insight: 'The average professional spends 28% of their workday on email',
    tip: 'Use templates for common responses and batch your email time',
    statistic: '62% of emails don\'t require an immediate response',
    painPoint: 'inbox overwhelming you every single day',
    benefit: 'achieve inbox zero without the stress',
    challenge: '200+ emails daily with no system to manage them',
    solution: 'AI-powered email triage and auto-responses',
    result: '80% reduction in email processing time'
  },
  'social media': {
    insight: 'Consistency beats perfection in social media marketing',
    tip: 'Post at least 3 times per week on your primary platform',
    statistic: 'Brands that post consistently see 40% higher engagement',
    painPoint: 'can\'t keep up with social media demands',
    benefit: 'maintain consistent presence effortlessly',
    challenge: 'No time to create and schedule social content',
    solution: 'AI content generation + automated posting',
    result: '5x increase in posting frequency'
  },
  'default': {
    insight: 'Success comes from working smarter, not harder',
    tip: 'Focus on systems that scale, not just individual tasks',
    statistic: 'Top performers spend 50% less time on admin work',
    painPoint: 'spending too much time on low-value tasks',
    benefit: 'focus on what truly moves the needle',
    challenge: 'Overwhelmed with day-to-day operations',
    solution: 'Strategic automation and delegation',
    result: 'More time for growth and innovation'
  }
};

// Generate AI-powered post content
async function generatePost(platform: 'twitter' | 'linkedin', postType: string, context: Record<string, string>, customTopic?: string): Promise<{ content: string; hashtags: string[]; topic: string }> {
  const topic = customTopic || 'automation';

  // Try Groq AI first if topic is provided
  if (customTopic && customTopic.trim()) {
    const aiContent = await generateWithGroq(customTopic, platform, postType);
    if (aiContent) {
      return {
        content: aiContent.content,
        hashtags: aiContent.hashtags,
        topic: customTopic
      };
    }
  }

  // Fallback to templates
  const templates = POST_TEMPLATES[platform];
  const templateArray = templates[postType as keyof typeof templates] || templates.insight;
  const template = templateArray[Math.floor(Math.random() * templateArray.length)];

  // Determine topic and get topic-specific content
  const topicLower = topic.toLowerCase();
  const topicKey = Object.keys(TOPIC_CONTENT).find(k => topicLower.includes(k)) || 'default';
  const topicContent = TOPIC_CONTENT[topicKey];

  // Default content replacements with topic-specific overrides
  const replacements: Record<string, string> = {
    topic: customTopic || 'AI automation',
    insight: topicContent.insight,
    audience: 'business professionals',
    tip: topicContent.tip,
    statistic: topicContent.statistic,
    callToAction: 'Start small, think big.',
    task: topic || 'daily operations',
    statement: `${customTopic || 'Automation'} will define business success in the next decade`,
    painPoint: topicContent.painPoint,
    benefit: topicContent.benefit,
    link: '[your link here]',
    achievement: topicContent.result,
    howTo: topicContent.solution,
    industry: context.industry || 'technology',
    point1: 'Start with a clear goal',
    point2: 'Measure your baseline',
    point3: 'Iterate and improve',
    explanation: 'Early adopters are already seeing significant results.',
    challenge: topicContent.challenge,
    solution: topicContent.solution,
    result: topicContent.result,
    reason: 'we focused on the highest-impact areas first',
    thought: `The future of ${customTopic || 'business'} is here - are you ready?`,
    field: customTopic || 'business automation',
    takeaway: 'Focus on outcomes, not just tools',
  };

  let content = template;
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  // Generate relevant hashtags based on topic
  const baseHashtags = ['Business', 'Growth'];
  const topicHashtags: Record<string, string[]> = {
    'ai': ['AI', 'ArtificialIntelligence', 'MachineLearning', 'Tech'],
    'automation': ['Automation', 'Workflow', 'Productivity', 'Efficiency'],
    'productivity': ['Productivity', 'TimeManagement', 'Focus', 'Success'],
    'business': ['Business', 'Entrepreneurship', 'Strategy', 'Leadership'],
    'marketing': ['Marketing', 'DigitalMarketing', 'ContentMarketing', 'Branding'],
    'email': ['Email', 'EmailManagement', 'InboxZero', 'Productivity'],
    'social media': ['SocialMedia', 'SocialMediaMarketing', 'ContentCreation', 'DigitalMarketing'],
    'default': ['Success', 'Innovation', 'Future', 'Technology']
  };

  // Extract hashtags from content
  const contentHashtags = (content.match(/#\w+/g) || []).map(h => h.replace('#', ''));

  // Combine with topic hashtags
  const additionalHashtags = topicHashtags[topicKey] || topicHashtags.default;
  const allHashtags = [...new Set([...contentHashtags, ...additionalHashtags, ...baseHashtags])].slice(0, 5);

  return { content, hashtags: allHashtags, topic: customTopic || 'AI automation' };
}

// Save draft to vault for approval
async function saveDraft(platform: string, content: string, hashtags: string[]): Promise<{ filename: string; path: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `SOCIAL_${platform.toUpperCase()}_DRAFT_${timestamp}.md`;
  const filePath = path.join(VAULT_PATH, 'Pending_Approval', filename);

  const markdownContent = `---
type: social_media_draft
platform: ${platform}
status: pending_approval
created: ${new Date().toISOString()}
hashtags: [${hashtags.map(h => `"${h}"`).join(', ')}]
---

# ${platform.charAt(0).toUpperCase() + platform.slice(1)} Post Draft

## Content

${content}

## Hashtags
${hashtags.map(h => `#${h}`).join(' ')}

---

**Instructions:**
- Move to \`/Approved\` folder to post
- Move to \`/Rejected\` folder to discard
- Edit content directly if changes needed
`;

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, markdownContent);

  return { filename, path: filePath };
}

// Post directly using social_poster.py
async function postDirectly(platform: string, content: string, hashtags?: string[]): Promise<{ success: boolean; message: string; postId?: string; url?: string; simulated?: boolean }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const { spawn } = await import('child_process');

  return new Promise((resolve) => {
    // Build command arguments
    const args = [
      path.join(PROJECT_ROOT, 'social_poster.py'),
      '--platform', platform === 'twitter' ? 'x' : platform,
      '--content', content
    ];

    // Add hashtags for LinkedIn
    if (hashtags && hashtags.length > 0 && platform === 'linkedin') {
      args.push('--hashtags', ...hashtags);
    }

    console.log('Executing social_poster.py with args:', args);

    const python = spawn('python', args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      console.log('social_poster.py exit code:', code);
      console.log('social_poster.py stdout:', stdout);
      if (stderr) console.error('social_poster.py stderr:', stderr);

      // Parse the output to extract result - look for specific patterns
      const successMatch = /:\s*SUCCESS/i.test(stdout);
      const failedMatch = /:\s*FAILED/i.test(stdout);
      const urlMatch = stdout.match(/URL:\s*(https?:\/\/[^\s\n]+)/i);
      const postIdMatch = stdout.match(/POST_ID:\s*([^\s\n]+)/i);
      const messageMatch = stdout.match(/MESSAGE:\s*(.+?)(?:\n|$)/i);
      const simulatedMatch = stdout.includes('[SIMULATED]') || stdout.includes('DRY RUN') || stdout.includes('credentials not configured');

      // Log to Done folder
      const filename = `SOCIAL_${platform.toUpperCase()}_POSTED_${timestamp}.md`;
      const filePath = path.join(VAULT_PATH, 'Done', filename);

      const markdownContent = `---
type: social_media_post
platform: ${platform}
status: ${successMatch ? 'posted' : 'failed'}
posted_at: ${new Date().toISOString()}
simulated: ${simulatedMatch}
${urlMatch ? `url: ${urlMatch[1]}` : ''}
---

# ${platform.charAt(0).toUpperCase() + platform.slice(1)} Post

${content}

${hashtags && hashtags.length > 0 ? `## Hashtags\n${hashtags.map(h => `#${h}`).join(' ')}` : ''}

---

**Output:**
\`\`\`
${stdout}
${stderr ? `\nErrors:\n${stderr}` : ''}
\`\`\`

*Posted via AI Employee Dashboard*
`;

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, markdownContent);

      const isSuccess = code === 0 || (successMatch && !failedMatch);
      const extractedMessage = messageMatch ? messageMatch[1].trim() : null;

      if (isSuccess) {
        resolve({
          success: true,
          message: simulatedMatch
            ? extractedMessage || `Post simulated (credentials not configured). Saved to ${filename}`
            : extractedMessage || `Posted to ${platform} successfully!`,
          postId: postIdMatch ? postIdMatch[1] : `post_${Date.now()}`,
          url: urlMatch ? urlMatch[1] : undefined,
          simulated: simulatedMatch
        });
      } else {
        resolve({
          success: false,
          message: extractedMessage || stderr || stdout || `Failed to post to ${platform}`,
          simulated: false
        });
      }
    });

    python.on('error', (error) => {
      console.error('Failed to spawn social_poster.py:', error);
      resolve({
        success: false,
        message: `Failed to execute social_poster.py: ${error.message}`
      });
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      python.kill();
      resolve({
        success: false,
        message: 'Request timed out after 30 seconds'
      });
    }, 30000);
  });
}

// Post to both platforms
async function postToBoth(content: string, hashtags?: string[]): Promise<{ linkedin: { success: boolean; message: string; url?: string; simulated?: boolean }; x: { success: boolean; message: string; url?: string; simulated?: boolean } }> {
  // Truncate content for X if needed
  const xContent = content.length > 280 ? content.substring(0, 277) + '...' : content;

  const [linkedinResult, xResult] = await Promise.all([
    postDirectly('linkedin', content, hashtags),
    postDirectly('x', xContent)
  ]);

  return {
    linkedin: linkedinResult,
    x: xResult
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') || 'twitter';
  const postType = searchParams.get('type') || 'insight';
  const topic = searchParams.get('topic') || undefined;

  // Generate a post using Groq AI
  const context = readBusinessGoals();
  const post = await generatePost(platform as 'twitter' | 'linkedin', postType, context, topic);

  return NextResponse.json({
    success: true,
    platform,
    postType,
    topic: post.topic,
    generated: post,
    timestamp: new Date().toISOString()
  });
}

// Approve a draft and move to Approved folder
async function approveDraft(filename: string): Promise<{ success: boolean; message: string; newPath?: string }> {
  const pendingPath = path.join(VAULT_PATH, 'Pending_Approval', filename);
  const approvedPath = path.join(VAULT_PATH, 'Approved', filename);

  if (!fs.existsSync(pendingPath)) {
    return { success: false, message: `File not found: ${filename}` };
  }

  // Ensure Approved directory exists
  const approvedDir = path.dirname(approvedPath);
  if (!fs.existsSync(approvedDir)) {
    fs.mkdirSync(approvedDir, { recursive: true });
  }

  // Read and update content
  let content = fs.readFileSync(pendingPath, 'utf-8');
  content = content.replace(/status: pending_approval/g, 'status: approved');
  content = content.replace(/status: pending/g, 'status: approved');

  // Add approval timestamp
  const approvalNote = `\n---\n**Approved:** ${new Date().toISOString()}\n`;
  content += approvalNote;

  // Write to Approved folder
  fs.writeFileSync(approvedPath, content);

  // Remove from Pending_Approval
  fs.unlinkSync(pendingPath);

  return {
    success: true,
    message: `Approved and moved to: ${approvedPath}`,
    newPath: approvedPath
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, platform, content, hashtags, postType, topic, filename, postAfterApproval } = body;

    if (action === 'generate') {
      // Generate a new post with optional topic using Groq AI
      const context = readBusinessGoals();
      const post = await generatePost(platform || 'twitter', postType || 'insight', context, topic);

      return NextResponse.json({
        success: true,
        platform,
        postType,
        topic: post.topic,
        generated: post
      });
    }

    if (action === 'draft') {
      // Save as draft for approval
      const result = await saveDraft(platform, content, hashtags || []);

      return NextResponse.json({
        success: true,
        message: `Draft saved for approval: ${result.filename}`,
        filename: result.filename,
        path: result.path
      });
    }

    if (action === 'approve') {
      // Approve a draft
      if (!filename) {
        return NextResponse.json({
          success: false,
          message: 'Filename is required for approval'
        }, { status: 400 });
      }

      const approveResult = await approveDraft(filename);

      // If postAfterApproval is true, also post to the platform
      if (approveResult.success && postAfterApproval && content && platform) {
        const postResult = await postDirectly(platform, content, hashtags);
        return NextResponse.json({
          ...approveResult,
          posted: true,
          postResult
        });
      }

      return NextResponse.json(approveResult);
    }

    if (action === 'post') {
      // Post directly to a single platform
      if (!platform || !content) {
        return NextResponse.json({
          success: false,
          message: 'Platform and content are required'
        }, { status: 400 });
      }

      const result = await postDirectly(platform, content, hashtags);
      return NextResponse.json(result);
    }

    if (action === 'post_now') {
      // Post immediately to LinkedIn, X, or both
      if (!content) {
        return NextResponse.json({
          success: false,
          message: 'Content is required'
        }, { status: 400 });
      }

      if (platform === 'both') {
        const results = await postToBoth(content, hashtags);
        return NextResponse.json({
          success: results.linkedin.success || results.x.success,
          message: 'Posted to platforms',
          results
        });
      } else {
        const result = await postDirectly(platform || 'linkedin', content, hashtags);
        return NextResponse.json(result);
      }
    }

    if (action === 'regenerate') {
      // Regenerate with Groq AI and optional topic
      const context = readBusinessGoals();
      const post = await generatePost(platform || 'twitter', postType || 'insight', context, topic);

      return NextResponse.json({
        success: true,
        platform,
        postType,
        topic: post.topic,
        generated: post,
        regenerated: true
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid action. Use: generate, draft, approve, post, post_now, or regenerate'
    }, { status: 400 });

  } catch (error) {
    console.error('Social API error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
