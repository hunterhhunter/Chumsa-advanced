import { App, normalizePath, TFile } from "obsidian";
import { MainDataBase } from "./main_database";
import { parseMarkdownByHeadings } from "src/utils/markdown_parser";
import { hashString } from "src/utils/hash_func";
import { LLMService } from "./llm_service";
import { AutoTagOptions, AutoTagResponse, AutoTagResult } from "src/types/structures";

export class DocumentService {
    private app: App;
    public database: MainDataBase;
    private llmService: LLMService;

    constructor(app: App, apiKey: string, indexFileName: string) {
        this.app = app;
        this.database = new MainDataBase(app);
        this.database.initialize(indexFileName, 1536, 10000);

        this.llmService = new LLMService(apiKey);
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
        const embededData = await this.llmService.embeddingBlocks(blocks);

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
            const embeddedData = await this.llmService.embeddingBlocks(blocks);

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

    public async generateAutoTags(
        filePath: string,
        options?: AutoTagOptions
    ): Promise<AutoTagResponse> {
        const normalizedPath = normalizePath(filePath);
        const file = this.app.vault.getAbstractFileByPath(normalizedPath);
        
        if (!(file instanceof TFile)) {
            throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
        }

        try {
            // 파일 내용 읽기
            const content = await this.app.vault.read(file);
            const fileName = file.basename;

            console.log(`[DocumentService] 자동 태그 생성 시작: ${fileName}`);

            // LLM을 통한 태그 생성
            const response = await this.llmService.generateAutoTags(
                content,
                fileName,
                options
            );

            console.log(
                `[DocumentService] ✅ 자동 태그 생성 완료: ${fileName} - ` +
                `${response.tags.length}개 태그 (신뢰도: ${(response.confidence || 0) * 100}%)`
            );

            return response;

        } catch (error) {
            console.error(`[DocumentService] 자동 태그 생성 실패: ${filePath}`, error);
            throw new Error(`자동 태그 생성 중 오류 발생: ${error.message}`);
        }
    }

    public async generateAndApplyAutoTags(
        filePath: string,
        options?: AutoTagOptions
    ): Promise<AutoTagResult> {
        const normalizedPath = normalizePath(filePath);
        const file = this.app.vault.getAbstractFileByPath(normalizedPath);
        
        if (!(file instanceof TFile)) {
            throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
        }

        try {
            // 1. 자동 태그 생성
            const response = await this.generateAutoTags(normalizedPath, options);

            // 2. 기존 태그 읽기
            const existingTags = await this.getExistingTags(file);

            // 3. 새로운 태그만 필터링
            const addedTags = response.tags.filter(
                tag => !existingTags.includes(tag)
            );

            // 4. Frontmatter에 태그 추가
            if (addedTags.length > 0) {
                await this.addTagsToFrontmatter(file, addedTags);
                console.log(
                    `[DocumentService] ✅ 태그 적용 완료: ${file.basename} - ` +
                    `${addedTags.length}개 추가 (${addedTags.join(', ')})`
                );
            } else {
                console.log(`[DocumentService] 추가할 새 태그 없음: ${file.basename}`);
            }

            return {
                filePath: normalizedPath,
                fileName: file.basename,
                generatedTags: response.tags,
                existingTags,
                addedTags,
                confidence: response.confidence
            };

        } catch (error) {
            console.error(`[DocumentService] 자동 태그 적용 실패: ${filePath}`, error);
            throw error;
        }
    }

    /**
     * 파일의 기존 태그 읽기
     */
    private async getExistingTags(file: TFile): Promise<string[]> {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;

        if (!frontmatter || !frontmatter.tags) {
            return [];
        }

        // 태그가 문자열인 경우
        if (typeof frontmatter.tags === 'string') {
            return [frontmatter.tags];
        }

        // 태그가 배열인 경우
        return Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    }

    /**
     * Frontmatter에 태그 추가 (기존 태그 유지)
     */
    private async addTagsToFrontmatter(
        file: TFile,
        newTags: string[]
    ): Promise<void> {
        let content = await this.app.vault.read(file);
        const existingTags = await this.getExistingTags(file);

        // 중복 제거 후 병합
        const allTags = Array.from(new Set([...existingTags, ...newTags]));

        // Frontmatter 업데이트
        const tagsYaml = `tags:\n${allTags.map(tag => `  - ${tag}`).join('\n')}`;

        if (content.startsWith('---')) {
            // 기존 frontmatter 수정
            const frontmatterEnd = content.indexOf('---', 3);
            if (frontmatterEnd !== -1) {
                let frontmatter = content.substring(3, frontmatterEnd);

                // 기존 tags 필드 제거
                frontmatter = frontmatter.replace(
                    /tags:[\s\S]*?(?=\n[a-z_]|\n---|\n$)/i,
                    ''
                );

                // 새 tags 추가
                const updatedFrontmatter = frontmatter.trim() + '\n' + tagsYaml;
                content = `---\n${updatedFrontmatter}\n---` + content.substring(frontmatterEnd + 3);
            }
        } else {
            // Frontmatter 새로 생성
            content = `---\n${tagsYaml}\n---\n\n${content}`;
        }

        await this.app.vault.modify(file, content);
    }

    // API 키 업데이트 메서드
    updateApiKey(apiKey: string): void {
        this.llmService.updateApiKey(apiKey);
    }
}