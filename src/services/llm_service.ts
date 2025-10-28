import OpenAI from "openai";
import { 
    ILLMService, 
    EmbededData, 
    MdBlocks, 
    MdHeaddingBlock,
    AutoTagOptions,
    AutoTagResponse,
    TextGenerationOptions
} from "../types/structures";

/**
 * OpenAI 기반 LLM 통합 서비스
 * 
 * 임베딩, 자동 태그 생성, 텍스트 생성 등 모든 LLM 관련 기능을 제공합니다.
 */
export class LLMService implements ILLMService {
    private client: OpenAI;
    private readonly EMBEDDING_MODEL = "text-embedding-3-small";
    private readonly EMBEDDING_DIMENSIONS = 1536;
    private readonly CHAT_MODEL = "gpt-4o-mini";

    constructor(apiKey: string) {
        this.client = new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true
        });
    }

    // ==================== 임베딩 메서드 ====================

    /**
     * 단일 텍스트 임베딩 생성
     */
    async embeddingOneText(text: string): Promise<number[]> {
        try {
            const response = await this.client.embeddings.create({
                model: this.EMBEDDING_MODEL,
                input: text
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
     * 단일 블록 임베딩 생성
     */
    async embeddingBlock(block: MdHeaddingBlock): Promise<EmbededData> {
        const vector = await this.embeddingOneText(block.text);
        
        // metadata 생성 (key에서 filePath, fileName 추출)
        const keyParts = block.key.split(' of ');
        const fileName = keyParts[1] || 'unknown';
        
        return { 
            id: block.id, 
            vector: vector
        };
    }

    /**
     * 여러 블록 일괄 임베딩 생성 (배치 처리)
     */
    async embeddingBlocks(blocks: MdBlocks): Promise<EmbededData[]> {
        const texts = blocks.blocks.map(block => block.text);

        try {
            const response = await this.client.embeddings.create({
                model: this.EMBEDDING_MODEL,
                input: texts
            });

            const embeddedData: EmbededData[] = response.data.map((item, index) => {
                this.validateVector(item.embedding);
                return {
                    id: blocks.blocks[index].id,
                    vector: item.embedding,
                    metadata: {
                        filePath: blocks.filePath,
                        fileName: blocks.fileName,
                        key: blocks.blocks[index].key
                    }
                };
            });

            return embeddedData;
        } catch (error) {
            console.error('블록 임베딩 실패:', error);
            throw new Error(`블록 임베딩 중 오류 발생: ${(error as Error).message}`);
        }
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
     * API 키 업데이트 (설정 변경 시 사용)
     */
    updateApiKey(apiKey: string): void {
        this.client = new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true
        });
    }

    /**
     * 벡터 유효성 검증
     */
    private validateVector(vector: number[]): void {
        if (vector.length !== this.EMBEDDING_DIMENSIONS) {
            throw new Error(
                `잘못된 벡터 차원: ${vector.length} (예상: ${this.EMBEDDING_DIMENSIONS})`
            );
        }

        if (vector.some(v => isNaN(v))) {
            throw new Error('벡터에 NaN 값이 포함되어 있습니다');
        }
    }

    /**
     * 자동 태그 생성용 시스템 프롬프트
     */
    private buildAutoTagSystemPrompt(
        maxTags: number,
        language: string,
        includeReasoning: boolean
    ): string {
        const reasoningInstruction = includeReasoning
            ? '\n- "reasoning": 태그를 선택한 이유를 간단히 설명합니다.'
            : '';

        return `당신은 문서 분석 전문가입니다. 주어진 마크다운 문서를 분석하여 적절한 태그를 자동으로 생성합니다.

**자동 태그 생성 기준:**
1. 문서의 핵심 주제와 개념을 반영
2. 구체적이고 검색 가능한 키워드 사용
3. 중복되거나 지나치게 일반적인 태그 제외
4. 최대 ${maxTags}개까지 생성
5. ${language === 'ko' ? '한국어' : '영어'} 태그 사용

**응답 형식 (JSON):**
{
  "tags": ["태그1", "태그2", ...],
  "confidence": 0.85${reasoningInstruction}
}

**태그 명명 규칙:**
- 소문자 사용
- 공백 대신 언더바(_) 사용
- 특수문자 제외
- 간결하고 명확한 표현`;
    }

    /**
     * 자동 태그 생성용 사용자 프롬프트
     */
    private buildAutoTagUserPrompt(content: string, fileName: string): string {
        const maxContentLength = 8000;
        const truncatedContent = content.length > maxContentLength
            ? content.substring(0, maxContentLength) + '\n\n[... 이하 생략 ...]'
            : content;

        return `다음 문서를 분석하여 태그를 자동으로 생성해주세요.

**파일명:** ${fileName}

**문서 내용:**
\`\`\`markdown
${truncatedContent}
\`\`\``;
    }
}