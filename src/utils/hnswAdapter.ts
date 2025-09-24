import { EmbededData, IVectorDB, SearchResult, SearchResults } from '../types/structures';
import { HierarchicalNSW } from 'hnswlib-wasm/dist/hnswlib-wasm';
import { loadHnswlib, syncFileSystem, HnswlibModule } from 'hnswlib-wasm';
import { normalizePath, App } from 'obsidian';

// DONE: 250923 벡터 인덱싱과 검색만을 담당하는 클래스로서의 역할을 상기하며 각 함수와 데이터가 알맞게 짜여져 있는지 확인

/**
 * HNSWLib를 사용한 고성능 벡터 데이터베이스 어댑터 클래스입니다.
 * 코사인 유사도 기반의 근사 최근접 이웃 검색을 지원하며,
 * 임베딩 벡터의 저장, 검색, 영속성 관리를 담당합니다.
 * 
 * @example
 * ```typescript
 * const adapter = new HNSWLibAdapter(app);
 * await adapter.initialize('index.hnsw', 1536, 10000);
 * await adapter.addItem([vectorData]);
 * const results = await adapter.search(queryVector, 5);
 * ```
 */
export class HNSWLibAdapter implements IVectorDB {
    private app: App;
    private hnswlib: HnswlibModule;
    private hnswIndex: HierarchicalNSW;
    private indexFileName: string;
    private dimension: number;
    private idToVectorMap: Map<number, number[]> = new Map();

    /**
     * HNSWLibAdapter 인스턴스를 생성합니다.
     * 
     * @param app - Obsidian 앱 인스턴스로, 파일 시스\\템 접근에 사용됩니다.
     * 
     * @example
     * ```typescript
     * const adapter = new HNSWLibAdapter(this.app);
     * ```
     */
    public constructor(app: App) {
        this.app = app;
    }

    /**
     * HNSW 인덱스를 초기화합니다. 기존 인덱스 파일이 존재하면 로드하고,
     * 없으면 새로운 인덱스를 생성합니다.
     * 
     * @param indexFileName - 인덱스 파일의 이름 (예: 'index.hnsw')
     * @param dimensions - 벡터의 차원 수 (예: 1536)
     * @param maxElements - 인덱스에 저장할 수 있는 최대 요소 수
     * @returns Promise<boolean> - 초기화 성공 시 true 반환
     * 
     * @example
     * ```typescript
     * const success = await adapter.initialize('embeddings.hnsw', 1536, 50000);
     * console.log('초기화 완료:', success);
     * ```
     */
    public async initialize(indexFileName: string, dimensions: number, maxElements: number): Promise<boolean> {
        this.hnswlib = await loadHnswlib();
        this.indexFileName = indexFileName;
        this.dimension = dimensions;

        this.hnswIndex = new this.hnswlib.HierarchicalNSW('cosine', dimensions, indexFileName);
        await syncFileSystem('read');

        const exist = this.hnswlib.EmscriptenFileSystemManager.checkFileExists(indexFileName);
        if (!exist) {
            this.hnswIndex.initIndex(maxElements, 32, 150, 42);
            this.hnswIndex.setEfSearch(32);
        } else {
            this.hnswIndex.readIndex(indexFileName, maxElements);
            await this.loadMaps();
            this.hnswIndex.setEfSearch(32);
        }

        return true;
    }

