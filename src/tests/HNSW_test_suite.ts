import { TestRunner, TestCase } from './test_runner';
import { HNSWLibAdapter } from '../utils/hnsw_adapter';
import { EmbededData } from '../types/structures';
import { App, normalizePath } from 'obsidian';

export class HNSWTestSuite {
    private testRunner: TestRunner;
    private adapter: HNSWLibAdapter | null = null;
    
    constructor(private app: App) {
        this.testRunner = new TestRunner();
    }
    
    // 🎯 모든 테스트를 러너로 실행
    async runAllTests(): Promise<void> {
        const testCases: TestCase[] = [
            {
                name: 'HNSW 어댑터 초기화',
                fn: () => this.initializeAdapter(),
                timeout: 30000
            },
            {
                name: 'addItems 성공 케이스',
                fn: () => this.testAddItemsSuccess(),
                timeout: 10000
            },
            {
                name: 'addItems 무효 벡터 처리',
                fn: () => this.testAddItemsInvalidVectors(),
                timeout: 10000
            },
            {
                name: 'addItems 유효한 벡터 없음',
                fn: () => this.testAddItemsNoValidVectors(),
                timeout: 10000
            },
            {
                name: 'search 기능 테스트',
                fn: () => this.testSearchFunction(),
                timeout: 15000
            },
            {
                name: 'RoundTrip 테스트',
                fn: () => this.roundTrip(),
                timeout: 15000
            }
        ];
        
        await this.testRunner.runTests(testCases, 'HNSWLibAdapter 테스트');
        this.printAdditionalInfo();
    }
    
    // 어댑터 초기화 (모든 테스트에서 공통으로 사용)
    private async initializeAdapter(): Promise<void> {
        if (this.adapter) {
            console.log('✅ 기존 어댑터 인스턴스 재사용');
            return;
        }
        
        console.log('📦 HNSWLibAdapter 초기화 중...');
        this.adapter = new HNSWLibAdapter(this.app);
        
        console.log('⚙️ HNSW 인덱스 초기화 중...');
        await this.adapter.initialize("test.hnsw", 3, 1000);
        console.log('✅ 초기화 완료');
    }

    // 🟢 addItems 성공 케이스 테스트 (기존 코드 그대로)
    private async testAddItemsSuccess(): Promise<void> {
        console.log('🟢 addItems 성공 케이스 테스트 실행');

        const testAdapter = new HNSWLibAdapter(this.app);
        await testAdapter.initialize("test1.hnsw", 3, 1000);
        
        const vec1: EmbededData = { id: 1, vector: [1.0, 0.0, 0.0]};
        const vec2: EmbededData = { id: 2, vector: [0.0, 1.0, 0.0]};
        const vec3: EmbededData = { id: 3, vector: [0.0, 0.0, 1.0]};
        const vec4: EmbededData = { id: 4, vector: [0.9, 0.0, 0.0]};
        const vec5: EmbededData = { id: 5, vector: [0.0, 0.9, 0.0]};

        const vecs = [vec1, vec2, vec3, vec4, vec5];

        console.log(`📊 ${vecs.length}개 벡터 추가 중...`);
        await testAdapter.addItems(vecs);

        const result = await testAdapter.count();
        const mapSize = testAdapter.getIdToVectorMap().size;
        
        console.log(`📈 예상 개수: ${vecs.length}, 실제 개수: ${result}`);
        console.log(`🗂️ 매핑 크기: ${mapSize}`);

        if (result === vecs.length && mapSize === 5) {
            console.log('✅ addItems 성공 케이스: 통과');
        } else {
            console.log('❌ addItems 성공 케이스: 실패');
            throw new Error(`예상: ${vecs.length}개, 실제: ${result}개`);
        }
    }

