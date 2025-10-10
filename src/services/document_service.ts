import { App, normalizePath, TFile } from "obsidian";
import { MainDataBase } from "./main_database";
import { EmbedModel } from "./embed_model";
import { parseMarkdownByHeadings } from "src/utils/markdown_parser";
import { hashString } from "src/utils/hash_func";

export class DocumentService {
    private app: App;
    private database: MainDataBase;
    private embedModel: EmbedModel;

    constructor(app: App, apiKey: string, indexFileName: string) {
        this.app = app;
        this.database = new MainDataBase(app);
        this.database.initialize(indexFileName, 1536, 10000);

        this.embedModel = new EmbedModel(apiKey);
    }
    
    // 한 문서 저장 함수
    public async saveOneDocument(filePath: string, ) {
        // --- 1. 파일 읽어오기 ---
        const nomalizedPath = normalizePath(filePath)
        const content = await this.app.vault.adapter.read(nomalizedPath);
        const fileName = filePath.split('/').pop()!;

        // --- 2. 마크다운 파싱 ---
        const blocks = parseMarkdownByHeadings(filePath, fileName, content, "###");

        // --- 3. 블럭별로 임베딩 --- 
        const embededData = await this.embedModel.embeddingBlocks(blocks);

        // --- 4. 임베딩 결과 저장 --
        await this.database.addItems(blocks, embededData);
        this.database.printAllBlocksbyFilePath(filePath);
    }

    // Vault 전체 순회 및 저장 함수
    public async saveVault(allFilePaths: TFile[], batchSize: number = 10) {
        console.log
        // batchSize만큼 saveOneDocument 병렬처리
        for (let i = 0; i < allFilePaths.length; i += batchSize) {
            const batch = allFilePaths.slice(i, i+batchSize);
            console.log(`HIHIHIHIHIHIHIH----------: ${batch.toString()}`);
            const savePromise = batch.map(filePath => this.saveOneDocument(filePath.path));
            await Promise.all(savePromise);
        }
    }

    // 파일 이동시(Path 변경시) 감지 및 변경함수
    public renameFilePath(oldPath: string, newPath: string) {
        this.database.renameFilePath(oldPath, newPath);
    }

    public async searchSimilarBlocks(fileName: string, headingText: string, spliter: string) {
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
}