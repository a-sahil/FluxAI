// Prompt Analyzer - Analyzes prompts to determine complexity and task type

export type TaskComplexity = 'simple' | 'medium' | 'complex';
export type TaskType = 'text' | 'code' | 'image' | 'reasoning';

export interface PromptAnalysis {
    complexity: TaskComplexity;
    taskType: TaskType;
    estimatedTokens: number;
    keywords: string[];
    confidence: number; // 0-1 score
}

// Keywords that indicate complexity levels
const SIMPLE_KEYWORDS = [
    'typo', 'fix', 'comment', 'what', 'explain', 'simple', 'quick',
    'add', 'remove', 'change', 'update', 'rename', 'format'
];

const MEDIUM_KEYWORDS = [
    'review', 'optimize', 'improve', 'test', 'validate', 'check',
    'implement', 'create', 'build', 'write', 'develop', 'modify'
];

const COMPLEX_KEYWORDS = [
    'refactor', 'architecture', 'design', 'debug', 'analyze', 'migrate',
    'integrate', 'scale', 'performance', 'security', 'algorithm', 'system',
    'infrastructure', 'database', 'authentication', 'authorization'
];

const CODE_KEYWORDS = [
    'function', 'class', 'method', 'variable', 'code', 'script', 'program',
    'bug', 'error', 'compile', 'syntax', 'api', 'endpoint', 'database',
    'json', 'xml', 'sql', 'query', 'interface', 'struct'
];

// STRICTER Image Keywords to prevent false positives (removed 'design', 'create', 'generate')
const IMAGE_KEYWORDS = [
    'image', 'picture', 'photo', 'draw', 'visualize',
    'illustration', 'graphic', 'render', 'artwork', 'painting',
    'sketch', 'diagram'
];

const REASONING_KEYWORDS = [
    'why', 'how', 'explain', 'reason', 'analyze', 'compare', 'evaluate',
    'decide', 'choose', 'recommend', 'suggest', 'think', 'consider'
];

/**
 * Analyzes a prompt to determine its complexity and task type
 */
export function analyzePrompt(prompt: string, context?: string): PromptAnalysis {
    const lowerPrompt = prompt.toLowerCase();
    const fullText = context ? `${prompt} ${context}`.toLowerCase() : lowerPrompt;

    // Detect task type
    const taskType = detectTaskType(fullText);

    // Detect complexity
    const complexity = detectComplexity(lowerPrompt, fullText);

    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const estimatedTokens = Math.ceil(fullText.length / 4);

    // Extract matched keywords
    const keywords = extractKeywords(lowerPrompt);

    // Calculate confidence score
    const confidence = calculateConfidence(lowerPrompt, keywords, estimatedTokens);

    return {
        complexity,
        taskType,
        estimatedTokens,
        keywords,
        confidence,
    };
}

function detectTaskType(text: string): TaskType {
    // Check for explicit image requests first, but be strict
    if (containsKeywords(text, IMAGE_KEYWORDS)) {
        // Double check: if it contains "code" or "architecture", it's probably NOT an image
        // unless it explicitly asks to "draw an architecture diagram"
        if (text.includes('code') || text.includes('function') || (text.includes('architecture') && !text.includes('diagram'))) {
            return 'text'; // Fallback to text/code
        }
        return 'image';
    }

    // Code-related tasks
    if (containsKeywords(text, CODE_KEYWORDS)) {
        return 'code';
    }

    // Reasoning tasks
    if (containsKeywords(text, REASONING_KEYWORDS)) {
        return 'reasoning';
    }

    // Default to text
    return 'text';
}

function detectComplexity(prompt: string, fullText: string): TaskComplexity {
    const promptLength = prompt.length;
    const contextLength = fullText.length;

    // Check for complex keywords
    if (containsKeywords(prompt, COMPLEX_KEYWORDS)) {
        return 'complex';
    }

    // Long prompts or large context usually indicate complexity
    if (promptLength > 500 || contextLength > 2000) {
        return 'complex';
    }

    // Check for medium keywords
    if (containsKeywords(prompt, MEDIUM_KEYWORDS)) {
        return 'medium';
    }

    // Medium length prompts
    if (promptLength > 100 || contextLength > 500) {
        return 'medium';
    }

    // Check for simple keywords
    if (containsKeywords(prompt, SIMPLE_KEYWORDS)) {
        return 'simple';
    }

    // Very short prompts are usually simple
    if (promptLength < 50) {
        return 'simple';
    }

    // Default to medium if unsure
    return 'medium';
}

function containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
}

function extractKeywords(text: string): string[] {
    const allKeywords = [
        ...SIMPLE_KEYWORDS,
        ...MEDIUM_KEYWORDS,
        ...COMPLEX_KEYWORDS,
        ...CODE_KEYWORDS,
        ...IMAGE_KEYWORDS,
        ...REASONING_KEYWORDS,
    ];

    return allKeywords.filter(keyword => text.includes(keyword));
}

function calculateConfidence(prompt: string, keywords: string[], estimatedTokens: number): number {
    let confidence = 0.5; // Base confidence

    // More keywords = higher confidence
    if (keywords.length > 0) {
        confidence += Math.min(keywords.length * 0.1, 0.3);
    }

    // Very short or very long prompts are easier to classify
    if (prompt.length < 20 || prompt.length > 500) {
        confidence += 0.1;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
}

/**
 * Get a human-readable explanation of the analysis
 */
export function explainAnalysis(analysis: PromptAnalysis): string {
    const { complexity, taskType, estimatedTokens, confidence } = analysis;

    const confidenceText = confidence > 0.7 ? 'high' : confidence > 0.5 ? 'medium' : 'low';

    return `Task Type: ${taskType}, Complexity: ${complexity}, Estimated Tokens: ${estimatedTokens}, Confidence: ${confidenceText}`;
}