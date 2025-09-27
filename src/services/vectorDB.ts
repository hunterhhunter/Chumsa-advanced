import { HNSWLibAdapter } from "../utils/hnsw_adapter";
import { App, TFile, Notice } from "obsidian";
import { EmbededData } from "../types/structures";
import { MetaDataStore } from "src/utils/metadata_store";

export class VectorDB {
    private app: App;
    private index: HNSWLibAdapter;
    private metadataStore: MetaDataStore;
    private blockStore: Map<number, number[]>; // 파일별로 가지는 block을 저장하는 저장소
    // TODO:: 파일: blocks 매핑 저장해야함.
    
    constructor(
        app: App,
        index: HNSWLibAdapter,
    ) {
        this.app = app;
        this.index = index;
    }

    async initialize() {
        await this.index.initialize('embeddings.hnsw', 1536, 50000);
    }

    async insert(item: EmbededData) {
        // TODO: 파일 - 블럭 매핑 저장 로직 작성
    }


}