import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import MyPlugin from '../main';
import { ChatMessage } from '../types/structures';

export const AI_CHAT_VIEW_TYPE = "ai-chat-view";

export class AIChatView extends ItemView {
    private plugin: MyPlugin;
    private messagesContainer!: HTMLElement;
    private messages: Array<{ role: 'user' | 'assistant'; text: string }> = [];

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return AI_CHAT_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "AI 채팅";
    }

    getIcon(): string {
        return "message-circle";
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('ai-chat-container');

        // 메시지 영역
        this.messagesContainer = container.createDiv({ cls: 'ai-chat-messages' });

        // 입력 영역
        const inputContainer = container.createDiv({ cls: 'ai-chat-input-container' });
        
        const input = inputContainer.createEl('textarea', {
            cls: 'ai-chat-input',
            attr: { placeholder: '메시지를 입력하세요...' }
        });

        const sendButton = inputContainer.createEl('button', {
            text: '전송',
            cls: 'ai-chat-send-button'
        });

        // 전송 핸들러
        const handleSend = async () => {
            const message = input.value.trim();
            if (!message) return;

            input.value = '';
            
            // 사용자 메시지 추가
            this.addMessage('user', message);

            try {
                // AI 응답 생성
                const response = await this.getAIResponse(message);
                this.addMessage('assistant', response);
            } catch (error) {
                new Notice('AI 응답 생성 실패');
                console.error(error);
            }
        };

        sendButton.addEventListener('click', handleSend);
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                handleSend();
            }
        });
    }

    private addMessage(role: 'user' | 'assistant', text: string) {
        this.messages.push({ role, text });

        const messageEl = this.messagesContainer.createDiv({
            cls: `ai-chat-message ai-chat-message-${role}`
        });

        messageEl.createDiv({ cls: 'ai-chat-message-role', text: role === 'user' ? '사용자' : 'AI' });
        messageEl.createDiv({ cls: 'ai-chat-message-text', text });

        // 스크롤 하단으로
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    private async getAIResponse(message: string): Promise<string> {
        if (!this.plugin.documentService?.llmService) {
            throw new Error('LLMService가 초기화되지 않았습니다');
        }

        const chatMessages: ChatMessage[] = [
            {
                role: 'system',
                content: '당신은 Obsidian 볼트의 지식 관리 어시스턴트입니다. 간결하고 명확하게 답변하며, 마크다운 형식을 사용합니다.'
            },
            ...this.messages.slice(-10).map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.text
            })),
            {
                role: 'user',
                content: message
            }
        ];

        return await this.plugin.documentService.llmService.createChatCompletion(chatMessages);
    }

    async onClose() {
        this.messagesContainer.empty();
    }
}