export {}

// import { TestRunner, TestCase } from './test_runner';
// import { App, normalizePath } from 'obsidian';
// import { MetaDataStore } from 'src/utils/metadata_store';
// import { MetaData } from 'src/types/structures';

// export class MetadataStoreTestSuite {
//     // expect 문법 if구문으로 수정하기
//     private testRunner: TestRunner;
//     private store: MetaDataStore | null = null;
    
//     constructor(private app: App) {
//         this.testRunner = new TestRunner();
//     }
    
//     // 🎯 모든 테스트를 러너로 실행
//     async runAllTests(): Promise<void> {
//         const testCases: TestCase[] = [
//             {
//                 name: 'MetaDataStore - AddItems',
//                 fn: () => this.testAddItems(),
//                 timeout: 30000
//             },
//             {
//                 name: 'MetaDataStore - DeleteItem',
//                 fn: () => this.testDeleteItem(),
//                 timeout: 30000
//             },
//             {
//                 name: 'MetaDataStore - LoadMap',
//                 fn: () => this.testLoadMap(),
//                 timeout: 30000
//             },
//             {
//                 name: 'MetaDataStore - SaveMap',
//                 fn: () => this.testSaveMap(),
//                 timeout: 30000
//             },
//             {
//                 name: 'MetaDataStore - UpdateItem',
//                 fn: () => this.testUpdateItem(),
//                 timeout: 30000
//             },
//         ];
        
//         await this.testRunner.runTests(testCases, 'MetaDataStore 테스트');
//         this.printAdditionalInfo();
//     }

    
//     private async testAddItems(): Promise<void> {
//         this.store = new MetaDataStore(this.app);

//         const metadata1: MetaData = { id: 1, filePath: "1", key: "aaa.md/3"};
//         const metadata2: MetaData = { id: 2, filePath: "1", key: "aaa.md/3"};
//         const metadata3: MetaData = { id: 1, filePath: "1", key: "aaa.md/3"};
//         const metadata4: MetaData = { id: 4, filePath: "", key: "aaa.md/3"};
//         const metadata5: MetaData = { id: 5, filePath: "1", key: ""};

//         const metadatas = [metadata1, metadata2, metadata3, metadata4, metadata5];

//         this.store.addItems(metadatas);

//         if ( this.store.count() === 2) {
//             console.log(`MetaDataStoreTest - addItems 테스트 성공`);
//         } else {
//             throw new Error(`예상: ${2}, 실제: ${this.store.count()}`);
//         }
//     }

//     private async testDeleteItem(): Promise<void> {
//         this.store = new MetaDataStore(this.app);

//         const metadata1: MetaData = { id: 1, filePath: "1", key: "aaa.md/3"};
//         const metadata2: MetaData = { id: 2, filePath: "1", key: "aaa.md/3"};
//         const metadata3: MetaData = { id: 3, filePath: "1", key: "aaa.md/3"};
//         const metadata4: MetaData = { id: 4, filePath: "1", key: "aaa.md/3"};
//         const metadata5: MetaData = { id: 5, filePath: "1", key: "aaaa.md/3"};

//         const metadatas = [metadata1, metadata2, metadata3, metadata4, metadata5];

//         this.store.addItems(metadatas);
//         this.store.deleteItem(3);

//         const result = this.store.search(3);

//         if ( result instanceof Error) {
//             if ( this.store.count() == 4) {
//                 console.log(`MetaDataStoreTest - deleteItem 테스트 성공`);
//             } else {
//                 throw new Error(`testDeleteItem - 실제 맵 원소 개수: ${this.store.count()}`);
//             }
//         } else {
//             throw new Error(`testDeleteItem - result of 3: ${result}`);
//         }
//     }

//     private async testSaveMap(): Promise<void> {
//         this.store = new MetaDataStore(this.app);

