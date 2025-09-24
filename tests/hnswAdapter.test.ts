// TODO: hnswAdapter 클래스 메서드 테스트
import { describe } from 'node:test';
import { HNSWLibAdapter } from '../src/utils/hnswAdapter';
import { App } from 'obsidian';
import { EmbededData } from 'src/types/structures';
import { assert } from 'console';

let app = new App();

describe('HNSWLibAdapter test', () => {
    let adapter: HNSWLibAdapter;
    
    beforeAll(async () => {
        console.log('inject app to HNSWLibAdapter');
        adapter = new HNSWLibAdapter(app);
        console.log("adapter had app");
        
        await adapter.initialize("test.hnsw", 3, 1000);
        console.log("init finished");
    }, 30000);

    afterAll(async () => {

    });

    
});