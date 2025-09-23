import { HNSWLibAdapter } from "../utils/hnswAdapter";
import { App, TFile, Notice } from "obsidian";
import { EmbededData } from "../types/structures";

export class VectorDB {
    private app: App;
    private index: HNSWLibAdapter;
    // TODO:: 파일: blocks 매핑 저장해야함.
    // HNSWLibAdapter에 있는 key-label, label-key, id-vector 맵 가져오기
    
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
        await this.index.addItems(item.vector);
    }


}