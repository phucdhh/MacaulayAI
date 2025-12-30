// AI Chat UI Component
import { aiAssistant } from './aiAssistant';

export class AIChatUI {
  private container: HTMLElement;
  private chatMessages: HTMLElement;
  private inputField: HTMLTextAreaElement;
  private sendButton: HTMLButtonElement;
  private modelSelect: HTMLSelectElement;
  private autoExplainCheckbox: HTMLInputElement;
  private isProcessing: boolean = false;
  private katexRenderTimeout: number | null = null;
  private userIsScrolling: boolean = false;
  private scrollTimeout: number | null = null;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.init();
  }

  private async init(): Promise<void> {
    this.container.innerHTML = this.getTemplate();
    this.setupElements();
    this.setupEventListeners();
    
    // Wait for AI assistant to initialize
    await aiAssistant.waitForInit();
    
    this.populateModelSelect();
    
    // Check KaTeX availability (don't wait)
    setTimeout(() => {
      const katex = (window as any).katex;
      if (!katex || !katex.renderMathInElement) {
        console.warn('KaTeX not available - math rendering disabled');
      }
    }, 1000);
  }

  private async waitForKaTeX(): Promise<void> {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // Max 5 seconds
      
      const checkKaTeX = () => {
        const katex = (window as any).katex;
        if (katex && katex.renderMathInElement) {
          console.log('KaTeX is ready!');
          resolve();
        } else if (attempts >= maxAttempts) {
          console.warn('KaTeX failed to load after 5 seconds, continuing without it');
          resolve(); // Continue anyway
        } else {
          attempts++;
          console.log(`Waiting for KaTeX... (attempt ${attempts}/${maxAttempts})`);
          setTimeout(checkKaTeX, 100);
        }
      };
      checkKaTeX();
    });
  }

  private getTemplate(): string {
    return `
      <div class="ai-chat-container">
        <div class="ai-chat-header">
          <div class="ai-chat-controls">
            <label for="ai-model-select">Model:</label>
            <select id="ai-model-select">
            </select>
            <label for="auto-explain-checkbox">
              <input type="checkbox" id="auto-explain-checkbox">
              Auto-explain
            </label>
          </div>
        </div>
        
        <div class="ai-chat-messages" id="ai-chat-messages">
          <div class="ai-welcome-message">
            <div class="ai-message-bubble ai-assistant-bubble">
              <div class="ai-message-content">
                Welcome! I'm your Macaulay2 assistant. Ask me about:
                <ul>
                  <li>Understanding Macaulay2 output</li>
                  <li>Algebraic geometry concepts</li>
                  <li>Commutative algebra theory</li>
                  <li>How to use Macaulay2 commands</li>
                </ul>
              </div>
              <div class="ai-message-footer">
                <span class="ai-message-time">${new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="ai-chat-input-area">
          <textarea 
            id="ai-chat-input" 
            class="ai-chat-input" 
            placeholder="Ask about Macaulay2 or algebraic concepts..."
            rows="2"
          ></textarea>
          <button id="ai-chat-send">
            SEND
          </button>
        </div>
      </div>
    `;
  }

  private setupElements(): void {
    this.chatMessages = document.getElementById('ai-chat-messages')!;
    this.inputField = document.getElementById('ai-chat-input') as HTMLTextAreaElement;
    this.sendButton = document.getElementById('ai-chat-send') as HTMLButtonElement;
    this.modelSelect = document.getElementById('ai-model-select') as HTMLSelectElement;
    this.autoExplainCheckbox = document.getElementById('auto-explain-checkbox') as HTMLInputElement;
  }

  private setupEventListeners(): void {
    this.sendButton.addEventListener('click', () => this.handleSend());
    
    this.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    this.modelSelect.addEventListener('change', () => {
      const modelId = this.modelSelect.value;
      aiAssistant.setModel(modelId);
    });

    this.autoExplainCheckbox.addEventListener('change', () => {
      aiAssistant.setAutoExplain(this.autoExplainCheckbox.checked);
    });

    // Detect user manual scroll
    this.chatMessages.addEventListener('scroll', () => {
      // Clear existing timeout
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }
      
      // Mark as user scrolling
      this.userIsScrolling = true;
      
      // Reset after 150ms of no scroll
      this.scrollTimeout = window.setTimeout(() => {
        this.userIsScrolling = false;
      }, 150);
    });
  }

  private populateModelSelect(): void {
    const models = aiAssistant.getModels();
    
    if (models.length === 0) {
      this.modelSelect.innerHTML = '<option>Loading models...</option>';
      return;
    }
    
    this.modelSelect.innerHTML = models.map(model => 
      `<option value="${model.id}" title="${model.description}">
        ${model.name}
      </option>`
    ).join('');
  }

  private async handleSend(): Promise<void> {
    const message = this.inputField.value.trim();
    if (!message || this.isProcessing) return;

    this.isProcessing = true;
    this.sendButton.disabled = true;
    this.inputField.value = '';

    // Add user message
    this.addUserMessage(message);

    try {
      // Show thinking indicator
      const thinkingId = this.showTypingIndicator();
      let hasThinking = false;
      let answerId: string | null = null;

      // Send to AI with thinking and answer callbacks
      const response = await aiAssistant.sendMessage(
        message, 
        (thinking) => {
          hasThinking = true;
          this.updateThinkingContent(thinkingId, thinking);
        },
        (answer) => {
          // Show answer bubble on first content (after thinking is done)
          if (!answerId) {
            answerId = this.showAnswerIndicator();
          }
          this.updateAnswerContent(answerId, answer);
        }
      );

      // Only keep thinking bubble if there was actual thinking content
      if (hasThinking) {
        this.finalizeThinkingBubble(thinkingId);
      } else {
        this.removeTypingIndicator(thinkingId);
      }

      // Finalize answer bubble (if it was created)
      if (answerId) {
        this.finalizeAnswerBubble(answerId, response);
      } else {
        // No answer content received, create bubble with response
        answerId = this.showAnswerIndicator();
        this.updateAnswerContent(answerId, response);
        this.finalizeAnswerBubble(answerId, response);
      }

    } catch (error) {
      console.error('AI Error:', error);
      this.addSystemMessage('Error: Failed to get AI response. Please try again.');
    } finally {
      this.isProcessing = false;
      this.sendButton.disabled = false;
      this.inputField.focus();
    }
  }

  private addUserMessage(content: string): void {
    const messageDiv = this.createMessageBubble('user', content);
    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  private addAssistantMessage(content: string): void {
    const history = aiAssistant.getChatHistory();
    const messageIndex = history.length - 1; // Last message is the assistant's response
    
    const messageDiv = this.createMessageBubble('assistant', content, messageIndex);
    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  private addSystemMessage(content: string): void {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-system-message';
    messageDiv.textContent = content;
    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  private createMessageBubble(role: 'user' | 'assistant', content: string, messageIndex?: number): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `ai-message-wrapper ai-${role}-wrapper`;

    const bubble = document.createElement('div');
    bubble.className = `ai-message-bubble ai-${role}-bubble`;
    
    // Add toggle button for assistant messages
    if (role === 'assistant') {
      bubble.classList.add('collapsed');
      
      const header = document.createElement('div');
      header.className = 'ai-bubble-header';
      
      const title = document.createElement('span');
      const currentModel = aiAssistant.getCurrentModel();
      const modelName = currentModel ? currentModel.name : 'AI';
      title.textContent = `${modelName} Response`;
      title.style.fontSize = '12px';
      title.style.fontWeight = '500';
      title.style.color = '#666';
      
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'ai-bubble-toggle';
      toggleBtn.innerHTML = '▼';
      toggleBtn.title = 'Expand/Collapse';
      toggleBtn.onclick = () => {
        if (bubble.classList.contains('collapsed')) {
          bubble.classList.remove('collapsed');
          bubble.classList.add('expanded');
          toggleBtn.innerHTML = '▲';
        } else {
          bubble.classList.remove('expanded');
          bubble.classList.add('collapsed');
          toggleBtn.innerHTML = '▼';
        }
      };
      
      header.appendChild(title);
      header.appendChild(toggleBtn);
      bubble.appendChild(header);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'ai-message-content';

    // If the AI included a Macaulay2-safe block marker, render human/readable
    // part separately and the Macaulay2-safe block in a copy-paste friendly code box.
    if (/Macaulay2-safe:/i.test(content)) {
      // Split on the marker
      const parts = content.split(/Macaulay2-safe:/i);
      const human = parts[0].trim();
      const code = parts.slice(1).join('Macaulay2-safe:').trim();

      if (human) contentDiv.innerHTML += this.formatContent(human) + '<br/>';
      // Wrap code in a dedicated block
      const safeBlock = document.createElement('div');
      safeBlock.className = 'm2-safe';
      const pre = document.createElement('pre');
      const codeEl = document.createElement('code');
      codeEl.textContent = code;
      pre.appendChild(codeEl);
      safeBlock.appendChild(pre);
      contentDiv.appendChild(safeBlock);
    } else {
      contentDiv.innerHTML = this.formatContent(content);
    }

    bubble.appendChild(contentDiv);

    // Try to render KaTeX in the human-readable part if KaTeX is available
    try {
      const katex = (window as any).katex;
      if (katex && katex.renderMathInElement) {
        katex.renderMathInElement(contentDiv, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\[', right: '\\]', display: true},
            {left: '\\(', right: '\\)', display: false}
          ],
          throwOnError: false
        });
      }
    } catch (err) {
      console.warn('KaTeX rendering failed:', err);
    }

    const footer = document.createElement('div');
    footer.className = 'ai-message-footer';
    
    const time = document.createElement('span');
    time.className = 'ai-message-time';
    time.textContent = new Date().toLocaleTimeString();
    footer.appendChild(time);

    // Add context checkbox for assistant messages
    if (role === 'assistant' && messageIndex !== undefined) {
      const contextLabel = document.createElement('label');
      contextLabel.className = 'ai-context-checkbox';
      contextLabel.innerHTML = `
        <input type="checkbox" data-message-index="${messageIndex}">
        <span>Include in context</span>
      `;
      
      const checkbox = contextLabel.querySelector('input') as HTMLInputElement;
      checkbox.addEventListener('change', () => {
        aiAssistant.toggleMessageContext(messageIndex);
      });
      
      footer.appendChild(contextLabel);
    }

    bubble.appendChild(footer);
    wrapper.appendChild(bubble);

    return wrapper;
  }

  private formatContent(content: string): string {
    // Protect math expressions and code from being formatted
    const mathPlaceholders: string[] = [];
    const codePlaceholders: string[] = [];
    let index = 0;
    
    // Temporarily replace expressions with placeholders
    let formatted = content;
    
    // Protect display math \[...\] (escape backslashes)
    formatted = formatted.replace(/\\\[([\s\S]*?)\\\]/g, (match) => {
      const placeholder = `___MATH_BRACKET_${index}___`;
      mathPlaceholders[index] = match;
      index++;
      return placeholder;
    });
    
    // Protect display math $$...$$
    formatted = formatted.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
      const placeholder = `___MATH_DISPLAY_${index}___`;
      mathPlaceholders[index] = match;
      index++;
      return placeholder;
    });
    
    // Protect inline math $...$
    formatted = formatted.replace(/\$([^$]+)\$/g, (match) => {
      const placeholder = `___MATH_INLINE_${index}___`;
      mathPlaceholders[index] = match;
      index++;
      return placeholder;
    });
    
    // Protect code blocks BEFORE inline code
    formatted = formatted.replace(/```([\s\S]*?)```/g, (match) => {
      const placeholder = `___CODE_BLOCK_${index}___`;
      codePlaceholders[index] = '<pre><code>' + match.slice(3, -3) + '</code></pre>';
      index++;
      return placeholder;
    });
    
    // Protect inline code (including * inside)
    formatted = formatted.replace(/`([^`]+)`/g, (match) => {
      const placeholder = `___CODE_INLINE_${index}___`;
      codePlaceholders[index] = '<code>' + match.slice(1, -1) + '</code>';
      index++;
      return placeholder;
    });
    
    // Now safe to do bold/italic formatting
    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic (only single *)
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Restore code (before math, so code can contain math-like strings)
    codePlaceholders.forEach((code, i) => {
      formatted = formatted.replace(`___CODE_BLOCK_${i}___`, code);
      formatted = formatted.replace(`___CODE_INLINE_${i}___`, code);
    });
    
    // Restore math expressions
    mathPlaceholders.forEach((math, i) => {
      formatted = formatted.replace(`___MATH_BRACKET_${i}___`, math);
      formatted = formatted.replace(`___MATH_DISPLAY_${i}___`, math);
      formatted = formatted.replace(`___MATH_INLINE_${i}___`, math);
    });
    
    return formatted;
  }

  private showTypingIndicator(): string {
    const id = 'typing-' + Date.now();
    const indicator = document.createElement('div');
    indicator.id = id;
    indicator.className = 'ai-typing-indicator';
    indicator.innerHTML = `
      <div class="ai-message-bubble ai-assistant-bubble ai-thinking-bubble expanded">
        <div class="ai-thinking-header">
          <div class="ai-thinking-header-left">
            <span class="ai-thinking-icon">🤔</span>
            <span class="ai-thinking-text">Thinking...</span>
          </div>
        </div>
        <div class="ai-thinking-content" id="${id}-content">
          <div class="ai-thinking-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    `;
    this.chatMessages.appendChild(indicator);
    this.scrollToBottom();
    return id;
  }

  private updateThinkingContent(id: string, thinking: string): void {
    const contentDiv = document.getElementById(`${id}-content`);
    if (!contentDiv || !thinking.trim()) return;

    // Ensure parent bubble is expanded
    const indicator = document.getElementById(id);
    const bubble = indicator?.querySelector('.ai-thinking-bubble');
    if (bubble && !bubble.classList.contains('expanded')) {
      bubble.classList.add('expanded');
    }

    // Check if thinking step div already exists
    let thinkingStep = contentDiv.querySelector('.ai-thinking-step') as HTMLElement;
    if (!thinkingStep) {
      // First time: create the div
      thinkingStep = document.createElement('div');
      thinkingStep.className = 'ai-thinking-step';
      contentDiv.innerHTML = ''; // Clear dots
      contentDiv.appendChild(thinkingStep);
    }

    // Update text content directly (no DOM recreation = no flicker)
    thinkingStep.textContent = thinking;
    
    // Auto-scroll thinking content to show latest
    contentDiv.scrollTop = contentDiv.scrollHeight;
    this.scrollToBottom();
  }

  private finalizeThinkingBubble(id: string): void {
    const indicator = document.getElementById(id);
    if (!indicator) return;

    const bubble = indicator.querySelector('.ai-thinking-bubble');
    if (!bubble) return;

    // Add toggle button to header
    const header = bubble.querySelector('.ai-thinking-header');
    if (header && !header.querySelector('.ai-bubble-toggle')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'ai-bubble-toggle';
      toggleBtn.innerHTML = '▲';
      toggleBtn.title = 'Expand/Collapse';
      toggleBtn.onclick = () => {
        if (bubble.classList.contains('collapsed')) {
          bubble.classList.remove('collapsed');
          bubble.classList.add('expanded');
          toggleBtn.innerHTML = '▲';
        } else {
          bubble.classList.remove('expanded');
          bubble.classList.add('collapsed');
          toggleBtn.innerHTML = '▼';
        }
      };
      header.appendChild(toggleBtn);
    }

    // Auto-collapse the thinking bubble
    bubble.classList.add('collapsed');
    const toggleBtn = header?.querySelector('.ai-bubble-toggle');
    if (toggleBtn) {
      toggleBtn.innerHTML = '▼';
    }

    // Change header text
    const thinkingText = header?.querySelector('.ai-thinking-text');
    if (thinkingText) {
      thinkingText.textContent = 'Chain of Thought';
    }

    // Remove the indicator class so it's no longer temporary
    indicator.classList.remove('ai-typing-indicator');
    indicator.classList.add('ai-thinking-complete');
  }

  private showAnswerIndicator(): string {
    const id = 'answer-' + Date.now();
    const indicator = document.createElement('div');
    indicator.id = id;
    indicator.className = 'ai-answer-indicator';
    
    const currentModel = aiAssistant.getCurrentModel();
    const modelName = currentModel ? currentModel.name : 'AI';
    
    indicator.innerHTML = `
      <div class="ai-message-bubble ai-assistant-bubble ai-answer-bubble expanded">
        <div class="ai-bubble-header">
          <span style="font-size: 12px; font-weight: 500; color: #666;">${modelName} Response</span>
        </div>
        <div class="ai-message-content" id="${id}-content">
          <div class="ai-thinking-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    `;
    this.chatMessages.appendChild(indicator);
    this.scrollToBottom();
    return id;
  }

  private updateAnswerContent(id: string, answer: string): void {
    const contentDiv = document.getElementById(`${id}-content`);
    if (!contentDiv || !answer.trim()) return;

    // Format content with markdown-like formatting
    let formatted = this.formatContent(answer);

    // Update content
    contentDiv.innerHTML = formatted;

    // Render KaTeX immediately for each update - no debounce
    // This allows formulas to render as soon as they're complete
    this.renderKaTeX(contentDiv);

    // Auto-scroll the answer bubble itself to bottom during streaming
    const indicator = document.getElementById(id);
    if (indicator) {
      const bubble = indicator.querySelector('.ai-answer-bubble') as HTMLElement;
      if (bubble) {
        bubble.scrollTop = bubble.scrollHeight;
      }
    }

    // Auto-scroll to show latest content
    this.scrollToBottom();
  }

  private finalizeAnswerBubble(id: string, finalAnswer: string): void {
    const indicator = document.getElementById(id);
    if (!indicator) return;

    const bubble = indicator.querySelector('.ai-answer-bubble');
    if (!bubble) return;

    const contentDiv = document.getElementById(`${id}-content`);
    if (!contentDiv) return;

    // Handle Macaulay2-safe block if present
    if (/Macaulay2-safe:/i.test(finalAnswer)) {
      const parts = finalAnswer.split(/Macaulay2-safe:/i);
      const human = parts[0].trim();
      const code = parts.slice(1).join('Macaulay2-safe:').trim();

      contentDiv.innerHTML = '';
      if (human) {
        const humanDiv = document.createElement('div');
        humanDiv.innerHTML = this.formatContent(human);
        this.renderKaTeX(humanDiv);
        contentDiv.appendChild(humanDiv);
      }

      // Add code block
      const safeBlock = document.createElement('div');
      safeBlock.className = 'm2-safe';
      const pre = document.createElement('pre');
      const codeEl = document.createElement('code');
      codeEl.textContent = code;
      pre.appendChild(codeEl);
      safeBlock.appendChild(pre);
      contentDiv.appendChild(safeBlock);
    } else {
      // Already updated via streaming, just ensure KaTeX is rendered
      this.renderKaTeX(contentDiv);
    }

    // Add toggle button to header
    const header = bubble.querySelector('.ai-bubble-header');
    if (header && !header.querySelector('.ai-bubble-toggle')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'ai-bubble-toggle';
      toggleBtn.innerHTML = '▲';
      toggleBtn.title = 'Expand/Collapse';
      toggleBtn.onclick = () => {
        if (bubble.classList.contains('collapsed')) {
          bubble.classList.remove('collapsed');
          bubble.classList.add('expanded');
          toggleBtn.innerHTML = '▲';
        } else {
          bubble.classList.remove('expanded');
          bubble.classList.add('collapsed');
          toggleBtn.innerHTML = '▼';
        }
      };
      header.appendChild(toggleBtn);
    }

    // Add footer with timestamp and context checkbox
    const footer = document.createElement('div');
    footer.className = 'ai-message-footer';
    
    const time = document.createElement('span');
    time.className = 'ai-message-time';
    time.textContent = new Date().toLocaleTimeString();
    footer.appendChild(time);

    // Add context checkbox
    const history = aiAssistant.getChatHistory();
    const messageIndex = history.length - 1;
    
    const contextLabel = document.createElement('label');
    contextLabel.className = 'ai-context-checkbox';
    contextLabel.innerHTML = `
      <input type="checkbox" data-message-index="${messageIndex}">
      <span>Include in context</span>
    `;
    
    const checkbox = contextLabel.querySelector('input') as HTMLInputElement;
    checkbox.addEventListener('change', () => {
      aiAssistant.toggleMessageContext(messageIndex);
    });
    
    footer.appendChild(contextLabel);
    bubble.appendChild(footer);

    // Remove temporary indicator class
    indicator.classList.remove('ai-answer-indicator');
    indicator.classList.add('ai-answer-complete');
  }

  private renderKaTeX(element: HTMLElement): void {
    try {
      const katex = (window as any).katex;
      
      if (katex && katex.renderMathInElement) {
        katex.renderMathInElement(element, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\[', right: '\\]', display: true},
            {left: '\\(', right: '\\)', display: false}
          ],
          throwOnError: false,
          trust: true
        });
      } else {
        // KaTeX not available, retry after delay
        setTimeout(() => {
          const katexRetry = (window as any).katex;
          if (katexRetry && katexRetry.renderMathInElement) {
            katexRetry.renderMathInElement(element, {
              delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\[', right: '\\]', display: true},
                {left: '\\(', right: '\\)', display: false}
              ],
              throwOnError: false,
              trust: true
            });
          }
        }, 500);
      }
    } catch (err) {
      // Silent fail
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private removeTypingIndicator(id: string): void {
    const indicator = document.getElementById(id);
    if (indicator) {
      indicator.remove();
    }
  }

  private scrollToBottom(): void {
    // Always allow manual scrolling - check if user is actively scrolling UP
    const scrollHeight = this.chatMessages.scrollHeight;
    const scrollTop = this.chatMessages.scrollTop;
    const clientHeight = this.chatMessages.clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // Auto-scroll to bottom if:
    // 1. User is not actively scrolling (userIsScrolling is false after 150ms), OR
    // 2. User is already near bottom (within 200px)
    if (!this.userIsScrolling || distanceFromBottom < 200) {
      requestAnimationFrame(() => {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      });
    }
  }

  public async explainMacaulay2Output(output: string): Promise<void> {
    if (!aiAssistant.isAutoExplainEnabled()) return;

    const explanation = await aiAssistant.explainOutput(output);
    this.addAssistantMessage(explanation);
  }

  public clearChat(): void {
    aiAssistant.clearHistory();
    this.chatMessages.innerHTML = '';
    this.init();
  }
}

// Export for use in main app
export let aiChatUI: AIChatUI | null = null;

export function initAIChat(containerId: string): void {
  aiChatUI = new AIChatUI(containerId);
}
