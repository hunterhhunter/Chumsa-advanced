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
        for (let i = 0; i < embeddings.length; i++) {
            if ( item.blocks.at(i)!.id !== embeddings.at(i)!.id ) {
                console.log(`MainDataBase - 블럭 내부 ID와 임베딩 내부 ID가 다름 Block ID: ${item.blocks.at(i)!.id}, Embedding ID: ${embeddings.at(i)!.id}`);
                continue;
            }
            const metadata: MetaData = {id: item.blocks.at(i)!.id, key: item.blocks.at(i)!.key, filePath: item.filePath, fileName: item.fileName };
            const vectorData: EmbededData = { id: embeddings.at(i)!.id, vector: embeddings.at(i)!.vector }
            const block = item.blocks.at(i);
            
            this.metadataStore.addItems([metadata]);
            this.index.addItems([vectorData]);
            this.blockStore.addItems([block!]);
        }
    }

    public async deleteItem(id: number) {
        this.metadataStore.deleteItem(id);
        this.blockStore.deleteItem(id);
        this.index.deleteItem(id);
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

            }
        }
        return returnValue;
    }

    public async saveData() {
        await this.index.save();
        await this.metadataStore.saveMaps();
        await this.blockStore.saveMaps();
    }

    

}