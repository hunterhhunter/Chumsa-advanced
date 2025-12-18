import OpenAI from "openai";
import {
    ILLMService,
    EmbededData,
    MdBlocks,
    MdHeaddingBlock,
    AutoTagOptions,
    AutoTagResponse,
    TextGenerationOptions,
    ChatMessage
} from "../types/structures";
import { ItemView } from "obsidian";

/**
 * OpenAI Based LLM Integration Service
 * 
 * Provides all LLM related functions such as embedding, auto tag generation, text generation, etc.
 */
export class LLMService implements ILLMService {
    private client: OpenAI;
    private readonly EMBEDDING_MODEL = "text-embedding-3-small";
    private readonly EMBEDDING_DIMENSIONS = 1536;
    private readonly CHAT_MODEL = "gpt-4o-mini";

    constructor(apiKey: string) {
        // 🔧 Strengthen API Key Validation
        if (!apiKey || typeof apiKey !== 'string') {
            console.error('[LLMService] Constructor: API Key is not a string:', typeof apiKey);
            throw new Error('OpenAI API Key is invalid');
        }

        if (apiKey.trim().length === 0) {
            console.error('[LLMService] Constructor: API Key is empty');
            throw new Error('OpenAI API Key is empty');
        }

        if (!apiKey.startsWith('sk-')) {
            console.error('[LLMService] Constructor: API Key format error (must start with sk-)');
            throw new Error('OpenAI API Key format is invalid (must start with sk-)');
        }

        console.log('[LLMService] Initializing...');
        console.log(`[LLMService] API Key Length: ${apiKey.length}`);
        console.log(`[LLMService] API Key Prefix: ${apiKey.substring(0, 7)}...`);

        try {
            this.client = new OpenAI({
                apiKey: apiKey,
                dangerouslyAllowBrowser: true
            });
            console.log('[LLMService] ✅ OpenAI Client Initialization Complete');
        } catch (error) {
            console.error('[LLMService] OpenAI Client Initialization Failed:', error);
            throw new Error(`OpenAI Client Initialization Failed: ${(error as Error).message}`);
        }
    }

    /**
     * 클라이언트 상태 검증
     */
    private validateClient(): void {
        if (!this.client) {
            console.error('[LLMService] OpenAI 클라이언트가 없음');
            throw new Error('OpenAI 클라이언트가 초기화되지 않았습니다');
        }
    }

    // ==================== 임베딩 메서드 ====================

    /**
     * Generate Single Text Embedding
     */
    async embeddingOneText(text: string): Promise<number[]> {
        this.validateClient();
        // 🔧 Add Input Validation
        const cleanedText = this.cleanTextForEmbedding(text);

        if (!cleanedText || cleanedText.trim().length === 0) {
            console.warn('[LLMService] Skipping empty text');
            throw new Error('Empty text cannot be embedded');
        }

        try {
            const response = await this.client.embeddings.create({
                model: this.EMBEDDING_MODEL,
                input: cleanedText,
                encoding_format: "float"
            });

            const vector = response.data[0].embedding;
            this.validateVector(vector);

            return vector;
        } catch (error) {
            console.error('임베딩 생성 실패:', error);
            throw new Error(`임베딩 생성 중 오류 발생: ${(error as Error).message}`);
        }
    }

    /**
     * 여러 블록 일괄 임베딩 생성 (배치 처리)
     */
    async embeddingBlocks(blocks: MdBlocks): Promise<EmbededData[]> {
        // 🔧 빈 블록 필터링 및 텍스트 정리
        const validBlocks = blocks.blocks.filter(block => {
            const cleaned = this.cleanTextForEmbedding(block.text);
            return cleaned && cleaned.trim().length > 0;
        });

        if (validBlocks.length === 0) {
            console.warn(`[LLMService] ${blocks.fileName}: 유효한 블록이 없습니다`);
            return [];
        }

        // 🔧 텍스트 정리 및 길이 제한
        const texts = validBlocks.map(block => {
            const cleaned = this.cleanTextForEmbedding(block.text);
            // OpenAI 토큰 제한: 최대 8191 토큰 (약 30,000자)
            return cleaned.length > 30000
                ? cleaned.substring(0, 30000) + '...'
                : cleaned;
        });

        try {
            console.log(`[LLMService] ${blocks.fileName}: ${texts.length}개 블록 임베딩 시작`);

            const response = await this.client.embeddings.create({
                model: this.EMBEDDING_MODEL,
                input: texts,
                encoding_format: "float"
            });

            const embeddedData: EmbededData[] = response.data.map((item, index) => {
                this.validateVector(item.embedding);
                return {
                    id: validBlocks[index].id,
                    vector: item.embedding,
                    metadata: {
                        filePath: blocks.filePath,
                        fileName: blocks.fileName,
                        key: validBlocks[index].key
                    }
                };
            });

            console.log(`[LLMService] ${blocks.fileName}: ${embeddedData.length}개 임베딩 완료`);
            return embeddedData;

        } catch (error) {
            console.error(`[LLMService] ${blocks.fileName} 블록 임베딩 실패:`, error);

            // 🔧 상세 에러 로깅
            if (error instanceof Error) {
                console.error('에러 상세:', {
                    message: error.message,
                    validBlockCount: validBlocks.length,
                    textLengths: texts.map(t => t.length),
                    sampleTexts: texts.slice(0, 3).map(t => t.substring(0, 100))
                });
            }

            throw new Error(`블록 임베딩 중 오류 발생: ${(error as Error).message}`);
        }
    }

