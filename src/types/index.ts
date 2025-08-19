export interface ServerConfig {
    port: number;
    host: string;
    autoStart: boolean;
    enableLogging: boolean;
}

export interface ServerState {
    isRunning: boolean;
    port?: number;
    host?: string;
    startTime?: Date;
    requestCount: number;
    errorCount: number;
}

export interface OpenAIChatCompletionRequest {
    model: string;
    messages: OpenAIMessage[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    n?: number;
    stream?: boolean;
    stop?: string | string[];
    presence_penalty?: number;
    frequency_penalty?: number;
    logit_bias?: Record<string, number>;
    user?: string;
}

export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string | OpenAIMessageContent[];
    name?: string;
    function_call?: {
        name: string;
        arguments: string;
    };
}

export interface OpenAIMessageContent {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
        url: string;
        detail?: 'low' | 'high' | 'auto';
    };
}

export interface OpenAIChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: OpenAIChoice[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface OpenAIChoice {
    index: number;
    message: OpenAIMessage;
    finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
}

export interface AnthropicMessageRequest {
    model: string;
    max_tokens: number;
    messages: AnthropicMessage[];
    temperature?: number;
    top_p?: number;
    top_k?: number;
    stream?: boolean;
    stop_sequences?: string[];
    system?: string;
}

export interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string | AnthropicContent[];
}

export interface AnthropicContent {
    type: 'text' | 'image';
    text?: string;
    source?: {
        type: 'base64';
        media_type: string;
        data: string;
    };
}

export interface AnthropicMessageResponse {
    id: string;
    type: 'message';
    role: 'assistant';
    content: AnthropicContent[];
    model: string;
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
    stop_sequence?: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

export interface ErrorResponse {
    error: {
        message: string;
        type: string;
        param?: string;
        code?: string;
    };
}