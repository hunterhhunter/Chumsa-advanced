import { App, normalizePath, Notice, TFile } from "obsidian";
import { MainDataBase } from "./main_database";
import { parseMarkdownByHeadings } from "src/utils/markdown_parser";
import { hashString } from "src/utils/hash_func";
import { LLMService } from "./llm_service";
import { AutoTagOptions, AutoTagResponse, AutoTagResult } from "src/types/structures";

export class DocumentService {
    private app: App;
    public database: MainDataBase;
    public llmService: LLMService;

    constructor(app: App, apiKey: string, indexFileName: string) {
        this.app = app;
        this.database = new MainDataBase(app);
        this.database.initialize(indexFileName, 1536, 10000);

        this.llmService = new LLMService(apiKey);
    }

    /**
     * Save one document
     */
    public async saveOneDocument(filePath: string, spliter: string = "### ") {
        const normalizedPath = normalizePath(filePath);
        const file = this.app.vault.getAbstractFileByPath(normalizedPath);

        if (!(file instanceof TFile)) {
            console.error(`[DocumentService] 파일을 찾을 수 없음: ${filePath}`);
            return;
        }

        try {
            const content = await this.app.vault.read(file);
            const fileName = file.basename;

            console.log(`[DocumentService] Start parsing document: ${fileName}`);
            const blocks = parseMarkdownByHeadings(
                normalizedPath,
                fileName,
                content,
                spliter
            );

            // 🔧 Check empty blocks
            if (!blocks.blocks || blocks.blocks.length === 0) {
                console.warn(`[DocumentService] ${fileName}: No parsed blocks`);
                new Notice(`⚠️ "${fileName}": No content to index`);
                return;
            }

            console.log(`[DocumentService] ${fileName}: ${blocks.blocks.length} blocks parsed`);

            // Generate Embedding
            const embededData = await this.llmService.embeddingBlocks(blocks);

            // 🔧 Check embedding failure
            if (!embededData || embededData.length === 0) {
                console.warn(`[DocumentService] ${fileName}: Embedding generation failed (empty result)`);
                new Notice(`⚠️ "${fileName}": Embedding generation failed`);
                return;
            }

            console.log(`[DocumentService] ${fileName}: ${embededData.length} embeddings generated`);

            // Save to DB
            await this.database.addItems(blocks, embededData);

            console.log(`[DocumentService] ✅ ${fileName} Save Complete`);

        } catch (error) {
            console.error(`[DocumentService] ${file.basename} Save Failed:`, error);
            throw error; // Propagate up
        }
    }

    /**
     * 🆕 Update one document
     * Delete existing blocks and replace with new blocks
     */
    public async updateOneDocument(
        filePath: string,
        spliter: string = "### "
    ): Promise<{ updated: boolean; blockCount: number; reason: string }> {
        const normalizedPath = normalizePath(filePath);

        // 1. Check if file is indexed
        if (!this.database.hasFile(normalizedPath)) {
            console.log(`[DocumentService] File not indexed: ${normalizedPath}`);
            return {
                updated: false,
                blockCount: 0,
                reason: "File not indexed. Use saveOneDocument."
            };
        }

        try {
            // 2. Delete existing blocks
            const existingBlockIds = this.database.getFileBlockIds(normalizedPath);
            console.log(`[DocumentService] Deleting existing blocks: ${existingBlockIds.length}`);

            await this.database.deleteFileBlocks(normalizedPath);

            console.log(`[DocumentService] Deletion complete, saving index...`);
            await this.database.saveData();

            await new Promise(resolve => setTimeout(resolve, 100));

            // 3. Read and parse file
            const content = await this.app.vault.adapter.read(normalizedPath);
            const fileName = filePath.split('/').pop()!;
            const blocks = parseMarkdownByHeadings(filePath, fileName, content, spliter);

            if (blocks.blocks.length === 0) {
                console.warn(`[DocumentService] No parsed blocks: ${normalizedPath}`);
                return {
                    updated: false,
                    blockCount: 0,
                    reason: "No parsed blocks"
                };
            }

            // 4. Generate Embedding
            const embeddedData = await this.llmService.embeddingBlocks(blocks);

            // 5. Add new blocks
            await this.database.addItems(blocks, embeddedData);
            await this.database.saveData();

            console.log(
                `[DocumentService] ✅ Update Complete: ${normalizedPath} ` +
                `(${existingBlockIds.length} → ${blocks.blocks.length} blocks)`
            );

            return {
                updated: true,
                blockCount: blocks.blocks.length,
                reason: "Update Complete"
            };

        } catch (error) {
            console.error(`[DocumentService] Update Failed: ${normalizedPath}`, error);
            throw error;
        }
    }

