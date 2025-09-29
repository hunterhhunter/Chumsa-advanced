import { HNSWLibAdapter } from "../utils/hnsw_adapter";
import { App, TFile, Notice } from "obsidian";
import { EmbededData, MdBlocks, MetaData } from "../types/structures";
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
    async addItem(item: MdBlocks, embeddings: EmbededData[]) {
        for (let i = 0; i < embeddings.length; i++) {
            const metadata: MetaData = {id: item.blocks.at(i)!!.id, key: item.blocks.at(i)!!.key, filePath: item.filePath, fileName: item.fileName };
            
        }
    }


}