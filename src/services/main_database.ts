import { HNSWLibAdapter } from "../utils/hnsw_adapter";
import { App } from "obsidian";
import { EmbededData, MainDataBaseSearchResult, MdBlocks, MetaData } from "../types/structures";
import { MetaDataStore } from "src/utils/metadata_store";
import { BlockStore } from "src/utils/block_store";

export class MainDataBase {
    private app: App;
    private index: HNSWLibAdapter;
    private metadataStore: MetaDataStore;
    private blockStore: BlockStore;
    
    constructor(
        app: App,
    ) {
        this.app = app;
        this.index = new HNSWLibAdapter(this.app);
        this.metadataStore = new MetaDataStore(this.app);
        this.blockStore = new BlockStore(this.app);
    }

    async initialize(indexFileName: string, dimensions: number, maxElements: number) {
        await this.index.initialize(indexFileName, dimensions, maxElements);
        await this.metadataStore.initialize();
        await this.blockStore.initialize();
    }

    // 기본적으로 ID만으로 모든 요소를 찾을 수 있도록 함.
    public async addItems(item: MdBlocks, embeddings: EmbededData[]) {
        const metadataList: MetaData[] = [];
        const vectorDataList: EmbededData[] = [];

        for (let i = 0; i < embeddings.length; i++) {
            if ( item.blocks.at(i)!.id !== embeddings.at(i)!.id ) {
                console.log(`MainDataBase - 블럭 내부 ID와 임베딩 내부 ID가 다름 Block ID: ${item.blocks.at(i)!.id}, Embedding ID: ${embeddings.at(i)!.id}`);
                continue;
            }
            const metadata: MetaData = {id: item.blocks.at(i)!.id, key: item.blocks.at(i)!.key, filePath: item.filePath, fileName: item.fileName };
            const vectorData: EmbededData = { id: embeddings.at(i)!.id, vector: embeddings.at(i)!.vector }
            const block = item.blocks.at(i);

            metadataList.push(metadata);
            vectorDataList.push(vectorData);
            this.blockStore.addItems([block!], item.filePath);
        }

        // 배치로 한 번에 추가 (파일 시스템 동기화 충돌 방지)
        if (metadataList.length > 0) {
            this.metadataStore.addItems(metadataList);
            await this.index.addItems(vectorDataList);
        }
    }

    public async deleteItem(id: number) {
        await this.metadataStore.deleteItem(id);
        await this.blockStore.deleteItem(id);
        await this.index.deleteItem(id);
    }

    // 
    public async updateItem(item: MdBlocks, embeddings: EmbededData[]) {
        for (let i = 0; i < embeddings.length; i++) {
            await this.deleteItem(embeddings.at(i)!.id);
        }

        await this.addItems(item, embeddings);
    }

    public async search(vec: number[], top_k: number): Promise<MainDataBaseSearchResult[]> {
        const returnValue: MainDataBaseSearchResult[] = [];
        const vecResult = await this.index.search(vec, top_k);
        for (const each of vecResult.results) {
            try {
                const metadata = this.metadataStore.search(each.id);
                const block = this.blockStore.search(each.id);
                const result:MainDataBaseSearchResult = {id: each.id, score: each.score, metadata: metadata, block: block}
                returnValue.push(result);
            } catch (error) {
                console.warn(`MainDataBase - ID ${each.id}에 대한 메타데이터 또는 블록을 찾을 수 없어 검색 결과에서 제외합니다.`);
            }
        }
        return returnValue;
    }

    public async saveData() {
        await this.index.save();
        await this.metadataStore.saveMaps();
        await this.blockStore.saveMaps();
    }

    // 파일 변경 감지를 위한 메서드들

    /**
     * 특정 파일이 가지고 있는 모든 블럭 ID 리스트 반환
     */
    public getFileBlockIds(filePath: string): number[] {
        return this.blockStore.getFileBlockIds(filePath);
    }

    /**
     * 특정 파일의 모든 데이터 삭제 (벡터, 메타데이터, 블럭)
     */
    public async deleteFileBlocks(filePath: string): Promise<void> {
        const blockIds = this.blockStore.getFileBlockIds(filePath);
        for (const id of blockIds) {
            await this.deleteItem(id);
        }
    }

    /**
     * 파일 경로 변경 시 호출 (rename/move)
     */
    public renameFilePath(oldPath: string, newPath: string): void {
        this.blockStore.renameFilePath(oldPath, newPath);
    }

    /**
     * 특정 파일이 DB에 존재하는지 확인
     */
    public hasFile(filePath: string): boolean {
        return this.blockStore.hasFile(filePath);
    }

    /**
     * DB에 저장된 모든 파일 경로 목록 반환
     */
    public getAllFilePaths(): string[] {
        return this.blockStore.getAllFilePaths();
    }

    public printAllBlocksbyFilePath(filePath: string) {
        const data = this.blockStore.getFileBlockIds(filePath);
        for (const each of data) {
            console.log(`block ID: ${each} / block Key: ${this.blockStore.search(each).key} / block text: ${this.blockStore.search(each).text}`);
            // console.log(`vector: ${this.index.getVectorById(each)}`);
        }
    }

    public getVectorById(id: number) {
        return this.index.getVectorById(id);
    }

    public async resetDatabase(): Promise<void> {
        await this.index.resetIndex(10000, 1536);
        await this.metadataStore.resetStore();
        await this.blockStore.resetStore();
    }

}