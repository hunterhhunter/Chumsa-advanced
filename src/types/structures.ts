export interface EmbededData {
    id: number,
    vector: number[],
}

// TODO: EmbededData 인터페이스의 key가 blockname을 해싱한 결과인 인터페이스 정의

export interface MetaData {
    id: number,
    key: string,
    filePath: string,
}

export interface SearchResult {
    id: number,
    score: number,
}
export interface SearchResults {
    results: SearchResult[],
}

export interface EmbededDatas {
    data: EmbededData[],
}

export interface EmbedResult {
    vec: number[],
    tokens: number,
} 

export interface IVectorDB {
    loadMaps(): Promise<void>;

    initialize(indexFilePath: string, dimensions: number, maxElements: number): Promise<boolean>;

    addItems(data: EmbededData[]): Promise<void>;

    search(queryVector: number[], top_k: number): Promise<SearchResults>;

    save(): Promise<void>;

    count(): Promise<number>;
}

/**
 * 테스트를 위한 EmbededData 배열을 생성합니다.
 * @param count - 생성할 데이터의 개수
 * @param dimensions - 각 벡터의 차원 수 (기본값: 1536)
 * @returns {EmbededData[]} 생성된 목 데이터 배열
 */
export function createMockData(count: number, dimensions = 1536): EmbededData[] {
    const mockData: EmbededData[] = [];

    for (let i = 0; i < count; i++) {
        // 1536차원의 무작위 벡터 생성
        const randomVector = Array.from({ length: dimensions }, () => Math.random());

        const data: EmbededData = {
            id: i + 1, // 1, 2, 3, ...
            vector: randomVector,
        };
        mockData.push(data);
    }

    return mockData;
}