    /**
     * Traverse and save entire Vault
     */
    public async saveVault(allFilePaths: TFile[], batchSize: number = 10, spliter: string = "### ") {
        console.log(`[DocumentService] Full Embedding Start: ${allFilePaths.length} files`);

        let successCount = 0;
        let failCount = 0;
        const failedFiles: string[] = [];

        for (let i = 0; i < allFilePaths.length; i += batchSize) {
            const batch = allFilePaths.slice(i, i + batchSize);

            console.log(
                `[DocumentService] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allFilePaths.length / batchSize)}: ` +
                `${batch.map(f => f.basename).join(', ')}`
            );

            // 🔧 Isolate errors with Promise.allSettled
            const results = await Promise.allSettled(
                batch.map(file => this.saveOneDocument(file.path, spliter))
            );

            // Aggregate results
            results.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    successCount++;
                } else {
                    failCount++;
                    const fileName = batch[idx].basename;
                    failedFiles.push(fileName);
                    console.error(`[DocumentService] ${fileName} Failed:`, result.reason);
                }
            });

            // Prevent API Rate Limit (Wait 1s)
            if (i + batchSize < allFilePaths.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        await this.database.saveData();

        console.log(
            `[DocumentService] Full Embedding Complete: ` +
            `Success ${successCount}, Fail ${failCount}`
        );

        if (failedFiles.length > 0) {
            console.warn(`[DocumentService] Failed Files List:`, failedFiles);
        }

        return { successCount, failCount, failedFiles };
    }

    // Detect file move (Path change) and handle
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
            throw new Error(`File not found: ${filePath}`);
        }

        try {
            // Read file content
            const content = await this.app.vault.read(file);
            const fileName = file.basename;

            console.log(`[DocumentService] Auto Tag Generation Start: ${fileName}`);

            // Generate tags via LLM
            const response = await this.llmService.generateAutoTags(
                content,
                fileName,
                options
            );

            console.log(
                `[DocumentService] ✅ Auto Tag Generation Complete: ${fileName} - ` +
                `${response.tags.length} tags (Confidence: ${(response.confidence || 0) * 100}%)`
            );

            return response;

        } catch (error) {
            console.error(`[DocumentService] Auto Tag Generation Failed: ${filePath}`, error);
            throw new Error(`Error during auto tag generation: ${error.message}`);
        }
    }

    public async generateAndApplyAutoTags(
        filePath: string,
        options?: AutoTagOptions
    ): Promise<AutoTagResult> {
        const normalizedPath = normalizePath(filePath);
        const file = this.app.vault.getAbstractFileByPath(normalizedPath);

        if (!(file instanceof TFile)) {
            throw new Error(`File not found: ${filePath}`);
        }

        try {
            // 1. Generate auto tags
            const response = await this.generateAutoTags(normalizedPath, options);

            // 2. Read existing tags
            const existingTags = await this.getExistingTags(file);

            // 3. Filter only new tags
            const addedTags = response.tags.filter(
                tag => !existingTags.includes(tag)
            );

            // 4. Add tags to Frontmatter
            if (addedTags.length > 0) {
                await this.addTagsToFrontmatter(file, addedTags);
                console.log(
                    `[DocumentService] ✅ Tags Applied: ${file.basename} - ` +
                    `${addedTags.length} added (${addedTags.join(', ')})`
                );
            } else {
                console.log(`[DocumentService] No new tags to add: ${file.basename}`);
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
            console.error(`[DocumentService] Auto Tag Application Failed: ${filePath}`, error);
            throw error;
        }
    }

    /**
     * Read existing tags of a file
     */
    private async getExistingTags(file: TFile): Promise<string[]> {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;

        if (!frontmatter || !frontmatter.tags) {
            return [];
        }

        // if tags is string
        if (typeof frontmatter.tags === 'string') {
            return [frontmatter.tags];
        }

        // if tags is array
        return Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    }

    /**
     * Add tags to Frontmatter (Keep existing tags)
     */
    private async addTagsToFrontmatter(
        file: TFile,
        newTags: string[]
    ): Promise<void> {
        let content = await this.app.vault.read(file);
        const existingTags = await this.getExistingTags(file);

        // Deduplicate and Merge
        const allTags = Array.from(new Set([...existingTags, ...newTags]));

        // Update Frontmatter
        const tagsYaml = `tags:\n${allTags.map(tag => `  - ${tag}`).join('\n')}`;

        if (content.startsWith('---')) {
            // Modify existing frontmatter
            const frontmatterEnd = content.indexOf('---', 3);
            if (frontmatterEnd !== -1) {
                let frontmatter = content.substring(3, frontmatterEnd);

                // Remove existing tags field
                frontmatter = frontmatter.replace(
                    /tags:[\s\S]*?(?=\n[a-z_]|\n---|\n$)/i,
                    ''
                );

                // Add new tags
                const updatedFrontmatter = frontmatter.trim() + '\n' + tagsYaml;
                content = `---\n${updatedFrontmatter}\n---` + content.substring(frontmatterEnd + 3);
            }
        } else {
            // Create new Frontmatter
            content = `---\n${tagsYaml}\n---\n\n${content}`;
        }

        await this.app.vault.modify(file, content);
    }

    // API 키 업데이트 메서드
    updateApiKey(apiKey: string): void {
        this.llmService.updateApiKey(apiKey);
    }
}