    /**
     * 벡터 데이터를 인덱스에 추가합니다. 이미 존재하는 ID는 건너뛰고
     * 새로운 데이터만 추가합니다.
     * 
     * @param data - 추가할 벡터 데이터 배열
     * @returns Promise<void> - 추가 작업 완료를 나타내는 Promise
     * 
     * @throws {Error} 인덱스가 초기화되지 않은 경우 오류 발생
     * 
     * @example
     * ```typescript
     * const vectorData = [{
     *   id: 1,
     *   vector: [0.1, 0.2, 0.3, ...],
     *   metadata: { filePath: 'note.md', key: 'heading1', tex: '내용' }
     * }];
     * await adapter.addItem(vectorData);
     * ```
     */
    async addItems(data: EmbededData[]): Promise<void> {
        if (!this.hnswIndex) throw new Error("Index is not initialized.");

        const vectorsToAdd: number[][] = [];
        const ids: number[] = [];

        // 데이터 검증 및 필터링
        for (const each of data) {
            // 벡터 유효성 검사
            if (!each.vector || each.vector.length === 0) {
                console.warn(`빈 벡터 건너뛰기: ID ${each.id}`);
                continue;
            }
            
            if (each.vector.length !== this.dimension) {
                console.warn(`잘못된 벡터 차원: ID ${each.id}, 예상: ${this.dimension}, 실제: ${each.vector.length}`);
                continue;
            }
            
            // NaN 또는 undefined 체크
            if (each.vector.some(v => v === undefined || v === null || isNaN(v))) {
                console.warn(`잘못된 벡터 값: ID ${each.id}`);
                continue;
            }
            
            // 중복 제거
            if (this.idToVectorMap.has(each.id)) {
                console.warn(`이미 존재하는 ID 값: ID ${each.id}`);
                continue;
            }

            // 원소 추가
            ids.push(each.id);
            vectorsToAdd.push(each.vector);
            this.idToVectorMap.set(each.id, each.vector);
        }

        console.log('ids: %d, vectors: %d', ids.length, vectorsToAdd.length)

        if (ids.length === 0) {
            console.log("추가할 유효한 벡터가 없습니다.");
            return;
        }

        try {
            console.log(`${ids.length}개 벡터 추가 시작`);
            await this.hnswIndex.addPoints(vectorsToAdd, ids, false);
            console.log(`${ids.length}개 벡터 추가 완료`);
        } catch (error) {
            console.error("HNSW 인덱스 추가 실패:", error);
            throw error;
        }
    }

    /**
     * 주어진 쿼리 벡터와 가장 유사한 벡터들을 검색합니다.
     * 코사인 유사도를 기반으로 하며, 거리값을 유사도 점수로 변환합니다.
     * 
     * @param queryVector - 검색할 쿼리 벡터 (차원이 인덱스와 일치해야 함)
     * @param top_k - 반환할 최대 결과 수
     * @returns Promise<SearchResult[]> - 유사도 점수와 메타데이터를 포함한 검색 결과 배열
     * 
     * @example
     * ```typescript
     * const queryVector = [0.1, 0.2, 0.3, ...]; // 1536차원 벡터
     * const results = await adapter.search(queryVector, 5);
     * results.forEach(result => {
     *   console.log(`유사도: ${result.score}, 텍스트: ${result.metadata.text}`);
     * });
     * ```
     */
    // DONE: search 재구현
    async search(queryVector: number[], top_k: number): Promise<SearchResults> {
        const result = this.hnswIndex.searchKnn(queryVector, top_k, undefined);

        const returnValue: SearchResults = { results: [] };

        for (let i = 0; i < result.neighbors.length; i++) {
            const label = result.neighbors[i];
            const score = result.distances[i];

            const eachResult: SearchResult = ({
                id: label,
                score: 1 - score, 
            });

            returnValue.results.push(eachResult);
        }

        return returnValue;
    }
    
    /**
     * 특정 ID의 벡터를 인덱스에서 제거합니다.
     * 
     * @param id - 제거할 벡터의 ID
     * @returns Promise<void>
     */
    async removeItem(id: number): Promise<void> {
        if (this.idToVectorMap.get(id) === undefined) {
            console.warn(`ID ${id}에 해당하는 벡터을 찾을 수 없습니다.`);
            return;
        }
        
        try {
            // HNSW 인덱스에서 제거
            this.hnswIndex.markDelete(id);
            this.idToVectorMap.delete(id);
            
            console.log(`벡터 제거 완료: ID=${id}`);
        } catch (error) {
            console.error(`벡터 제거 실패: ID=${id}`, error);
            throw error;
        }
    }
    
    /**
     * 인덱스와 매핑 데이터를 파일 시스템에 저장합니다.
     * HNSW 인덱스 파일과 ID 매핑 정보를 모두 저장합니다.
     * 
     * @returns Promise<void> - 저장 작업 완료를 나타내는 Promise
     * 
     * @example
     * ```typescript
     * await adapter.save();
     * console.log('인덱스 저장 완료');
     * ```
     */
    async save(): Promise<void> {
        await this.hnswIndex.writeIndex(this.indexFileName);
        await this.saveMaps();
    }

