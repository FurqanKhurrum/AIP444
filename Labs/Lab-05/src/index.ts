import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getGitHubFile } from './tools';

// Load environment variables from AIP444 root directory
// Path: Lab-03/dist/ -> Lab-03/ -> Labs/ -> AIP444/ -> .env
const envPath = path.join(__dirname, '..', '..', '..', '.env');
console.log(`Looking for .env at: ${envPath}`);
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
    console.error('Error loading .env file:', envResult.error.message);
    console.error('Make sure .env exists at AIP444/.env');
} else {
    console.log('✓ .env file loaded from AIP444 root');
}

// Verify API key
const apiKey = process.env.OPENROUTER_API_KEY;
if (apiKey) {
    console.log(`✓ API Key loaded\n`);
} else {
    console.error('✗ OPENROUTER_API_KEY not found in .env file\n');
}


interface ParsedPR {
    owner: string;
    repo: string;
    prNumber: string;
}

interface Comment {
    username: string;
    body: string;
    date: string;
}

interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OpenRouterResponse {
    id: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

class GitHubPRParser {
    private static readonly GITHUB_ORIGIN = 'https://github.com';
    private static readonly GITHUB_API_BASE = 'https://api.github.com';
    private static readonly MAX_DIFF_LENGTH = 100000;
    private static readonly MAX_REDIRECTS = 5;

    private url: string;
    private owner: string | null = null;
    private repo: string | null = null;
    private prNumber: string | null = null;

    constructor(url: string) {
        this.url = url;
    }

    public parseUrl(): ParsedPR | null {
        try {
            const urlObj = new URL(this.url);

            const origin = `${urlObj.protocol}//${urlObj.hostname}`;
            if (origin !== GitHubPRParser.GITHUB_ORIGIN) {
                console.error(`Error: Invalid origin. Expected '${GitHubPRParser.GITHUB_ORIGIN}', got '${origin}'`);
                return null;
            }

            const pattern = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/;
            const match = urlObj.pathname.match(pattern);

            if (!match) {
                console.error('Error: Invalid GitHub PR URL format.');
                console.error(`Expected format: ${GitHubPRParser.GITHUB_ORIGIN}/<owner>/<repo>/pull/<number>`);
                return null;
            }

            this.owner = match[1];
            this.repo = match[2];
            this.prNumber = match[3];

            return {
                owner: this.owner,
                repo: this.repo,
                prNumber: this.prNumber
            };

        } catch (error) {
            console.error(`Error parsing URL: ${error}`);
            return null;
        }
    }

    public async fetchDiff(usePatch: boolean = false): Promise<string | null> {
        if (!this.owner || !this.repo || !this.prNumber) {
            console.error('Error: URL must be parsed before fetching diff');
            return null;
        }

        const extension = usePatch ? '.patch' : '.diff';
        const diffUrl = `${GitHubPRParser.GITHUB_ORIGIN}/${this.owner}/${this.repo}/pull/${this.prNumber}${extension}`;

        try {
            console.log(`Fetching from: ${diffUrl}`);
            const diffText = await this.httpGet(diffUrl);

            if (diffText.length > GitHubPRParser.MAX_DIFF_LENGTH) {
                console.warn(`\n⚠️  WARNING: Diff is ${diffText.length.toLocaleString()} characters long.`);
                console.warn(`⚠️  Truncating to ${GitHubPRParser.MAX_DIFF_LENGTH.toLocaleString()} characters...`);
                return diffText.substring(0, GitHubPRParser.MAX_DIFF_LENGTH) + '\n\n...[Diff Truncated]...';
            }

            return diffText;

        } catch (error) {
            console.error(`Error fetching diff: ${error}`);
            return null;
        }
    }

    public async fetchComments(): Promise<Comment[] | null> {
        if (!this.owner || !this.repo || !this.prNumber) {
            console.error('Error: URL must be parsed before fetching comments');
            return null;
        }

        const apiUrl = `${GitHubPRParser.GITHUB_API_BASE}/repos/${this.owner}/${this.repo}/issues/${this.prNumber}/comments`;

        try {
            console.log(`Fetching from: ${apiUrl}`);
            const response = await this.httpGetJSON(apiUrl, {
                'User-Agent': 'AIP444-Lab-03',
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            });

            const comments: Comment[] = response.map((item: any) => ({
                username: item.user.login,
                body: item.body,
                date: item.updated_at
            }));

            return comments;

        } catch (error: any) {
            if (error.message.includes('403')) {
                console.error('Error: GitHub API rate limit exceeded (60 requests/hour without token)');
                console.error('Please wait an hour before trying again.');
            } else {
                console.error(`Error fetching comments: ${error}`);
            }
            return null;
        }
    }

    private httpGet(url: string, redirectCount: number = 0): Promise<string> {
        return new Promise((resolve, reject) => {
            if (redirectCount > GitHubPRParser.MAX_REDIRECTS) {
                reject(new Error('Too many redirects'));
                return;
            }

            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;

            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            };

            protocol.get(options, (res) => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url).href;
                    console.log(`Following redirect to: ${redirectUrl}`);
                    
                    this.httpGet(redirectUrl, redirectCount + 1)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }

                let data = '';
                res.setEncoding('utf8');
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve(data);
                });

            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    private httpGetJSON(url: string, headers: Record<string, string> = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;

            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: headers
            };

            protocol.get(options, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }

                let data = '';
                res.setEncoding('utf8');
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (error) {
                        reject(new Error(`Failed to parse JSON: ${error}`));
                    }
                });

            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    public getOwner(): string | null {
        return this.owner;
    }

    public getRepo(): string | null {
        return this.repo;
    }

    public getPrNumber(): string | null {
        return this.prNumber;
    }
}

