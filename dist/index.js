#!/usr/bin/env node
/**
 * Grok MCP Server
 * Provides Claude Code access to xAI's Grok API
 *
 * Models available:
 * - grok-4-1-fast-reasoning: Latest and most capable
 * - grok-4-1-fast-non-reasoning: Optimized for speed
 * - grok-2: Previous generation
 * - grok-2-vision: Vision capabilities
 *
 * Grok features:
 * - Real-time information from X (Twitter)
 * - Witty, irreverent personality option
 * - Strong reasoning capabilities
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import OpenAI from 'openai';
// Initialize Grok client (OpenAI-compatible API)
const grok = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
});
// Create MCP server
const server = new McpServer({
    name: 'grok',
    version: '1.0.0',
});
// ============================================
// CHAT TOOLS
// ============================================
server.tool('grok_chat', 'Send a chat completion to xAI Grok. Has real-time information from X/Twitter.', {
    messages: z.array(z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
    })).describe('Array of messages in the conversation'),
    model: z.string().optional().describe('Model: grok-4-1-fast-reasoning (default), grok-4-1-fast-non-reasoning, grok-4-0709, grok-3, grok-3-mini'),
    temperature: z.number().optional().describe('Sampling temperature 0-2. Default: 1'),
    max_tokens: z.number().optional().describe('Maximum tokens to generate'),
}, async (params) => {
    try {
        const { messages, model, temperature, max_tokens } = params;
        const response = await grok.chat.completions.create({
            model: model || 'grok-4-1-fast-reasoning',
            messages,
            temperature: temperature ?? 1,
            max_tokens,
        });
        const content = response.choices[0]?.message?.content || 'No response';
        const usage = response.usage;
        return {
            content: [
                {
                    type: 'text',
                    text: `${content}\n\n---\nTokens: ${usage?.prompt_tokens} prompt + ${usage?.completion_tokens} completion = ${usage?.total_tokens} total`,
                },
            ],
        };
    }
    catch (error) {
        const err = error;
        return {
            content: [
                {
                    type: 'text',
                    text: `Grok API error: ${err.message}`,
                },
            ],
            isError: true,
        };
    }
});
server.tool('grok_complete', 'Simple one-shot completion with Grok.', {
    prompt: z.string().describe('The prompt to send'),
    system: z.string().optional().describe('Optional system message'),
    model: z.string().optional().describe('Model to use. Default: grok-4-1-fast-reasoning'),
    temperature: z.number().optional().describe('Temperature 0-2'),
}, async (params) => {
    try {
        const { prompt, system, model, temperature } = params;
        const messages = [];
        if (system) {
            messages.push({ role: 'system', content: system });
        }
        messages.push({ role: 'user', content: prompt });
        const response = await grok.chat.completions.create({
            model: model || 'grok-4-1-fast-reasoning',
            messages,
            temperature: temperature ?? 1,
        });
        return {
            content: [
                {
                    type: 'text',
                    text: response.choices[0]?.message?.content || 'No response',
                },
            ],
        };
    }
    catch (error) {
        const err = error;
        return {
            content: [
                {
                    type: 'text',
                    text: `Grok API error: ${err.message}`,
                },
            ],
            isError: true,
        };
    }
});
// ============================================
// FAST MODEL TOOL
// ============================================
server.tool('grok_fast', 'Fast completion using Grok 3 Fast. Optimized for speed.', {
    prompt: z.string().describe('The prompt'),
    system: z.string().optional().describe('Optional system message'),
}, async (params) => {
    try {
        const { prompt, system } = params;
        const messages = [];
        if (system) {
            messages.push({ role: 'system', content: system });
        }
        messages.push({ role: 'user', content: prompt });
        const startTime = Date.now();
        const response = await grok.chat.completions.create({
            model: 'grok-4-1-fast-non-reasoning',
            messages,
            temperature: 0.7,
        });
        const latency = Date.now() - startTime;
        return {
            content: [
                {
                    type: 'text',
                    text: `${response.choices[0]?.message?.content || 'No response'}\n\n[${latency}ms]`,
                },
            ],
        };
    }
    catch (error) {
        const err = error;
        return {
            content: [
                {
                    type: 'text',
                    text: `Grok error: ${err.message}`,
                },
            ],
            isError: true,
        };
    }
});
// ============================================
// FUN MODE - Grok's witty personality
// ============================================
server.tool('grok_fun', 'Grok with its signature witty, irreverent personality enabled. Good for humor and creative tasks.', {
    prompt: z.string().describe('The prompt'),
    spicy: z.boolean().optional().describe('Extra spicy mode (more irreverent). Default: false'),
}, async (params) => {
    try {
        const { prompt, spicy } = params;
        const systemPrompt = spicy
            ? 'You are Grok, a witty and irreverent AI with a sharp sense of humor. Be bold, edgy, and entertaining. Don\'t hold back.'
            : 'You are Grok, an AI with a good sense of humor. Be helpful but feel free to be witty and add personality to your responses.';
        const response = await grok.chat.completions.create({
            model: 'grok-4-1-fast-reasoning',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            temperature: 1.2, // Higher temperature for creativity
        });
        return {
            content: [
                {
                    type: 'text',
                    text: response.choices[0]?.message?.content || 'No response',
                },
            ],
        };
    }
    catch (error) {
        const err = error;
        return {
            content: [
                {
                    type: 'text',
                    text: `Grok error: ${err.message}`,
                },
            ],
            isError: true,
        };
    }
});
// ============================================
// CODE TOOLS
// ============================================
server.tool('grok_code', 'Generate code using Grok. Strong at reasoning through complex problems.', {
    task: z.string().describe('Description of what code to generate'),
    language: z.string().optional().describe('Programming language'),
    context: z.string().optional().describe('Additional context or existing code'),
}, async (params) => {
    try {
        const { task, language, context } = params;
        const systemPrompt = `You are an expert programmer. Generate clean, efficient, well-documented code.${language ? ` Use ${language}.` : ''} Only output the code with brief comments.`;
        let userPrompt = task;
        if (context) {
            userPrompt = `Context:\n${context}\n\nTask: ${task}`;
        }
        const response = await grok.chat.completions.create({
            model: 'grok-4-1-fast-reasoning',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
        });
        return {
            content: [
                {
                    type: 'text',
                    text: response.choices[0]?.message?.content || 'No code generated',
                },
            ],
        };
    }
    catch (error) {
        const err = error;
        return {
            content: [
                {
                    type: 'text',
                    text: `Grok error: ${err.message}`,
                },
            ],
            isError: true,
        };
    }
});
server.tool('grok_analyze', 'Analyze code using Grok.', {
    code: z.string().describe('The code to analyze'),
    task: z.enum(['explain', 'review', 'bugs', 'improve', 'security']).describe('Type of analysis'),
}, async (params) => {
    try {
        const { code, task } = params;
        const taskPrompts = {
            explain: 'Explain what this code does in detail.',
            review: 'Review this code for quality and best practices.',
            bugs: 'Find any bugs or potential issues.',
            improve: 'Suggest improvements.',
            security: 'Analyze for security vulnerabilities.',
        };
        const response = await grok.chat.completions.create({
            model: 'grok-4-1-fast-reasoning',
            messages: [
                { role: 'user', content: `${taskPrompts[task]}\n\nCode:\n\`\`\`\n${code}\n\`\`\`` },
            ],
            temperature: 0.3,
        });
        return {
            content: [
                {
                    type: 'text',
                    text: response.choices[0]?.message?.content || 'No analysis',
                },
            ],
        };
    }
    catch (error) {
        const err = error;
        return {
            content: [
                {
                    type: 'text',
                    text: `Grok error: ${err.message}`,
                },
            ],
            isError: true,
        };
    }
});
// ============================================
// REASONING TOOL
// ============================================
server.tool('grok_reason', 'Use Grok for complex reasoning and problem-solving. Shows step-by-step thinking.', {
    problem: z.string().describe('The problem or question requiring deep reasoning'),
    context: z.string().optional().describe('Additional context'),
}, async (params) => {
    try {
        const { problem, context } = params;
        let prompt = problem;
        if (context) {
            prompt = `Context:\n${context}\n\nProblem: ${problem}`;
        }
        const response = await grok.chat.completions.create({
            model: 'grok-4-1-fast-reasoning',
            messages: [
                { role: 'system', content: 'Think step by step. Break down the problem, analyze each part, and show your reasoning process clearly before arriving at a conclusion.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 4096,
        });
        return {
            content: [
                {
                    type: 'text',
                    text: response.choices[0]?.message?.content || 'No response',
                },
            ],
        };
    }
    catch (error) {
        const err = error;
        return {
            content: [
                {
                    type: 'text',
                    text: `Grok error: ${err.message}`,
                },
            ],
            isError: true,
        };
    }
});
// ============================================
// X/TWITTER AWARE TOOL
// ============================================
server.tool('grok_realtime', 'Ask Grok about current events. Grok has access to real-time information from X/Twitter.', {
    query: z.string().describe('Question about current events, trends, or real-time information'),
}, async (params) => {
    try {
        const { query } = params;
        const response = await grok.chat.completions.create({
            model: 'grok-4-1-fast-reasoning',
            messages: [
                { role: 'system', content: 'You have access to real-time information. Provide current, up-to-date answers based on the latest available information. If discussing recent events, mention when the information is from if relevant.' },
                { role: 'user', content: query },
            ],
            temperature: 0.5,
        });
        return {
            content: [
                {
                    type: 'text',
                    text: response.choices[0]?.message?.content || 'No response',
                },
            ],
        };
    }
    catch (error) {
        const err = error;
        return {
            content: [
                {
                    type: 'text',
                    text: `Grok error: ${err.message}`,
                },
            ],
            isError: true,
        };
    }
});
// ============================================
// VISION TOOL
// ============================================
server.tool('grok_vision', 'Analyze images using Grok vision. Pass an image URL (web URL or tweet media) and a question about it.', {
    image_url: z.string().describe('URL of the image to analyze'),
    prompt: z.string().describe('What to analyze or ask about the image'),
    model: z.string().optional().describe('Model to use. Default: grok-4-1-fast-reasoning'),
}, async (params) => {
    try {
        const { image_url, prompt, model } = params;
        const response = await grok.chat.completions.create({
            model: model || 'grok-4-1-fast-reasoning',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: image_url } },
                        { type: 'text', text: prompt },
                    ],
                },
            ],
            max_tokens: 4096,
        });
        const content = response.choices[0]?.message?.content || 'No response';
        const usage = response.usage;
        return {
            content: [
                {
                    type: 'text',
                    text: `${content}\n\n---\nTokens: ${usage?.prompt_tokens} prompt + ${usage?.completion_tokens} completion = ${usage?.total_tokens} total`,
                },
            ],
        };
    }
    catch (error) {
        const err = error;
        return {
            content: [
                {
                    type: 'text',
                    text: `Grok vision error: ${err.message}`,
                },
            ],
            isError: true,
        };
    }
});
// ============================================
// UTILITY TOOLS
// ============================================
server.tool('grok_models', 'List available Grok models and their capabilities.', {}, async () => {
    const models = `
xAI Grok Models:

1. grok-4-1-fast-reasoning (Latest)
   - Most capable model
   - Best reasoning and analysis
   - Vision/multimodal support (use grok_vision tool)
   - Real-time X/Twitter information
   - 131K context window

2. grok-4-1-fast-non-reasoning
   - Optimized for speed
   - Good for quick tasks
   - Lower latency

3. grok-4-0709
   - Previous Grok 4 generation
   - Vision/multimodal support

4. grok-3 / grok-3-mini
   - Previous generation
   - Still very capable

5. grok-imagine-image / grok-imagine-image-pro / grok-imagine-video
   - Image and video generation

Key Features:
- Real-time information from X (Twitter)
- Vision/multimodal (images in grok-4 models)
- Witty, irreverent personality option
- Strong reasoning capabilities

API: https://api.x.ai/v1 (OpenAI-compatible)
Console: https://console.x.ai
`;
    return {
        content: [
            {
                type: 'text',
                text: models.trim(),
            },
        ],
    };
});
server.tool('grok_json', 'Get structured JSON output from Grok.', {
    prompt: z.string().describe('Describe what JSON structure you need'),
    schema: z.string().optional().describe('Optional JSON schema hint'),
}, async (params) => {
    try {
        const { prompt, schema } = params;
        let systemPrompt = 'You are a JSON generator. Output ONLY valid JSON, no markdown, no explanation.';
        if (schema) {
            systemPrompt += ` Follow this schema: ${schema}`;
        }
        const response = await grok.chat.completions.create({
            model: 'grok-4-1-fast-reasoning',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            temperature: 0,
            response_format: { type: 'json_object' },
        });
        return {
            content: [
                {
                    type: 'text',
                    text: response.choices[0]?.message?.content || '{}',
                },
            ],
        };
    }
    catch (error) {
        const err = error;
        return {
            content: [
                {
                    type: 'text',
                    text: `Grok error: ${err.message}`,
                },
            ],
            isError: true,
        };
    }
});
server.tool('grok_summarize', 'Summarize text using Grok.', {
    text: z.string().describe('Text to summarize'),
    style: z.enum(['brief', 'detailed', 'bullets', 'tweet']).optional().describe('Summary style. Default: brief'),
}, async (params) => {
    try {
        const { text, style } = params;
        const stylePrompts = {
            brief: 'Summarize in 2-3 sentences.',
            detailed: 'Provide a detailed summary covering all key points.',
            bullets: 'Summarize as bullet points.',
            tweet: 'Summarize in a single tweet (max 280 characters).',
        };
        const response = await grok.chat.completions.create({
            model: 'grok-4-1-fast-non-reasoning',
            messages: [
                { role: 'user', content: `${stylePrompts[style || 'brief']}\n\nText:\n${text}` },
            ],
            temperature: 0.3,
        });
        return {
            content: [
                {
                    type: 'text',
                    text: response.choices[0]?.message?.content || 'No summary',
                },
            ],
        };
    }
    catch (error) {
        const err = error;
        return {
            content: [
                {
                    type: 'text',
                    text: `Grok error: ${err.message}`,
                },
            ],
            isError: true,
        };
    }
});
// ============================================
// START SERVER
// ============================================
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Grok MCP server running');
}
main().catch(console.error);
