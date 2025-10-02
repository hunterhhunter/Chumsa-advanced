import { TestRunner, TestCase } from './test_runner';
import { App, normalizePath } from 'obsidian';
import { BlockStore } from '../utils/block_store';
import { MdBlock, MdHeaddingBlock } from 'src/types/structures';

export class BlockStoreTestSuite {
    private testRunner: TestRunner;
    
    constructor(private app: App) {
        this.testRunner = new TestRunner();
    }
    
    // 모든 테스트를 러너로 실행
    async runAllTests(): Promise<void> {
        const testCases: TestCase[] = [
            {
                name: 'BlockStore - AddItems',
                fn: () => this.testAddItems(),
                timeout: 30000
            },
            {
                name: 'BlockStore - DeleteItem',
                fn: () => this.testDeleteItem(),
                timeout: 30000
            },
            {
                name: 'BlockStore - Search',
                fn: () => this.testSearch(),
                timeout: 30000
            },
            {
                name: 'BlockStore - UpdateItem',
                fn: () => this.testUpdateItem(),
                timeout: 30000
            },
            {
                name: 'BlockStore - SaveMap',
                fn: () => this.testSaveMap(),
                timeout: 30000
            },
            {
                name: 'BlockStore - LoadMap',
                fn: () => this.testLoadMap(),
                timeout: 30000
            },
        ];
        
        await this.testRunner.runTests(testCases, 'BlockStore 테스트');
        this.printAdditionalInfo();
    }

    private async testAddItems(): Promise<void> {
        const store = new BlockStore(this.app);
        store.initialize();

        // 테스트 데이터 생성
        const block1: MdHeaddingBlock = { id: 1, key: "## Introduction", text: "This is introduction" };
        const block2: MdHeaddingBlock = { id: 2, key: "## Content", text: "This is main content" };
        const block3: MdHeaddingBlock = { id: 3, key: "## Conclusion", text: "This is conclusion" };

        const mdBlock1: MdBlock = {
            fileName: "test1.md",
            blocks: [block1, block2]
        };

        const mdBlock2: MdBlock = {
            fileName: "test2.md", 
            blocks: [block3]
        };

        // 잘못된 데이터들
        const mdBlockEmpty: MdBlock = {
            fileName: "",  // 빈 파일명
            blocks: [block1]
        };

        const mdBlockNoBlocks: MdBlock = {
            fileName: "test3.md",
            blocks: []  // 빈 블록 배열
        };

        const mdBlocks = [mdBlock1, mdBlock2, mdBlockEmpty, mdBlockNoBlocks];

        store.addItems(mdBlocks);

        // 유효한 블록만 추가되어야 함 (mdBlock1, mdBlock2만)
        if (store.count() === 2) {
            console.log(`BlockStoreTest - addItems 테스트 성공`);
        } else {
            throw new Error(`예상: 2, 실제: ${store.count()}`);
        }
    }

    private async testDeleteItem(): Promise<void> {
        const store = new BlockStore(this.app);
        store.initialize();


        // 테스트 데이터 준비
        const block1: MdHeaddingBlock = { id: 1, key: "## Test", text: "Test content" };
        const block2: MdHeaddingBlock = { id: 2, key: "## Test2", text: "Test content 2" };

        const mdBlock1: MdBlock = { fileName: "delete1.md", blocks: [block1] };
        const mdBlock2: MdBlock = { fileName: "delete2.md", blocks: [block2] };
        const mdBlock3: MdBlock = { fileName: "delete3.md", blocks: [block1, block2] };

        store.addItems([mdBlock1, mdBlock2, mdBlock3]);

        // 존재하는 파일 삭제
        store.deleteItem("delete2.md");

        // 존재하지 않는 파일 삭제 시도 (에러 없이 처리되어야 함)
        store.deleteItem("nonexistent.md");

        const result = store.search("delete2.md");
        
        if (result === undefined && store.count() === 2) {
            console.log(`BlockStoreTest - deleteItem 테스트 성공`);
        } else {
            throw new Error(`testDeleteItem - 삭제 실패 또는 카운트 오류. 실제 카운트: ${store.count()}`);
        }
    }

    private async testSearch(): Promise<void> {
        const store = new BlockStore(this.app);
        store.initialize();

        const block1: MdHeaddingBlock = { id: 1, key: "## Search Test", text: "Search test content" };
        const mdBlock: MdBlock = { fileName: "search.md", blocks: [block1] };

        store.addItems([mdBlock]);

        // 존재하는 파일 검색
        const result = store.search("search.md");
        
        if (result && result.fileName === "search.md" && result.blocks.length === 1) {
            // 존재하지 않는 파일 검색
            const notFoundResult = store.search("notfound.md");
            
            if (notFoundResult === undefined) {
                console.log(`BlockStoreTest - search 테스트 성공`);
            } else {
                throw new Error(`testSearch - 존재하지 않는 파일이 검색됨`);
            }
        } else {
            throw new Error(`testSearch - 검색 결과가 올바르지 않음`);
        }
    }