    /**
     * ID와 라벨 간의 매핑 정보와 벡터 데이터를 JSON 파일로 저장합니다.
     * 세 개의 매핑 파일을 생성합니다: ID→라벨, 라벨→ID, 벡터 데이터
     * 
     * @returns Promise<void> - 매핑 저장 작업 완료를 나타내는 Promise
     * 
     * @example
     * ```typescript
     * await adapter.saveMaps();
     * // 다음 파일들이 생성됩니다:
     * // - ID_TO_LABEL_MAP.json
     * // - LABEL_TO_ID_MAP.json  
     * // - VECTOR_DATA_MAP.json
     * ```
     */
    async saveMaps(): Promise<void> {
		const saveIdToVector = JSON.stringify(Object.fromEntries(this.idToVectorMap), null, 2);

		const pluginPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa`);
		
		try {
			await this.app.vault.adapter.write(`${pluginPath}/ID_TO_VECTOR.json`, saveIdToVector);
			console.log("맵 저장 완료");
		} catch (error) {
			console.error("맵 저장 실패:", error);
			throw error;
		}
    }

    /**
     * 저장된 JSON 파일에서 ID 매핑 정보와 벡터 데이터를 로드합니다.
     * 파일이 존재하지 않거나 파싱에 실패하면 빈 맵으로 초기화합니다.
     * 
     * @returns Promise<void> - 매핑 로드 작업 완료를 나타내는 Promise
     * 
     * @example
     * ```typescript
     * await adapter.loadMaps();
     * console.log('매핑 데이터 로드 완료');
     * ```
     */
    async loadMaps(): Promise<void> {
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/ID_TO_VECTOR.json`);
        try {
            const idToVectorString = await this.app.vault.adapter.read(mapPath);

            const idToVectorObj = JSON.parse(idToVectorString);

            this.idToVectorMap = new Map(
                Object.entries(idToVectorObj).map(([key, value]) => [Number(key), value as number[]])
            );
        } catch (error) {
            this.idToVectorMap.clear();
        }
    }
    
    /**
     * 모든 매핑 데이터를 초기화합니다.
     * ID-라벨 매핑과 벡터 데이터 매핑을 모두 빈 상태로 만듭니다.
     * 
     * @returns Promise<void> - 매핑 초기화 작업 완료를 나타내는 Promise
     * 
     * @example
     * ```typescript
     * await adapter.resetMaps();
     * console.log('모든 매핑 데이터 초기화 완료');
     * ```
     */
    async resetMap() {
        this.idToVectorMap.clear();
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/ID_TO_VECTOR.json`);
        const isExist = await this.app.vault.adapter.exists(mapPath);
        if (isExist) {
            await this.app.vault.adapter.remove(mapPath);
        }
    }

    /**
     * 인덱스에 저장된 벡터의 개수를 반환합니다.
     * 
     * @returns Promise<number> - 현재 인덱스에 저장된 벡터의 총 개수
     * 
     * @example
     * ```typescript
     * const vectorCount = await adapter.count();
     * console.log(`저장된 벡터 수: ${vectorCount}`);
     * ```
     */
    async count(): Promise<number> {
        return this.hnswIndex.getCurrentCount();
    }

    /**
     * 인덱스를 완전히 초기화하고 새로운 빈 인덱스를 생성합니다.
     * 기존의 모든 벡터 데이터와 매핑 정보가 삭제됩니다.
     * 
     * @param maxElements - 새 인덱스의 최대 요소 수
     * @param dimensions - 새 인덱스의 벡터 차원 수
     * @returns Promise<void> - 인덱스 초기화 작업 완료를 나타내는 Promise
     * 
     * @example
     * ```typescript
     * await adapter.resetIndex(50000, 1536);
     * console.log('인덱스가 완전히 초기화되었습니다');
     * ```
     */
    async resetIndex(maxElements: number, dimensions: number): Promise<void> {
        this.hnswIndex = new this.hnswlib.HierarchicalNSW('cosine', dimensions, this.indexFileName);
        await syncFileSystem('read');
        this.hnswIndex.initIndex(maxElements, 32, 150, 42);
        this.hnswIndex.setEfSearch(32);
        
        await this.resetMap();
        this.save();
    }


    /**
     * 벡터 데이터 매핑 맵을 반환합니다.
     * ID를 키로 하여 전체 벡터 데이터에 접근할 수 있습니다.
     * 
     * @returns Map<number, VectorData> - ID를 키로 하고 벡터 데이터를 값으로 하는 매핑
     * 
     * @example
     * ```typescript
     * const vectorDataMap = adapter.getVectorDataMap();
     * const data = vectorDataMap.get(1);
     * console.log('ID 1의 텍스트:', data?.metadata.text);
     * ```
     */
    getIdToVectorMap() {
        return this.idToVectorMap;
    }
}