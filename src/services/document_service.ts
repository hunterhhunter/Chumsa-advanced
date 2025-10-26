import { App, normalizePath, TFile } from "obsidian";
import { MainDataBase } from "./main_database";
import { EmbedModel } from "./embed_model";
import { parseMarkdownByHeadings } from "src/utils/markdown_parser";
import { hashString } from "src/utils/hash_func";

export class DocumentService {
    private app: App;
    public database: MainDataBase;
    private embedModel: EmbedModel;

    constructor(app: App, apiKey: string, indexFileName: string) {
        this.app = app;
        this.database = new MainDataBase(app);
        this.database.initialize(indexFileName, 1536, 10000);

        this.embedModel = new EmbedModel(apiKey);
    }
    
    // 한 문서 저장 함수
    public async saveOneDocument(filePath: string, spliter: string = "### ") {
        // --- 1. 파일 읽어오기 ---
        const nomalizedPath = normalizePath(filePath)
        const content = await this.app.vault.adapter.read(nomalizedPath);
        const fileName = filePath.split('/').pop()!;

        // --- 2. 마크다운 파싱 ---
        const blocks = parseMarkdownByHeadings(filePath, fileName, content, spliter);

        // --- 3. 블럭별로 임베딩 --- 
        const embededData = await this.embedModel.embeddingBlocks(blocks);

        // --- 4. 임베딩 결과 저장 --
        await this.database.addItems(blocks, embededData);
        this.database.printAllBlocksbyFilePath(filePath);
    }

    /**
     * 🆕 한 문서 업데이트 함수
     * 기존 블록을 삭제하고 새로운 블록으로 교체
     */
    public async updateOneDocument(
        filePath: string, 
        spliter: string = "### "
    ): Promise<{ updated: boolean; blockCount: number; reason: string }> {
        const normalizedPath = normalizePath(filePath);

        // 1. 파일이 인덱싱되어 있는지 확인
        if (!this.database.hasFile(normalizedPath)) {
            console.log(`[DocumentService] 파일이 인덱싱되지 않음: ${normalizedPath}`);
            return { 
                updated: false, 
                blockCount: 0, 
                reason: "파일이 인덱싱되지 않음. saveOneDocument를 사용하세요." 
            };
        }

        try {
            // 2. 기존 블록 삭제
            const existingBlockIds = this.database.getFileBlockIds(normalizedPath);
            console.log(`[DocumentService] 기존 블록 삭제 중: ${existingBlockIds.length}개`);
            
            await this.database.deleteFileBlocks(normalizedPath);

            console.log(`[DocumentService] 삭제 완료, 인덱스 저장 중...`);
            await this.database.saveData();

            await new Promise(resolve => setTimeout(resolve, 100));

            // 3. 파일 읽기 및 파싱
            const content = await this.app.vault.adapter.read(normalizedPath);
            const fileName = filePath.split('/').pop()!;
            const blocks = parseMarkdownByHeadings(filePath, fileName, content, spliter);

            if (blocks.blocks.length === 0) {
                console.warn(`[DocumentService] 파싱된 블록 없음: ${normalizedPath}`);
                return { 
                    updated: false, 
                    blockCount: 0, 
                    reason: "파싱된 블록 없음" 
                };
            }

            // 4. 임베딩 생성
            const embeddedData = await this.embedModel.embeddingBlocks(blocks);

            // 5. 새 블록 추가
            await this.database.addItems(blocks, embeddedData);
            await this.database.saveData();

            console.log(
                `[DocumentService] ✅ 업데이트 완료: ${normalizedPath} ` +
                `(${existingBlockIds.length}개 → ${blocks.blocks.length}개 블록)`
            );

            return { 
                updated: true, 
                blockCount: blocks.blocks.length, 
                reason: "업데이트 완료" 
            };

        } catch (error) {
            console.error(`[DocumentService] 업데이트 실패: ${normalizedPath}`, error);
            throw error;
        }
    }

    // Vault 전체 순회 및 저장 함수
    public async saveVault(allFilePaths: TFile[], batchSize: number = 10, spliter: string = "### ") {
        console.log
        // batchSize만큼 saveOneDocument 병렬처리
        for (let i = 0; i < allFilePaths.length; i += batchSize) {
            const batch = allFilePaths.slice(i, i+batchSize);
            console.log(`HIHIHIHIHIHIHIH----------: ${batch.toString()}`);
            const savePromise = batch.map(filePath => this.saveOneDocument(filePath.path, spliter));
            await Promise.all(savePromise);
        }
    }

    // 파일 이동시(Path 변경시) 감지 및 변경함수
    public renameFilePath(oldPath: string, newPath: string) {
        this.database.renameFilePath(oldPath, newPath);
    }

    public async searchSimilarBlocks(fileName: string, headingText: string, spliter: string, topK: number = 50) {
        const key = `${headingText.replace(spliter, "").trim()} of ${fileName}`;
        const hashedKey = hashString(key);
        // console.log(`documentservice querykey: ${key}`);
        const queryVector = this.database.getVectorById(hashedKey)!;
        // console.log(`documentservice queryvector: ${queryVector}`);

        const searchResult = await this.database.search(queryVector, 10);
        
        // for (const each of searchResult) {
        //     console.log(`---------------------------------------------`);
        //     console.log(`ID: ${each.id}, score: ${each.score}, fileName: ${each.metadata.fileName}, key: ${each.block.key}`);
        // }

        return searchResult;
    }

    public async resetDatabase(): Promise<void> {
        this.database.resetDatabase();
    }
}