    /**
     * 텍스트 정리 (임베딩용)
     */
    private cleanTextForEmbedding(text: string): string {
        if (!text) return '';

        return text
            // 제어문자 제거 (줄바꿈 제외)
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
            // 연속된 공백 정규화
            .replace(/\s+/g, ' ')
            // 연속된 줄바꿈 제한 (최대 2개)
            .replace(/\n{3,}/g, '\n\n')
            // 앞뒤 공백 제거
            .trim();
    }

    // ==================== 자동 태그 생성 메서드 ====================

    /**
     * 문서 자동 태그 생성
     */
    async generateAutoTags(
        content: string,
        fileName: string,
        options: AutoTagOptions = {}
    ): Promise<AutoTagResponse> {
        const {
            maxTags = 10,
            language = 'ko',
            includeReasoning = false
        } = options;

        const systemPrompt = this.buildAutoTagSystemPrompt(maxTags, language, includeReasoning);
        const userPrompt = this.buildAutoTagUserPrompt(content, fileName);

        try {
            const response = await this.client.chat.completions.create({
                model: this.CHAT_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' }
            });

            const result = JSON.parse(
                response.choices[0].message.content || '{}'
            ) as AutoTagResponse;

            // 태그 정규화
            result.tags = result.tags.map((tag: string) =>
                tag.toLowerCase().trim().replace(/\s+/g, '-')
            );

            return result;

        } catch (error) {
            console.error('자동 태그 생성 실패:', error);
            throw new Error(`자동 태그 생성 중 오류 발생: ${(error as Error).message}`);
        }
    }

    /**
     * 범용 텍스트 생성 (향후 확장용)
     */
    async generateText(
        prompt: string,
        options: TextGenerationOptions = {}
    ): Promise<string> {
        const {
            model = this.CHAT_MODEL,
            temperature = 0.7,
            maxTokens = 1000,
            jsonMode = false
        } = options;

        try {
            const response = await this.client.chat.completions.create({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature,
                max_tokens: maxTokens,
                ...(jsonMode && { response_format: { type: 'json_object' } })
            });

            return response.choices[0].message.content || '';

        } catch (error) {
            console.error('텍스트 생성 실패:', error);
            throw new Error(`텍스트 생성 중 오류 발생: ${(error as Error).message}`);
        }
    }

    // ==================== 유틸리티 메서드 ====================

    /**
     * API 키 업데이트
     */
    updateApiKey(apiKey: string): void {
        console.log('[LLMService] API 키 업데이트 중...');

        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('유효하지 않은 API 키');
        }

        if (!apiKey.startsWith('sk-')) {
            throw new Error('API 키 형식 오류 (sk-로 시작해야 함)');
        }

        this.client = new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true
        });

        console.log('[LLMService] ✅ API 키 업데이트 완료');
    }

    /**
     * Validate Vector
     */
    private validateVector(vector: number[]): void {
        if (vector.length !== this.EMBEDDING_DIMENSIONS) {
            throw new Error(
                `Invalid vector dimensions: ${vector.length} (Expected: ${this.EMBEDDING_DIMENSIONS})`
            );
        }

        if (vector.some(v => isNaN(v))) {
            throw new Error('Vector contains NaN values');
        }
    }

    /**
     * Auto Tag Generation System Prompt
     */
    private buildAutoTagSystemPrompt(
        maxTags: number,
        language: string,
        includeReasoning: boolean
    ): string {
        const reasoningInstruction = includeReasoning
            ? '\n- "reasoning": Briefly explain why the tag was chosen.'
            : '';

        return `You are a document analysis expert. Analyze the given markdown document and automatically generate appropriate tags.

**Auto Tag Generation Criteria:**
1. Reflect the core topics and concepts of the document
2. Use specific and searchable keywords
3. Exclude duplicate or overly generic tags
4. Generate up to ${maxTags} tags
5. Use ${language === 'ko' ? 'Korean' : 'English'} tags

**Response Format (JSON):**
{
  "tags": ["tag1", "tag2", ...],
  "confidence": 0.85${reasoningInstruction}
}

**Tag Naming Convention:**
- Use lowercase
- Use underscores (_) instead of spaces
- Exclude special characters
- Concise and clear expressions`;
    }

    /**
     * Auto Tag Generation User Prompt
     */
    private buildAutoTagUserPrompt(content: string, fileName: string): string {
        const maxContentLength = 8000;
        const truncatedContent = content.length > maxContentLength
            ? content.substring(0, maxContentLength) + '\n\n[... Omitted below ...]'
            : content;

        return `Please analyze the following document and generate tags automatically.

**FileName:** ${fileName}

**Document Content:**
\`\`\`markdown
${truncatedContent}
\`\`\``;
    }

    /**
     * AI 채팅 완성 (기존 LLMService에 추가)
     */
    async createChatCompletion(
        messages: ChatMessage[],
        options?: {
            temperature?: number;
            maxTokens?: number;
        }
    ): Promise<string> {
        this.validateClient();

        try {
            const response = await this.client.chat.completions.create({
                model: this.CHAT_MODEL,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? 2000,
            });

            return response.choices[0]?.message?.content || '응답을 생성할 수 없습니다.';
        } catch (error) {
            console.error('[LLMService] 채팅 완성 실패:', error);
            throw new Error(`채팅 완성 중 오류: ${(error as Error).message}`);
        }
    }
}