/**
 * OpenRouter API client
 */
class OpenRouterClient {
    private static readonly API_BASE = 'https://openrouter.ai/api/v1';
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Send a chat completion request to OpenRouter (supports tool calling)
     */
    async chatCompletion(
        messages: any[],
        model: string = 'stepfun/step-3.5-flash:free',
        tools?: any[]
    ): Promise<any | null> {
        const url = `${OpenRouterClient.API_BASE}/chat/completions`;

        const requestBody: any = {
            model: model,
            messages: messages
        };

        if (tools) {
            requestBody.tools = tools;
        }

        try {
            console.log(`Sending request to OpenRouter (model: ${model})...`);
            const response = await this.httpPostJSON(url, JSON.stringify(requestBody), {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/FurqanKhurrum/lab-05',
                'X-Title': 'AIP444 Lab 05 - PR Reviewer with Tools'
            });

            if (response.choices && response.choices.length > 0) {
                if (response.usage) {
                    console.log(`Token usage: ${response.usage.total_tokens} total (${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion)`);
                }
                return response.choices[0].message;
            } else {
                console.error('No response choices returned from API');
                return null;
            }

        } catch (error) {
            console.error(`OpenRouter API error: ${error}`);
            return null;
        }
    }

    /**
     * Helper method to make HTTP POST requests for JSON data
     */
    private httpPostJSON(url: string, body: string, headers: Record<string, string>): Promise<any> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);

            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Length': Buffer.byteLength(body)
                }
            };

            const req = https.request(options, (res) => {
                if (res.statusCode !== 200) {
                    let errorData = '';
                    res.on('data', (chunk) => {
                        errorData += chunk;
                    });
                    res.on('end', () => {
                        reject(new Error(`HTTP ${res.statusCode}: ${errorData}`));
                    });
                    return;
                }

                let data = '';
                res.setEncoding('utf8');
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (error) {
                        reject(new Error(`Failed to parse JSON response: ${error}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(body);
            req.end();
        });
    }
}

/**
 * Load the system prompt from a file
 */
function loadSystemPrompt(promptPath?: string): string | null {
    try {
        const defaultPath = path.join(__dirname, '..', 'prompts', 'system_prompt.md');
        const filePath = promptPath || defaultPath;

        console.log(`Loading system prompt from: ${filePath}`);
        const systemPrompt = fs.readFileSync(filePath, 'utf-8');
        return systemPrompt;
    } catch (error) {
        console.error(`Error loading system prompt: ${error}`);
        console.error('Make sure the prompts/system_prompt.md file exists');
        return null;
    }
}

/**
 * Format comments into XML structure with proper escaping
 */
function formatCommentsAsXML(comments: Comment[]): string {
    if (comments.length === 0) {
        return '<comments>\nNo comments available for this PR.\n</comments>';
    }

    const xmlComments = comments.map(comment => {
        const escapedBody = comment.body
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        return `<comment username="${comment.username}" date="${comment.date}">
${escapedBody}
</comment>`;
    }).join('\n\n');

    return `<comments>\n${xmlComments}\n</comments>`;
}

/**
 * Build the user prompt with diff and comments
 */
function buildUserPrompt(diff: string, comments: Comment[]): string {
    const commentsXML = formatCommentsAsXML(comments);

    return `Please review this Pull Request.

# Code Changes (DIFF)

\`\`\`diff
${diff}
\`\`\`

# Discussion Comments

${commentsXML}

Please provide your analysis following the specified format.`;
}

/**
 * Create output directory for a specific PR
 */
function createOutputDirectory(owner: string, repo: string, prNumber: string): string {
    const baseOutputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(baseOutputDir)) {
        fs.mkdirSync(baseOutputDir);
    }

    const prDirName = `${owner}_${repo}_PR${prNumber}`;
    const prOutputDir = path.join(baseOutputDir, prDirName);
    
    if (!fs.existsSync(prOutputDir)) {
        fs.mkdirSync(prOutputDir, { recursive: true });
    }

    return prOutputDir;
}

const tools = [
    {
      type: "function" as const,
      function: {
        name: "get_github_file",
        description:
          "Fetch the raw content of a file from a GitHub repository. Use this tool when you need to see the full source code of a file referenced in a pull request diff to better understand the context of the changes. For example, if a diff shows modifications to a function but you need to see the full function, imported modules, or related code in the same file, use this tool to fetch it.",
        parameters: {
          type: "object",
          properties: {
            owner: {
              type: "string",
              description:
                'The GitHub username or organization that owns the repository (e.g., "microsoft", "facebook").',
            },
            repo: {
              type: "string",
              description:
                'The name of the repository (e.g., "vscode", "react").',
            },
            filepath: {
              type: "string",
              description:
                'The full path to the file within the repository (e.g., "src/index.ts", "packages/react/src/React.js").',
            },
            ref: {
              type: "string",
              description:
                'The branch name, tag, or commit SHA to fetch the file from (e.g., "main", "v1.0.0"). Defaults to "main".',
            },
          },
          required: ["owner", "repo", "filepath"],
          additionalProperties: false,
        },
      },
    },
  ];

  
async function main(): Promise<void> {
    const prUrl = process.argv[2] || 'https://github.com/facebook/react/pull/28356';
    
    if (!process.argv[2]) {
        console.log(`No URL provided. Using example: ${prUrl}\n`);
    }

    // Check for API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('Error: OPENROUTER_API_KEY not found in environment variables');
        process.exit(1);
    }

    const parser = new GitHubPRParser(prUrl);

    // Step 1: Parse the URL
    console.log('='.repeat(60));
    console.log('STEP 1: Parsing GitHub PR URL');
    console.log('='.repeat(60));

    const result = parser.parseUrl();
    if (result === null) {
        process.exit(1);
    }

    console.log(`✓ Owner: ${result.owner}`);
    console.log(`✓ Repo: ${result.repo}`);
    console.log(`✓ PR Number: ${result.prNumber}`);

    // Step 2: Fetch the diff
    console.log('\n' + '='.repeat(60));
    console.log('STEP 2: Fetching Diff');
    console.log('='.repeat(60));

    const diffText = await parser.fetchDiff(false);
    if (diffText === null) {
        process.exit(1);
    }

    console.log(`✓ Successfully fetched diff (${diffText.length.toLocaleString()} characters)`);

    // Step 3: Fetch the comments
    console.log('\n' + '='.repeat(60));
    console.log('STEP 3: Fetching PR Comments');
    console.log('='.repeat(60));

    const comments = await parser.fetchComments();
    if (comments === null) {
        console.warn('⚠️  Failed to fetch comments, continuing with empty comments...');
    } else {
        console.log(`✓ Successfully fetched ${comments.length} comment(s)`);
    }

    // Step 4: Build Prompts
    console.log('\n' + '='.repeat(60));
    console.log('STEP 4: Building Prompts');
    console.log('='.repeat(60));

    const systemPrompt = loadSystemPrompt();
    if (systemPrompt === null) {
        console.error('Failed to load system prompt. Exiting.');
        process.exit(1);
    }

    const userPrompt = buildUserPrompt(diffText, comments || []);

    console.log(`✓ System prompt loaded (${systemPrompt.length.toLocaleString()} characters)`);
    console.log(`✓ User prompt built (${userPrompt.length.toLocaleString()} characters)`);

    // Step 5: Send to OpenRouter for Analysis (with tool calling loop)
    console.log('\n' + '='.repeat(60));
    console.log('STEP 5: AI Analysis via OpenRouter (with Tool Calling)');
    console.log('='.repeat(60));

    const openrouter = new OpenRouterClient(apiKey);

    const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    const MAX_ITERATIONS = 5;
    let iteration = 0;
    let aiResponse: string | null = null;

    while (iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`\n--- Iteration ${iteration} ---`);

        const assistantMessage = await openrouter.chatCompletion(messages, 'stepfun/step-3.5-flash:free', tools);

        if (assistantMessage === null) {
            console.error('Failed to get AI response. Exiting.');
            process.exit(1);
        }

        // Add assistant message to conversation history
        messages.push(assistantMessage);

        // Check if there are tool calls
        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
            // No tool calls — we have the final answer
            aiResponse = assistantMessage.content;
            console.log('✓ Received final AI analysis');
            break;
        }

        // Process each tool call
        for (const toolCall of assistantMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);

            console.log(`🔧 Tool call: ${functionName}(${JSON.stringify(args)})`);

            if (functionName === 'get_github_file') {
                const fileContent = await getGitHubFile(
                    args.owner,
                    args.repo,
                    args.filepath,
                    args.ref || 'main'
                );

                console.log(`✓ Fetched file: ${args.filepath} (${fileContent.length} chars)`);

                // Add tool result to conversation
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: fileContent
                });
            } else {
                // Unknown tool
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: `Error: Unknown tool "${functionName}"`
                });
            }
        }
    }

    if (aiResponse === null) {
        console.error('Max iterations reached without a final response. Exiting.');
        process.exit(1);
    }

    console.log(`✓ Received AI analysis (${aiResponse.length.toLocaleString()} characters)`);

    // Create output directory
    const outputDir = createOutputDirectory(result.owner, result.repo, result.prNumber);

    // Save all files
    console.log('\n' + '='.repeat(60));
    console.log('SAVING FILES');
    console.log('='.repeat(60));
    
    const diffFile = path.join(outputDir, 'code_changes.diff');
    fs.writeFileSync(diffFile, diffText, 'utf-8');
    console.log(`✓ Diff saved to: ${diffFile}`);

    if (comments && comments.length > 0) {
        const commentsFile = path.join(outputDir, 'comments.json');
        fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2), 'utf-8');
        console.log(`✓ Comments saved to: ${commentsFile}`);
    }

    const systemPromptFile = path.join(outputDir, 'system_prompt.txt');
    fs.writeFileSync(systemPromptFile, systemPrompt, 'utf-8');
    console.log(`✓ System prompt saved to: ${systemPromptFile}`);

    const userPromptFile = path.join(outputDir, 'user_prompt.txt');
    fs.writeFileSync(userPromptFile, userPrompt, 'utf-8');
    console.log(`✓ User prompt saved to: ${userPromptFile}`);

    // Save AI response
    const reviewFile = path.join(outputDir, 'AI_REVIEW.md');
    fs.writeFileSync(reviewFile, aiResponse, 'utf-8');
    console.log(`✓ AI review saved to: ${reviewFile}`);

    // Create README
    const readmeContent = `# Pull Request Analysis: ${result.owner}/${result.repo} #${result.prNumber}

**PR URL**: ${prUrl}
**Generated**: ${new Date().toISOString()}

## Files in this directory:

- \`AI_REVIEW.md\` - **START HERE** - The AI-generated code review
- \`code_changes.diff\` - The code changes in diff format
- \`comments.json\` - Discussion comments from the PR (if any)
- \`system_prompt.txt\` - System prompt used for analysis
- \`user_prompt.txt\` - User prompt with diff and comments

## Review Sections:

The AI review contains:
1. **Summary** - What is the goal of this PR?
2. **The Discussion** - What was discussed in the comments?
3. **Assessment** - Potential bugs, edge cases, and issues
4. **Socratic Questions** - 3 questions to test understanding
`;

    const readmeFile = path.join(outputDir, 'README.md');
    fs.writeFileSync(readmeFile, readmeContent, 'utf-8');
    console.log(`✓ README saved to: ${readmeFile}`);

    // Display preview of AI review
    console.log('\n' + '='.repeat(60));
    console.log('AI REVIEW PREVIEW');
    console.log('='.repeat(60));
    console.log(aiResponse.substring(0, 1000));
    if (aiResponse.length > 1000) {
        console.log('\n... (truncated, see full review in AI_REVIEW.md) ...');
    }

    console.log('\n✅ All done! AI code review completed.');
    console.log(`\n📁 Output directory: ${outputDir}`);
    console.log(`📄 Read the full review: ${reviewFile}`);
}

main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
});

export { GitHubPRParser, ParsedPR, Comment, OpenRouterClient, loadSystemPrompt, buildUserPrompt, formatCommentsAsXML, createOutputDirectory };