export interface EmbededData {
    id: number,                 // key를 해싱한 결과
    vector: number[],           // text를 임베딩한 결과
}

export interface MetaData {
    id: number,             // key를 해싱한 결과
    key: string,            // 파일명/헤더명 순
    filePath: string,
    fileName: string,
}

export interface VectorSearchResult {
    id: number,             // hnsw에 저장된 id(key를 해싱한 결과)
    score: number,          // 유사도 점수
}

export interface VectorSearchResults {
    results: VectorSearchResult[],
}

export interface EmbededDatas {
    data: EmbededData[],
}

export interface EmbedResult {
    vec: number[],          // text를 임베딩한 결과
    tokens: number,         // 토큰 수
}

export interface MdHeaddingBlock { // MdBlock -> 
    id: number,             // key를 해싱한 결과
    key: string,            // 파일명/헤더명 순
    text: string,           // 내용
}

export interface MdBlocks { // MdBlocks => {fileName: [{id, key, text}, ..]}
    filePath: string,
    fileName: string,
    blocks: MdHeaddingBlock[]
}

export interface MainDataBaseSearchResult {
    id: number,
    score: number,
    metadata: MetaData,
    block: MdHeaddingBlock
}

export interface IVectorDB {
    loadMaps(): Promise<void>;

    initialize(indexFilePath: string, dimensions: number, maxElements: number): Promise<boolean>;

    addItems(data: EmbededData[]): Promise<void>;

    search(queryVector: number[], top_k: number): Promise<VectorSearchResults>;

    save(): Promise<void>;

    count(): Promise<number>;
}

/**
 * 검색 필터 설정
 */
export interface SearchFilterSettings {
    vectorWeight: number;        // 벡터 유사도 가중치 (0.0 ~ 1.0)
    tagWeight: number;           // 태그 유사도 가중치 (0.0 ~ 1.0)
    qualityThreshold: number;    // 최소 품질 점수 (0.0 ~ 1.0)
}

/**
 * 자동 태그 생성 옵션
 */
export interface AutoTagOptions {
    maxTags?: number;           // 최대 태그 개수 (기본값: 10)
    language?: string;          // 태그 언어 (기본값: 'ko')
    includeReasoning?: boolean; // 생성 이유 포함 여부
}

/**
 * 자동 태그 생성 응답
 */
export interface AutoTagResponse {
    tags: string[];
    confidence?: number;
    reasoning?: string;
}

/**
 * 자동 태그 적용 결과
 */
export interface AutoTagResult {
    filePath: string;
    fileName: string;
    generatedTags: string[];
    existingTags: string[];
    addedTags: string[];
    confidence?: number;
}

/**
 * 텍스트 생성 옵션
 */
export interface TextGenerationOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
}

/**
 * LLM 서비스 통합 인터페이스
 */
export interface ILLMService {
    // 임베딩 관련
    embeddingOneText(text: string): Promise<number[]>;
    embeddingBlock(block: MdHeaddingBlock): Promise<EmbededData>;
    embeddingBlocks(blocks: MdBlocks): Promise<EmbededData[]>;
    
    // 자동 태그 생성
    generateAutoTags(content: string, fileName: string, options?: AutoTagOptions): Promise<AutoTagResponse>;
    
    // 범용 텍스트 생성 (향후 확장용)
    generateText(prompt: string, options?: TextGenerationOptions): Promise<string>;
    
    // 유틸리티
    updateApiKey(apiKey: string): void;
}