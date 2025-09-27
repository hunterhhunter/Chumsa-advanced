import { EmbededData } from "src/types/structures";

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