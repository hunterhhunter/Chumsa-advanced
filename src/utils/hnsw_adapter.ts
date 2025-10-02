import { EmbededData, IVectorDB, VectorSearchResult, VectorSearchResults } from '../types/structures';
import { HierarchicalNSW } from 'hnswlib-wasm/dist/hnswlib-wasm';
import { loadHnswlib, syncFileSystem, HnswlibModule } from 'hnswlib-wasm';
import { normalizePath, App } from 'obsidian';

// DONE: 250923 벡터 인덱싱과 검색만을 담당하는 클래스로서의 역할을 상기하며 각 함수와 데이터가 알맞게 짜여져 있는지 확인

export class HNSWLibAdapter implements IVectorDB {
    private app: App;
    private hnswlib: HnswlibModule;
    private hnswIndex: HierarchicalNSW;
    private indexFileName: string;
    private dimension: number;
    private idToVectorMap: Map<number, number[]> = new Map();

    public constructor(app: App) {
        this.app = app;
    }

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

    async addItems(data: EmbededData[]): Promise<void> {
        if (!this.hnswIndex) throw new Error("Index is not initialized.");

        const vectorsToAdd: number[][] = [];
        const ids: number[] = [];

        // 데이터 검증 및 필터링
        for (const each of data) {
            // 벡터 유효성 검사
            if (!each.vector || each.vector.length === 0) {
                console.warn(`HNSWLibAdapter - 빈 벡터 건너뛰기: ID ${each.id}`);
                continue;
            }
            
            if (each.vector.length !== this.dimension) {
                console.warn(`HNSWLibAdapter - 잘못된 벡터 차원: ID ${each.id}, 예상: ${this.dimension}, 실제: ${each.vector.length}`);
                continue;
            }
            
            // NaN 또는 undefined 체크
            if (each.vector.some(v => v === undefined || v === null || isNaN(v))) {
                console.warn(`HNSWLibAdapter - 잘못된 벡터 값: ID ${each.id}`);
                continue;
            }
            
            // 중복 제거
            if (this.idToVectorMap.has(each.id)) {
                console.warn(`HNSWLibAdapter - 이미 존재하는 ID 값: ID ${each.id}`);
                continue;
            }

            // 원소 추가
            ids.push(each.id);
            vectorsToAdd.push(each.vector);
            this.idToVectorMap.set(each.id, each.vector);
        }

        if (ids.length === 0) {
            console.log("HNSWLibAdapter - 추가할 유효한 벡터가 없습니다.");
            return;
        }

        try {
            console.log(`HNSWLibAdapter - ${ids.length}개 벡터 추가 시작`);
            await this.hnswIndex.addPoints(vectorsToAdd, ids, false);
            console.log(`HNSWLibAdapter - ${ids.length}개 벡터 추가 완료`);
        } catch (error) {
            console.error("HNSWLibAdapter - HNSW 인덱스 추가 실패:", error);
            throw error;
        }
    }

    // DONE: search 재구현
    async search(queryVector: number[], top_k: number): Promise<VectorSearchResults> {
        const result = this.hnswIndex.searchKnn(queryVector, top_k, undefined);

        const returnValue: VectorSearchResults = { results: [] };

        for (let i = 0; i < result.neighbors.length; i++) {
            const label = result.neighbors[i];
            const score = result.distances[i];

            const eachResult: VectorSearchResult = ({
                id: label,
                score: 1 - score, 
            });

            returnValue.results.push(eachResult);
        }

        return returnValue;
    }

    async deleteItem(id: number): Promise<void> {
        if (this.idToVectorMap.get(id) === undefined) {
            console.warn(`HNSWLibAdapter - ID ${id}에 해당하는 벡터을 찾을 수 없습니다.`);
            return;
        }
        
        try {
            // HNSW 인덱스에서 제거
            this.hnswIndex.markDelete(id);
            this.idToVectorMap.delete(id);
            
            console.log(`HNSWLibAdapter - 벡터 제거 완료: ID=${id}`);
        } catch (error) {
            console.error(`HNSWLibAdapter - 벡터 제거 실패: ID=${id}`, error);
            throw error;
        }
    }

    async save(): Promise<void> {
        await this.hnswIndex.writeIndex(this.indexFileName);
        await this.saveMaps();
    }

    async saveMaps(): Promise<void> {
		const saveIdToVector = JSON.stringify(Object.fromEntries(this.getIdToVectorMap()), null, 2);

		const pluginPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa`);
		
		try {
			await this.app.vault.adapter.write(`${pluginPath}/ID_TO_VECTOR.json`, saveIdToVector);
			console.log("HNSWLibAdapter - 맵 저장 완료");
		} catch (error) {
			console.error("HNSWLibAdapter - 맵 저장 실패:", error);
			throw error;
		}
    }

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

    async resetMap() {
        this.idToVectorMap.clear();
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/ID_TO_VECTOR.json`);
        const isExist = await this.app.vault.adapter.exists(mapPath);
        if (isExist) {
            await this.app.vault.adapter.remove(mapPath);
        }
    }

    async count(): Promise<number> {
        return this.hnswIndex.getCurrentCount();
    }

    async resetIndex(maxElements: number, dimensions: number): Promise<void> {
        this.hnswIndex = new this.hnswlib.HierarchicalNSW('cosine', dimensions, this.indexFileName);
        await syncFileSystem('read');
        this.hnswIndex.initIndex(maxElements, 32, 150, 42);
        this.hnswIndex.setEfSearch(32);
        
        await this.resetMap();
        this.save();
    }


    getIdToVectorMap() {
        return this.idToVectorMap;
    }
}