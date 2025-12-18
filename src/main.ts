import * as dotenv from 'dotenv';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, setIcon, Setting, TFile } from 'obsidian';
import { DocumentService } from './services/document_service';
import { SearchView, SEARCH_VIEW_TYPE } from './views/search_view';
import { ChumsaSettings, DEFAULT_SETTINGS, getHeadingConfig, HeadingLevel } from './settings/settings';
import { ChumsaSettingTab } from './settings/settings_tab';
import { SearchFilter } from './services/search_filter';
import { AI_CHAT_VIEW_TYPE, AIChatView } from './views/ai_chat_view';


dotenv.config();

export default class MyPlugin extends Plugin {
    settings: ChumsaSettings;
    public documentService: DocumentService | null = null;
    searchFilter: SearchFilter | null = null;
    // 검색 레이스 컨디션 방지용 ID 관리 변수
    private searchRequestSeq = 0;

    async onload() {
        console.log('[Main] ===== Plugin Load Start =====');

        await this.loadSettings();
        console.log('[Main] ✅ Settings Loaded');
        console.log(`[Main] API Key Exists: ${!!this.settings.OPENAI_API_KEY}`);
        console.log(`[Main] API Key Length: ${this.settings.OPENAI_API_KEY?.length || 0}`);

        await this.tryInitializeDocumentService();
        console.log(`[Main] DocumentService Initialized: ${!!this.documentService}`);

        this.initializeSearchFilter();
        console.log(`[Main] SearchFilter Initialized: ${!!this.searchFilter}`);



        // --------------------- SEARCH_VIEW Logic ---------------------
        // Register SEARCH_VIEW
        this.registerView(SEARCH_VIEW_TYPE, (leaf) => new SearchView(leaf, this));

        // Register Ribbon Icon to open SEARCH_VIEW
        this.addRibbonIcon(
            "brain-circuit", "Chumsa: Open Search View", () => this.activateSearchView()
        );

        this.registerMarkdownPostProcessor((element, context) => {
            // Get spliter level from settings
            const cfg = getHeadingConfig(this.settings.headingLevel);

            // Find spliter tags within rendered element
            const headings = element.querySelectorAll(cfg.tag);

            headings.forEach(headings => {
                if (headings.querySelector(".search-icon")) {
                    return;
                }

                const iconEl = headings.createEl('span', {
                    cls: 'search-icon',				   // class for css styling
                    attr: {
                        'aria-label': "Search Related Material", // Tooltip on hover

                    }
                });

                setIcon(iconEl, 'link');

                // Register event to execute on icon click
                this.registerDomEvent(iconEl, 'click', async (event: MouseEvent) => {
                    event.preventDefault();
                    event.stopPropagation();
                    await this.handleHeadingSearch(headings, context);
                });
            })
        });

        this.addSettingTab(new ChumsaSettingTab(this.app, this));
    }

    private async handleHeadingSearch(
        heading: Element,
        context: any
    ): Promise<void> {
        const headingText = heading.textContent || "";
        const fileName = context.sourcePath?.split('/').pop()?.replace('.md', '') || 'unknown';

        console.log('[Main] ===== Heading Search Start =====');
        console.log(`[Main] Original Heading Text: "${headingText}"`);
        console.log(`[Main] FileName: "${fileName}"`);
        console.log(`[Main] Full Path: "${context.sourcePath}"`);

        // 🔧 Strengthen Input Validation
        if (!headingText || headingText.trim().length === 0) {
            console.error('[Main] Search Fail: Empty Heading');
            new Notice('No heading text to search.');
            return;
        }

        if (!fileName || fileName === 'unknown') {
            console.error('[Main] Search Fail: FileName Extraction Failed');
            console.error('[Main] context.sourcePath:', context.sourcePath);
            new Notice('Cannot verify file name.');
            return;
        }

        if (!this.documentService) {
            console.error('[Main] Search Fail: DocumentService not initialized');
            new Notice('Please enter OpenAI API Key in Settings first.');
            return;
        }

        // Open SearchView
        const searchView = await this.activateSearchView();
        if (!searchView) {
            console.error('[Main] SearchView Activation Failed');
            new Notice('Cannot open Search View.');
            return;
        }

        const requestId = ++this.searchRequestSeq;
        searchView.showLoadingSafe(requestId);

        try {
            console.log('[Main] Calling DocumentService.searchSimilarBlocks...');

            const results = await this.documentService.searchSimilarBlocks(
                fileName,
                headingText,
                this.settings.spliter,
                50
            );

            console.log(`[Main] ✅ Search Success: ${results.length} results`);

            // Quality Filtering
            const filteredResults = this.searchFilter?.filterResults(results, [], context.sourcePath) || results;
            console.log(`[Main] Results after filtering: ${filteredResults.length}`);

            // Send results to SearchView
            await searchView.setResults(filteredResults, requestId);

        } catch (error) {
            console.error('[Main] ===== Search Failed =====');
            console.error('[Main] Error Detail:', error);

            // 🔧 Messages by Error Type
            let errorMessage = 'An error occurred during search.';

            if (error instanceof Error) {
                console.error('[Main] Error Message:', error.message);
                console.error('[Main] Error Stack:', error.stack);

                if (error.message.includes('빈 텍스트') || error.message.includes('Empty text')) {
                    errorMessage = 'Search text is empty. Check the heading.';
                } else if (error.message.includes('임베딩') || error.message.includes('Embedding')) {
                    errorMessage = 'Embedding generation failed. Check API Key.';
                } else if (error.message.includes('네트워크') || error.message.includes('API') || error.message.includes('Network')) {
                    errorMessage = 'Network error. Check internet connection.';
                } else if (error.message.includes('인덱스') || error.message.includes('Index')) {
                    errorMessage = 'Index error. Please re-index the file.';
                }
            }

            searchView.showErrorSafe(errorMessage, requestId);
            new Notice(`❌ ${errorMessage}`);
        }
    }