    private async testUpdateItem(): Promise<void> {
        const store = new BlockStore(this.app);
        store.initialize();

        // 초기 데이터
        const originalBlock: MdHeaddingBlock = { id: 1, key: "## Original", text: "Original content" };
        const originalMdBlock: MdBlock = { fileName: "update.md", blocks: [originalBlock] };

        store.addItems([originalMdBlock]);

        // 업데이트할 데이터
        const updatedBlock1: MdHeaddingBlock = { id: 2, key: "## Updated", text: "Updated content" };
        const updatedBlock2: MdHeaddingBlock = { id: 3, key: "## New Block", text: "New block content" };
        const updatedMdBlock: MdBlock = { fileName: "update.md", blocks: [updatedBlock1, updatedBlock2] };

        store.updateItem("update.md", updatedMdBlock);

        const result = store.search("update.md");
        
        if (result && 
            result.fileName === "update.md" && 
            result.blocks.length === 2 &&
            result.blocks[0].key === "## Updated" &&
            result.blocks[1].key === "## New Block") {
            
            console.log(`BlockStoreTest - updateItem 테스트 성공`);
        } else {
            throw new Error(`testUpdateItem - 업데이트 실패`);
        }
    }

    private async testSaveMap(): Promise<void> {
        const store = new BlockStore(this.app);
        store.initialize();

        const block1: MdHeaddingBlock = { id: 1, key: "## Save Test", text: "Save test content" };
        const block2: MdHeaddingBlock = { id: 2, key: "## Save Test 2", text: "Save test content 2" };
        
        const mdBlock1: MdBlock = { fileName: "save1.md", blocks: [block1] };
        const mdBlock2: MdBlock = { fileName: "save2.md", blocks: [block2] };

        store.addItems([mdBlock1, mdBlock2]);
        await store.saveMaps();

        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/BLOCK_MAP.json`);
        const exist = await this.app.vault.adapter.exists(mapPath);

        if (exist) {
            console.log(`BlockStoreTest - saveMap 테스트 성공`);
        } else {
            throw new Error(`testSaveMap - 저장 파일이 존재하지 않음`);
        }
    }

    private async testLoadMap(): Promise<void> {
        const store = new BlockStore(this.app);
        store.initialize();
        

        const block1: MdHeaddingBlock = { id: 1, key: "## Load Test", text: "Load test content" };
        const block2: MdHeaddingBlock = { id: 2, key: "## Load Test 2", text: "Load test content 2" };
        
        const mdBlock1: MdBlock = { fileName: "load1.md", blocks: [block1] };
        const mdBlock2: MdBlock = { fileName: "load2.md", blocks: [block2] };

        // 데이터 저장
        store.addItems([mdBlock1, mdBlock2]);
        await store.saveMaps();
        
        // 메모리 클리어
        store.clearMap();
        
        if (store.count() === 0) {
            // 저장된 데이터 로드
            await store.loadMaps();
            
            const result1 = store.search("load1.md");
            const result2 = store.search("load2.md");
            
            if (result1 && 
                result2 && 
                result1.fileName === "load1.md" && 
                result2.fileName === "load2.md" &&
                result1.blocks[0].key === "## Load Test" &&
                result2.blocks[0].key === "## Load Test 2" &&
                store.count() === 2) {
                
                // 테스트 완료 후 정리
                await store.resetStore();
                console.log(`BlockStoreTest - loadMap 테스트 성공`);
            } else {
                throw new Error(`testLoadMap - 로드된 데이터가 올바르지 않음`);
            }
        } else {
            throw new Error(`testLoadMap - 메모리 클리어 실패`);
        }
    }

    private printAdditionalInfo(): void {
        const passRate = this.testRunner.getPassRate();
        console.log(`\n📈 테스트 통과율: ${passRate.toFixed(1)}%`);
        
        if (passRate === 100) {
            console.log('🎊 완벽한 성공! 모든 기능이 정상 작동합니다.');
        } else if (passRate >= 80) {
            console.log('👍 대부분의 기능이 정상 작동합니다.');
        } else if (passRate >= 50) {
            console.log('⚠️ 일부 기능에 문제가 있을 수 있습니다.');
        } else {
            console.log('🚨 심각한 문제가 있습니다. 코드를 점검해주세요.');
        }
    }
}

// 사용 예시
export async function runBlockStoreTests(app: App): Promise<void> {
    const testSuite = new BlockStoreTestSuite(app);
    await testSuite.runAllTests();
}