    // 🟡 addItems 무효 벡터 건너뛰기 테스트 (기존 코드 그대로)
    private async testAddItemsInvalidVectors(): Promise<void> {
        console.log('🟡 addItems 무효 벡터 건너뛰기 테스트 실행');

        const testAdapter = new HNSWLibAdapter(this.app);
        await testAdapter.initialize("test-2.hnsw", 3, 1000);
        console.log('왜 5개가 나올까?1 %d', await testAdapter.count());

        const vec1: EmbededData = { id: 1, vector: [1.0, 0.0, 0.0]};
        const vec2: EmbededData = { id: 2, vector: []};
        const vec3: EmbededData = { id: 3, vector: [0.0, 1.0]};
        const vec4: EmbededData = { id: 4, vector: [0.9, NaN, 0.0]};
        const vec5: EmbededData = { id: 1, vector: [0.0, 0.9, 0.0]};

        const vecs = [vec1, vec2, vec3, vec4, vec5];

        console.log(`📊 ${vecs.length}개 벡터 추가 시도 (일부 무효)...`);
        console.log('왜 5개가 나올까?2 %d', await testAdapter.count());
        await testAdapter.addItems(vecs);

        const result = await testAdapter.count();
        const mapSize = testAdapter.getIdToVectorMap().size;

        console.log(`📈 예상 개수: 1 (유효한 벡터 1개), 실제 개수: ${result}`);
        console.log(`🗂️ 매핑 크기: ${mapSize}`);

        if (result === 1 && mapSize === 1) {
            console.log('✅ addItems 무효 벡터 테스트: 통과');
        } else {
            console.log('❌ addItems 무효 벡터 테스트: 실패');
            throw new Error(`예상: 1개, 실제: ${result}개`);
        }
    }

    // 🔴 addItems 유효한 벡터 없음 테스트 (기존 코드 그대로)
    private async testAddItemsNoValidVectors(): Promise<void> {
        console.log('🔴 addItems 유효한 벡터 없음 테스트 실행');

        const testAdapter = new HNSWLibAdapter(this.app);
        await testAdapter.initialize("test_3.hnsw", 3, 1000);

        const vec1: EmbededData = { id: 1, vector: [1.0, 0.0]};
        const vec2: EmbededData = { id: 2, vector: []};
        const vec3: EmbededData = { id: 3, vector: [0.0, 1.0]};
        const vec4: EmbededData = { id: 4, vector: [0.9, NaN, 0.0]};
        const vec5: EmbededData = { id: 1, vector: [0.0, 0.9, 0.0]};
        const vec6: EmbededData = { id: 1, vector: [0.0, 0.9, 0.0]};

        const vecs = [vec1, vec2, vec3, vec4, vec5, vec6];

        console.log(`📊 ${vecs.length}개 벡터 추가 시도 (모두 무효)...`);
        await testAdapter.addItems(vecs);

        const result = await testAdapter.count();
        const mapSize = testAdapter.getIdToVectorMap().size;

        console.log(`📈 예상 개수: 1 (유효한 벡터 없음), 실제 개수: ${result}`);
        console.log(`🗂️ 매핑 크기: ${mapSize}`);

        if (result === 1 && mapSize === 1) {
            console.log('✅ addItems 유효한 벡터 없음 테스트: 통과');
        } else {
            console.log('❌ addItems 유효한 벡터 없음 테스트: 실패');
            throw new Error(`예상: 1개, 실제: ${result}개`);
        }
    }

