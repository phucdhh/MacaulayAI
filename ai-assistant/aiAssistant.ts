// AI Assistant for Macaulay2
// Handles AI interactions, context management, and chat interface

interface AIConfig {
  apiKey: string;
  models: AIModel[];
  defaultModel: string;
}

interface AIModel {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  endpoint: string;
  description: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  includeInContext?: boolean;
}

class AIAssistant {
  private config: AIConfig | null = null;
  private systemPrompt: string = '';
  private chatHistory: ChatMessage[] = [];
  private currentModel: string = '';
  private autoExplain: boolean = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadConfig();
    await this.loadSystemPrompt();
    if (this.config) {
      this.currentModel = this.config.defaultModel;
    }
  }

  public async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  private async loadConfig(): Promise<void> {
    try {
      // Hardcode config to avoid JSON parsing issues with cached files
      this.config = {
        apiKey: '0e19228a8f904d7888b11380bf29ba93.2gAKwfQSMgSAIHw6lKKwOiN2',
        models: [
          {
            id: 'deepseek-r1:8b',
            name: 'DeepSeek Local',
            type: 'local',
            endpoint: 'http://localhost:11434',
            description: 'Local reasoning model'
          },
          {
            id: 'deepseek-v3.1:671b-cloud',
            name: 'DeepSeek 3.1',
            type: 'cloud',
            endpoint: 'http://localhost:11434',
            description: 'Hybrid thinking model'
          },
          {
            id: 'deepseek-v3.2:cloud',
            name: 'DeepSeek 3.2',
            type: 'cloud',
            endpoint: 'http://localhost:11434',
            description: 'Enhanced cloud model'
          },
          {
            id: 'gpt-oss:120b-cloud',
            name: 'GPT OSS',
            type: 'cloud',
            endpoint: 'http://localhost:11434',
            description: 'Large open-source model'
          },
          {
            id: 'glm-4.7:cloud',
            name: 'GLM 4.7',
            type: 'cloud',
            endpoint: 'http://localhost:11434',
            description: 'Advanced coding model'
          },
          {
            id: 'kimi-k2-thinking:cloud',
            name: 'Kimi Thinking',
            type: 'cloud',
            endpoint: 'http://localhost:11434',
            description: 'Moonshot thinking model'
          }
        ],
        defaultModel: 'deepseek-r1:8b'
      };
    } catch (error) {
      // Fallback config
      this.config = {
        apiKey: '',
        models: [{
          id: 'deepseek-r1:8b',
          name: 'DeepSeek Local',
          type: 'local',
          endpoint: 'http://localhost:11434',
          description: 'Local model'
        }],
        defaultModel: 'deepseek-r1:8b'
      };
    }
  }

  private async loadSystemPrompt(): Promise<void> {
    try {
      const response = await fetch('/ai-assistant/prompt.txt');
      this.systemPrompt = await response.text();
    } catch (error) {
      console.error('Failed to load system prompt:', error);
      this.systemPrompt = 'You are an expert in Macaulay2 and algebraic geometry.';
    }
  }

  public getModels(): AIModel[] {
    return this.config?.models || [];
  }

  public isReady(): boolean {
    return this.config !== null;
  }

  public setModel(modelId: string): void {
    const model = this.config.models.find(m => m.id === modelId);
    if (model) {
      this.currentModel = modelId;
    }
  }

  public getCurrentModel(): AIModel | undefined {
    return this.config.models.find(m => m.id === this.currentModel);
  }

  public setAutoExplain(enabled: boolean): void {
    this.autoExplain = enabled;
  }

  public isAutoExplainEnabled(): boolean {
    return this.autoExplain;
  }

  public addMessage(role: 'user' | 'assistant', content: string, includeInContext: boolean = false): void {
    this.chatHistory.push({
      role,
      content,
      timestamp: new Date(),
      includeInContext
    });
  }

  public getChatHistory(): ChatMessage[] {
    return this.chatHistory;
  }

  public clearHistory(): void {
    this.chatHistory = [];
  }

  private buildContextMessages(): any[] {
    const messages: any[] = [
      { role: 'system', content: this.systemPrompt }
    ];

    // Add messages marked for context
    const contextMessages = this.chatHistory.filter(m => m.includeInContext);
    for (const msg of contextMessages) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    return messages;
  }

  public async sendMessage(userMessage: string, onThinking?: (thinking: string) => void, onAnswer?: (answer: string) => void, abortSignal?: AbortSignal): Promise<string> {
    const model = this.getCurrentModel();
    if (!model) {
      throw new Error('No AI model selected');
    }

    this.addMessage('user', userMessage, false);

    const messages = this.buildContextMessages();
    messages.push({ role: 'user', content: userMessage });

    try {
      const response = await this.callAI(model, messages, onThinking, onAnswer, abortSignal);
      this.addMessage('assistant', response, false);
      return response;
    } catch (error) {
      console.error('AI request failed:', error);
      throw error;
    }
  }

  public async explainOutput(macaulay2Output: string): Promise<string> {
    const explainPrompt = `Please explain this Macaulay2 output:\n\n${macaulay2Output}`;
    return this.sendMessage(explainPrompt);
  }

  private async callAI(model: AIModel, messages: any[], onThinking?: (thinking: string) => void, onAnswer?: (answer: string) => void, abortSignal?: AbortSignal): Promise<string> {
    // Use proxy endpoint to avoid CORS
    const endpoint = '/api/ai/chat';

    const requestBody = {
      model: model.id,
      messages: messages,
      stream: true  // Enable streaming to get thinking process
    };

    console.log('AI callAI: Starting request to', endpoint, 'with model', model.id);
    console.log('AI callAI: Signal aborted?', abortSignal?.aborted);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal
    });

    console.log('AI callAI: Fetch completed, status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.statusText}`);
    }

    // Handle streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader');
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let thinkingContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          
          if (data.message) {
            // Capture thinking/reasoning if present (append tokens incrementally)
            if (data.message.thinking && onThinking) {
              thinkingContent += data.message.thinking;  // Append each token
              onThinking(thinkingContent);
            }
            
            // Accumulate and stream content
            if (data.message.content) {
              fullContent += data.message.content;
              if (onAnswer) {
                onAnswer(fullContent); // Stream accumulated content
              }
            }
          }
          
          if (data.done) {
            // Streaming complete
          }
        } catch (e) {
          // Skip non-JSON lines
        }
      }
    }

    console.log('AI callAI: Stream reading complete, fullContent length:', fullContent.length);
    return fullContent || 'No response from AI';
  }

  public toggleMessageContext(index: number): void {
    if (index >= 0 && index < this.chatHistory.length) {
      const msg = this.chatHistory[index];
      msg.includeInContext = !msg.includeInContext;
    }
  }

  public exportChat(): string {
    return JSON.stringify(this.chatHistory, null, 2);
  }

  public importChat(jsonString: string): void {
    try {
      const history = JSON.parse(jsonString);
      this.chatHistory = history.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      console.error('Failed to import chat:', error);
    }
  }
}

// Export singleton instance
export const aiAssistant = new AIAssistant();
