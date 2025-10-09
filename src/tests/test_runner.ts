export {}

// interface TestResult {
//     name: string;
//     passed: boolean;
//     error?: string;
//     duration: number;
// }

// export interface TestCase {
//     name: string;
//     fn: () => Promise<void> | void;
//     timeout?: number;
// }

// // TestRunner 클래스
// export class TestRunner {
//     private results: TestResult[] = [];
    
//     async runTests(testCases: TestCase[], suiteName: string = 'Test Suite'): Promise<TestResult[]> {
//         console.log(`\n🧪 ${suiteName} 시작`);
//         console.log('='.repeat(50));
        
//         this.results = []; // 결과 초기화
        
//         for (const test of testCases) {
//             await this.runSingleTest(test);
//         }
        
//         this.printSummary(suiteName);
//         return this.results;
//     }
    
//     private async runSingleTest(test: TestCase): Promise<void> {
//         const startTime = performance.now();
        
//         try {
//             console.log(`\n▶️ ${test.name}`);
            
//             if (test.timeout) {
//                 await Promise.race([
//                     test.fn(),
//                     new Promise((_, reject) => 
//                         setTimeout(() => reject(new Error('테스트 타임아웃')), test.timeout!)
//                     )
//                 ]);
//             } else {
//                 await test.fn();
//             }
            
//             const duration = performance.now() - startTime;
//             this.results.push({ name: test.name, passed: true, duration });
//             console.log(`✅ 통과 (${duration.toFixed(2)}ms)`);
            
//         } catch (error) {
//             const duration = performance.now() - startTime;
//             this.results.push({ 
//                 name: test.name, 
//                 passed: false, 
//                 error: error.message, 
//                 duration 
//             });
//             console.log(`❌ 실패: ${error.message} (${duration.toFixed(2)}ms)`);
//         }
//     }
    
//     private printSummary(suiteName: string): void {
//         const total = this.results.length;
//         const passed = this.results.filter(r => r.passed).length;
//         const failed = total - passed;
//         const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
        
//         console.log('\n' + '='.repeat(50));
//         console.log(`📊 ${suiteName} 결과: ${passed}/${total} 통과`);
//         console.log(`⏱️ 총 실행 시간: ${totalTime.toFixed(2)}ms`);
        
//         if (failed > 0) {
//             console.log('\n❌ 실패한 테스트들:');
//             this.results
//                 .filter(r => !r.passed)
//                 .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
//         } else {
//             console.log('\n🎉 모든 테스트 통과!');
//         }
        
//         console.log('='.repeat(50));
//     }
    
//     // 결과 반환
//     getResults(): TestResult[] {
//         return this.results;
//     }
    
//     // 통과율 반환
//     getPassRate(): number {
//         if (this.results.length === 0) return 0;
//         const passed = this.results.filter(r => r.passed).length;
//         return (passed / this.results.length) * 100;
//     }
// }