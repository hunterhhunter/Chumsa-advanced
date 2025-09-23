export interface EmbededData {
	key: string,
	text: string,
    vector: number[],
    filePath: string
}

export interface MetaData {
    key: string,
    text: string,
    filePath: string,
}

export interface VectorData {
	id: number,
    vector: number[],
    metadata: MetaData,
}

export interface SearchResult {
    id: number,
    score: number,
    metadata: MetaData,
}

export interface EmbededDatas {
    data: EmbededData,
}

export interface EmbedResult {
    vec: number[],
    tokens: number,
} 

export interface IVectorDB {
    loadMaps(): Promise<void>;

    initialize(indexFilePath: string, dimensions: number, maxElements: number): Promise<boolean>;

    addItem(data: VectorData[]): Promise<void>;

    search(queryVector: number[], top_k: number): Promise<SearchResult[]>;

    save(): Promise<void>;

    count(): Promise<number>;
}

/**
 * 테스트를 위한 VectorData 배열을 생성합니다.
 * @param count - 생성할 데이터의 개수
 * @param dimensions - 각 벡터의 차원 수 (기본값: 1536)
 * @returns {VectorData[]} 생성된 목 데이터 배열
 */
export function createMockData(count: number, dimensions = 1536): VectorData[] {
    const mockData: VectorData[] = [];

    for (let i = 0; i < count; i++) {
        // 1536차원의 무작위 벡터 생성
        const randomVector = Array.from({ length: dimensions }, () => Math.random());

        const data: VectorData = {
            id: i + 1, // 1, 2, 3, ...
            vector: randomVector,
            metadata: {
                key: `#Heading ${i + 1}`,
                text: `이것은 ${i + 1}번째 블록의 목 데이터 텍스트입니다.`,
                filePath: `mock/file-${i + 1}.md`
            }
        };
        mockData.push(data);
    }

    return mockData;
}