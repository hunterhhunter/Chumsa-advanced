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