    onunload() {
        // Cleanup
        this.searchRequestSeq = 0;
        // 🔧 Clean up AI Chat View
        this.app.workspace.detachLeavesOfType(AI_CHAT_VIEW_TYPE);
    }

    async loadSettings() {
        const raw = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);

        // Migration: Infer if headingLevel is missing but spliter exists
        if (!this.settings.headingLevel) {
            const m = (this.settings.spliter || "### ").trim();
            const map: Record<string, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'> = {
                '#': 'h1', '##': 'h2', '###': 'h3', '####': 'h4', '#####': 'h5', '######': 'h6'
            };
            this.settings.headingLevel = map[m.replace(/\s+$/, '')] ?? 'h3';
            // Sync
            this.settings.spliter = getHeadingConfig(this.settings.headingLevel).splitter;
            await this.saveSettings();
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * SearchView를 활성화하고 인스턴스를 반환
     * @returns SearchView 인스턴스 또는 null
     */
    async activateSearchView(): Promise<SearchView | null> {
        // 이미 열린 뷰가 있으면 재사용
        const existingLeaves = this.app.workspace.getLeavesOfType(SEARCH_VIEW_TYPE);
        if (existingLeaves.length > 0) {
            await this.app.workspace.revealLeaf(existingLeaves[0]);
            return existingLeaves[0].view as SearchView;
        }

        // 오른쪽에 새로운 뷰 열기
        const leaf = this.app.workspace.getRightLeaf(false);
        if (!leaf) {
            return null;
        }

        await leaf.setViewState({
            type: SEARCH_VIEW_TYPE,
            active: true
        });

        await this.app.workspace.revealLeaf(leaf);

        return leaf.view as SearchView;
    }

    private async tryInitializeDocumentService(force = false): Promise<void> {
        console.log('[Main] tryInitializeDocumentService Start');
        console.log(`[Main] force: ${force}, Existing Service: ${!!this.documentService}`);

        if (!this.settings.OPENAI_API_KEY) {
            console.warn('[Main] No API Key, Skipping DocumentService Initialization');
            new Notice('Please enter OpenAI API Key in Settings.');
            return;
        }

        if (this.documentService && !force) {
            console.log('[Main] DocumentService Already Initialized, Skipping');
            return;
        }

        try {
            console.log('[Main] Creating DocumentService...');

            this.documentService = new DocumentService(
                this.app,
                this.settings.OPENAI_API_KEY,
                this.settings.indexFileName
            );

            console.log('[Main] ✅ DocumentService Initialization Complete');

        } catch (error) {
            console.error('[Main] DocumentService Initialization Failed:', error);
            new Notice(`Service Initialization Failed: ${(error as Error).message}`);
            this.documentService = null;
        }
    }

    /**
     * Initialize SearchFilter
     */
    private initializeSearchFilter(): void {
        this.searchFilter = new SearchFilter(this.app);
        console.log('SearchFilter Initialization Complete');
    }

    public async handleHeadingLevelChange(level: HeadingLevel): Promise<void> {
        const cfg = getHeadingConfig(level);
        try {
            // 1) Re-initialize DocumentService
            await this.tryInitializeDocumentService(true);

            if (!this.documentService) {
                new Notice("DocumentService initialization failed. Skipping re-indexing.");
                return;
            }

            // 2) Initialize DB (+ select) and re-index all
            await this.documentService.resetDatabase();
            const files = this.app.vault.getMarkdownFiles();
            if (files.length > 0) {
                new Notice(`Starting Full Re-indexing (${files.length} files)...`);
                await this.documentService.saveVault(files, 10, cfg.splitter);
                new Notice("Full Re-indexing Complete");
            }

            // 3) Re-render all Markdown views
            await this.rerenderAllMarkdownViews();

        } catch (e) {
            console.error("Error during heading level change:", e);
            new Notice("Failed to change heading level. Check console logs.");
        }
    }

    /**
     * Force re-render markdown documents by toggling them
     */
    private async rerenderAllMarkdownViews(): Promise<void> {
        const openFiles: TFile[] = [];
        const leaves = this.app.workspace.getLeavesOfType("markdown");

        for (const leaf of leaves) {
            const view = leaf.view as MarkdownView;
            if (view.file) {
                openFiles.push(view.file);
            }
        }

        // 모든 마크다운 탭 닫기
        for (const leaf of leaves) {
            leaf.detach();
        }

        // 약간의 딜레이 후 다시 열기
        await new Promise(resolve => setTimeout(resolve, 100));

        // 파일들을 다시 열기
        for (const file of openFiles) {
            await this.app.workspace.getLeaf(false).openFile(file);
        }
    }
}