    // 🔍 search 기능 테스트
    private async testSearchFunction(): Promise<void> {
        console.log('🔍 search 함수 테스트 실행');

        const searchAdapter = new HNSWLibAdapter(this.app);
        await searchAdapter.initialize("search_test.hnsw", 3, 1000);

        const vec1: EmbededData = { id: 1, vector: [1.0, 1.0, 1.0]};
        const vec2: EmbededData = { id: 2, vector: [0.0, 1.0, 0.0]};
        const vec3: EmbededData = { id: 3, vector: [0.0, 0.0, 1.0]};
        const vec4: EmbededData = { id: 4, vector: [0.9, 0.9, 0.9]};
        const vec5: EmbededData = { id: 5, vector: [0.0, 0.9, 0.9]};
        const vec6: EmbededData = { id: 6, vector: [0.8, 0.8, 0.8]};

        const vecs = [vec1, vec2, vec3, vec4, vec5, vec6];

        console.log('📊 검색용 벡터들 추가 중...');
        await searchAdapter.addItems(vecs);

        console.log('🔍 [0.5, 0.5, 0.5] 벡터로 상위 2개 검색...');
        const searchResult = await searchAdapter.search([0.5, 0.5, 0.5], 2);

        const resultArray = searchResult.results;

        console.log('📋 검색 결과:');
        resultArray.forEach((each, index) => {
            console.log(`  ${index + 1}. ID: ${each.id}, 점수: ${each.score.toFixed(4)}`);
        });

        console.log('📊 검증:');
        console.log(`예상 결과 길이: 2, 실제: ${resultArray.length}`);

        let testPassed = true;
        if (resultArray.length !== 2) {
            console.log('❌ 결과 개수가 맞지 않음');
            testPassed = false;
        }

        if (resultArray.length >= 2) {
            if (resultArray[0].score >= resultArray[1].score) {
                console.log('✅ 점수 순서 정확 (내림차순)');
            } else {
                console.log('❌ 점수 순서 부정확');
                testPassed = false;
            }
        }

        if (testPassed) {
            console.log('✅ search 함수 테스트: 통과');
        } else {
            console.log('❌ search 함수 테스트: 실패');
            throw new Error('search 기능 테스트 실패');
        }
    }

    private async roundTrip(): Promise<void> {
        console.log('RoundTrip 함수 검증');

        const adapter = new HNSWLibAdapter(this.app);
        await adapter.initialize("roundTrip.hnsw", 3, 1000);

        const vec1: EmbededData = { id: 1, vector: [1.0, 1.0, 1.0]};
        const vec2: EmbededData = { id: 2, vector: [0.0, 1.0, 0.0]};
        const vec3: EmbededData = { id: 3, vector: [0.0, 0.0, 1.0]};
        const vec4: EmbededData = { id: 4, vector: [0.9, 0.9, 0.9]};
        const vec5: EmbededData = { id: 5, vector: [0.0, 0.9, 0.9]};
        const vec6: EmbededData = { id: 6, vector: [0.8, 0.8, 0.8]};

        const vecs = [vec1, vec2, vec3, vec4, vec5, vec6];

        await adapter.addItems(vecs);

        console.log("인덱스 및 맵 저장");
        await adapter.save();
        console.log("인덱스 및 맵 저장 완료");

        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/ID_TO_VECTOR.json`);
        const isExist = await this.app.vault.adapter.exists(mapPath);

        if ( isExist ) {
            console.log("맵 저장 성공");
        } else {
            console.log("맵 저장 실패");
            throw new Error("맵 저장 실패함");
        }

        console.log("인덱스 및 맵 불러오기");
        const newAdapter = new HNSWLibAdapter(this.app);
        await newAdapter.initialize('roundTrip.hnsw', 3, 1000);
        await newAdapter.loadMaps();
        console.log("인덱스 및 맵 불러오기 완료");

        const loadedcnt = await newAdapter.count();
        const loadedmap = await newAdapter.getIdToVectorMap();
        const mapSize = loadedmap.size;

        console.log(`${loadedcnt}, ${mapSize} check this`);
        
        await newAdapter.resetMap();

        const isExist2 = await this.app.vault.adapter.exists(mapPath);

        if (!isExist2) {
            console.log("매핑파일 삭제 완료");
        } else {
            console.log("매핑파일 삭제 실패");
            throw new Error("매핑파일 삭제 실패.");
        }


        if ( loadedcnt === 6 && mapSize === 6 ) {
            console.log("불러온 Adapter 검증 완료");
        } else {
            console.log("불러온 Adapter 검증 실패");
            throw new Error("라운드 트립 실패");
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