//         const metadata1: MetaData = { id: 1, filePath: "1", key: "aaa.md/3"};
//         const metadata2: MetaData = { id: 2, filePath: "1", key: "aaa.md/3"};
//         const metadata3: MetaData = { id: 3, filePath: "1", key: "aaa.md/3"};
//         const metadata4: MetaData = { id: 4, filePath: "1", key: "aaa.md/3"};
//         const metadata5: MetaData = { id: 5, filePath: "1", key: "aaaa.md/3"};

//         const metadatas = [metadata1, metadata2, metadata3, metadata4, metadata5];

//         this.store.addItems(metadatas);
//         this.store.saveMaps();

//         const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/METADATA_MAP.json`);
//         const exist = await this.app.vault.adapter.exists(mapPath);

//         if ( exist ) {
//             console.log(`MetaDataStoreTest - saveMap 테스트 성공`);
//         } else {
//             throw new Error(`testSaveMap - 저장 파일이 존재하지 않음.`);
//         }
//     }

//     private async testLoadMap(): Promise<void> {
//         this.store = new MetaDataStore(this.app);

//         const metadata1: MetaData = { id: 1, filePath: "1", key: "aaa.md/3"};
//         const metadata2: MetaData = { id: 2, filePath: "1", key: "aaa.md/3"};
//         const metadata3: MetaData = { id: 3, filePath: "1", key: "aaa.md/3"};
//         const metadata4: MetaData = { id: 4, filePath: "1", key: "aaa.md/3"};
//         const metadata5: MetaData = { id: 5, filePath: "1", key: "aaaa.md/3"};

//         const metadatas = [metadata1, metadata2, metadata3, metadata4, metadata5];

//         this.store.addItems(metadatas);
//         this.store.saveMaps();
//         this.store.clearMap();

//         this.store.loadMaps();
//         const result = this.store.search(1);

//         if ( result instanceof Error) {
            
//         } else {
//             if ( result.id === 1 && result.filePath === "1" && result.key === "aaa.md/3") {
//                 this.store.resetStore();
//                 console.log(`MetaDataStoreTest - loadMap 테스트 성공`)
//             } else {
//                 throw new Error(`testLoadMap - 로드 실패`)
//             }
//         }
//     }

//     private testUpdateItem(): void {
//         this.store = new MetaDataStore(this.app);

//         const metadata1: MetaData = { id: 1, filePath: "1", key: "aaa.md/3"};
//         const metadata2: MetaData = { id: 2, filePath: "1", key: "aaa.md/3"};
//         const metadata3: MetaData = { id: 3, filePath: "1", key: "aaa.md/3"};
//         const metadata4: MetaData = { id: 4, filePath: "1", key: "aaa.md/3"};
//         const metadata5: MetaData = { id: 5, filePath: "1", key: "aaaa.md/3"};

//         const metadatas = [metadata1, metadata2, metadata3, metadata4, metadata5];

//         this.store.addItems(metadatas);

//         this.store.updateItem(1, { id: 7, filePath: "22", key: "bbb.md"});

//         try {
//             const resultFail = this.store.search(1);
//         } catch (error) {
//             const result = this.store.search(7);
//             if ( result instanceof Error) {

//             } else {
//                 if ( result.id === 7 && result.filePath === "22" && result.key === "bbb.md") {
//                     console.log(`MetaDataStoreTest - UpdateItem 테스트 성공`)
//                 } else {
//                     throw new Error(`UpdateItem - 테스트 실패`)
//                 }
//             }
//         }
//     }

//     private printAdditionalInfo(): void {
//         const passRate = this.testRunner.getPassRate();
//         console.log(`\n📈 테스트 통과율: ${passRate.toFixed(1)}%`);
        
//         if (passRate === 100) {
//             console.log('🎊 완벽한 성공! 모든 기능이 정상 작동합니다.');
//         } else if (passRate >= 80) {
//             console.log('👍 대부분의 기능이 정상 작동합니다.');
//         } else if (passRate >= 50) {
//             console.log('⚠️ 일부 기능에 문제가 있을 수 있습니다.');
//         } else {
//             console.log('🚨 심각한 문제가 있습니다. 코드를 점검해주세요.');
//         }
//     }
// }