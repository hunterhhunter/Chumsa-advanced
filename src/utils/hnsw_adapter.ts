import { EmbededData, IVectorDB, VectorSearchResult, VectorSearchResults } from '../types/structures';
import { HierarchicalNSW } from 'hnswlib-wasm/dist/hnswlib-wasm';
import { loadHnswlib, syncFileSystem, HnswlibModule } from 'hnswlib-wasm';
import { normalizePath, App } from 'obsidian';

export class HNSWLibAdapter implements IVectorDB {
    private app: App;
    private hnswlib: HnswlibModule;
    private hnswIndex: HierarchicalNSW;
    private indexFileName: string;
    private dimension: number;
    private idToVectorMap: Map<number, number[]> = new Map();
    private deletedIds: Set<number> = new Set();
    private saveQueue: Promise<void> = Promise.resolve();

    public constructor(app: App) {
        this.app = app;
    }

    public async initialize(indexFileName: string, dimensions: number, maxElements: number): Promise<boolean> {
        this.hnswlib = await loadHnswlib();
        this.indexFileName = indexFileName;
        this.dimension = dimensions;

        this.hnswIndex = new this.hnswlib.HierarchicalNSW('cosine', dimensions, indexFileName);
        await syncFileSystem('read');
        this.hnswlib.EmscriptenFileSystemManager.initializeFileSystem('IDBFS');

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
            
            if (each.vector.some(v => v === undefined || v === null || isNaN(v))) {
                console.warn(`HNSWLibAdapter - 잘못된 벡터 값: ID ${each.id}`);
                continue;
            }
            
            // 중복 확인: 삭제된 ID인지 체크
            const isDeleted = this.deletedIds.has(each.id);
            const existsInMap = this.idToVectorMap.has(each.id);

            if (existsInMap && !isDeleted) {
                console.warn(`HNSWLibAdapter - 이미 존재하는 ID (활성): ${each.id}`);
                continue;
            }

            // 삭제된 ID 재사용
            if (isDeleted) {
                console.log(`HNSWLibAdapter - 삭제된 ID 재사용: ${each.id}`);
                this.deletedIds.delete(each.id);
            }

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
            await this.hnswIndex.addPoints(vectorsToAdd, ids, true);
            console.log(`HNSWLibAdapter - ${ids.length}개 벡터 추가 완료`);
        } catch (error) {
            console.error("HNSWLibAdapter - HNSW 인덱스 추가 실패:", error);
            throw error;
        }
    }

    async search(queryVector: number[], top_k: number): Promise<VectorSearchResults> {
        const result = this.hnswIndex.searchKnn(queryVector, top_k, undefined);

        const returnValue: VectorSearchResults = { results: [] };

        for (let i = 0; i < result.neighbors.length; i++) {
            const label = result.neighbors[i];
            const score = result.distances[i];

            const eachResult: VectorSearchResult = {
                id: label,
                score: 1 - score, 
            };

            returnValue.results.push(eachResult);
        }

        return returnValue;
    }

    async deleteItem(id: number): Promise<void> {
        // idToVectorMap에 없으면 즉시 반환
        if (!this.idToVectorMap.has(id)) {
            console.warn(`HNSWLibAdapter - ID ${id}가 맵에 없음 (이미 삭제됨)`);
            return;
        }
        
        try {
            // 🔧 HNSW 인덱스에서 라벨 존재 여부 확인
            const idLabels = this.hnswIndex.getUsedLabels();
            const existsInIndex = idLabels.includes(id);

            if (!existsInIndex) {
                console.warn(`HNSWLibAdapter - ID ${id}가 HNSW 인덱스에 없음 (맵에서만 제거)`);
                // 맵에서만 제거하고 deletedIds에 추가
                this.idToVectorMap.delete(id);
                this.deletedIds.add(id);
                return;
            }

            // HNSW 인덱스에서 삭제
            this.hnswIndex.markDelete(id);
            this.deletedIds.add(id);
            this.idToVectorMap.delete(id);
            
            console.log(`HNSWLibAdapter - 벡터 제거 완료: ID=${id}`);
        } catch (error) {
            console.error(`HNSWLibAdapter - 벡터 제거 실패: ID=${id}`, error);
            
            // 🔧 실패해도 맵에서는 제거 (동기화 유지)
            this.idToVectorMap.delete(id);
            this.deletedIds.add(id);
            
            // 에러를 다시 던지지 않음 (삭제 작업 계속 진행)
            console.warn(`HNSWLibAdapter - ID ${id} 삭제 실패 무시하고 계속 진행`);
        }
    }

    async save(): Promise<void> {
        this.saveQueue = this.saveQueue.then(async () => {
            try {
                await this.hnswIndex.writeIndex(this.indexFileName);
                await syncFileSystem('write');
                await this.saveMaps();
            } catch (error) {
                console.error("HNSWLibAdapter - 저장 실패:", error);
                throw error;
            }
        });

        return this.saveQueue;
    }

    async saveMaps(): Promise<void> {
        const saveData = {
            idToVector: Object.fromEntries(this.idToVectorMap),
            deletedIds: Array.from(this.deletedIds)
        };

        const pluginPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa`);
        
        try {
            await this.app.vault.adapter.write(
                `${pluginPath}/ID_TO_VECTOR.json`, 
                JSON.stringify(saveData, null, 2)
            );
            console.log(`HNSWLibAdapter - 맵 저장 완료 (활성: ${this.idToVectorMap.size}, 삭제: ${this.deletedIds.size})`);
        } catch (error) {
            console.error("HNSWLibAdapter - 맵 저장 실패:", error);
            throw error;
        }
    }

    async loadMaps(): Promise<void> {
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/ID_TO_VECTOR.json`);
        try {
            const dataString = await this.app.vault.adapter.read(mapPath);
            const data = JSON.parse(dataString);

            if (data.idToVector) {
                this.idToVectorMap = new Map(
                    Object.entries(data.idToVector).map(([key, value]) => [Number(key), value as number[]])
                );
                this.deletedIds = new Set(data.deletedIds || []);
            } else {
                this.idToVectorMap = new Map(
                    Object.entries(data).map(([key, value]) => [Number(key), value as number[]])
                );
                this.deletedIds.clear();
            }

            // 🔧 HNSW 인덱스와 동기화 검증
            await this.validateSync();

            console.log(`HNSWLibAdapter - 맵 로드 완료 (활성: ${this.idToVectorMap.size}, 삭제: ${this.deletedIds.size})`);
        } catch (error) {
            console.warn("HNSWLibAdapter - 맵 로드 실패, 초기화:", error);
            this.idToVectorMap.clear();
            this.deletedIds.clear();
        }
    }

    private async validateSync(): Promise<void> {
        try {
            const idLabels = this.hnswIndex.getUsedLabels();
            const indexIds = new Set(idLabels);

            // 맵에는 있지만 인덱스에는 없는 ID 찾기
            const orphanedIds: number[] = [];
            for (const [id] of this.idToVectorMap) {
                if (!indexIds.has(id)) {
                    orphanedIds.push(id);
                }
            }

            if (orphanedIds.length > 0) {
                console.warn(`HNSWLibAdapter - 맵에만 존재하는 ID ${orphanedIds.length}개 발견, 정리 중...`);
                for (const id of orphanedIds) {
                    this.idToVectorMap.delete(id);
                    this.deletedIds.add(id);
                }
            }

            console.log(`HNSWLibAdapter - 동기화 검증 완료 (HNSW: ${indexIds.size}개, 맵: ${this.idToVectorMap.size}개)`);
        } catch (error) {
            console.warn("HNSWLibAdapter - 동기화 검증 실패:", error);
        }
    }

    async resetMap(): Promise<void> {
        this.idToVectorMap.clear();
        this.deletedIds.clear();
        
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
        await this.save();
    }

    public getIdToVectorMap(): Map<number, number[]> {
        return this.idToVectorMap;
    }

    public getVectorById(id: number): number[] | undefined {
        return this.idToVectorMap.get(id);
    }

    public isDeleted(id: number): boolean {
        return this.deletedIds.has(id);
    }

    public getDeletedIds(): Set<number> {
        return new Set(this.deletedIds);
    }

    public getStats(): { active: number; deleted: number; total: number } {
        return {
            active: this.idToVectorMap.size,
            deleted: this.deletedIds.size,
            total: this.idToVectorMap.size + this.deletedIds.size
        };
    }
}