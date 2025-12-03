import { ItemView, WorkspaceLeaf, TFile, Notice, normalizePath, ButtonComponent, MarkdownRenderer, MarkdownView, setIcon, Modal } from "obsidian";
import MyPlugin from "src/main";
import { MainDataBaseSearchResult } from "src/types/structures";
import { setupDragData, createDragPreview } from "src/utils/drag_handler";
import { extractHeadingFromKey, cleanFileName } from "src/utils/link_generator";

export const SEARCH_VIEW_TYPE = "search-view";

export class SearchView extends ItemView {
    private resultsContainer: HTMLElement | null = null;
    private controlsContainer: HTMLElement | null = null;
    private plugin: MyPlugin;
    private mainContainer: HTMLElement | null = null;

    // 레이스 컨디션 방지용 ID
    private latestRequestId = 0;

    // onOpen 이전에 전달된 결과 버퍼
    private lastResults: MainDataBaseSearchResult[] | null = null;

    private readonly SCORE_THRESHOLDS = {
        HIGH: 80,
        MEDIUM: 50
    };

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return SEARCH_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Connection Recommendation";
    }
    
    async onOpen(): Promise<void> {
        this.contentEl.empty();
        this.contentEl.addClass('chumsa-side-view-wrapper');

        // 🔧 Flexbox 레이아웃을 위한 메인 컨테이너 생성
        this.mainContainer = this.contentEl.createEl("div", { cls: "chumsa-side-view" });
        
        // 헤더 영역 (고정)
        const headerEl = this.mainContainer.createEl("div", { cls: "search-view-header" });
        headerEl.createEl("h2", { text: "관련 노트를 찾아보세요." });

        // 컨트롤 버튼 영역 (고정)
        this.controlsContainer = this.mainContainer.createEl("div", { cls: "search-view-controls" });
        this.createControlButtons();
        
        // 결과 컨테이너 (스크롤 가능)
        this.resultsContainer = this.mainContainer.createEl("div", { cls: "search-results-container" });
        
        // 초기 안내 혹은 버퍼된 결과 표시
        if (this.lastResults && this.lastResults.length > 0) {
            await this.displaySearchResults(this.lastResults);
        } else {
            this.showEmptyState("헤딩 옆의 검색 아이콘을 클릭하여 관련 노트를 찾아보세요.");
        }
    }

    private createControlButtons(): void {
        if (!this.controlsContainer) return;

        this.controlsContainer.empty();

        const buttonsRow = this.controlsContainer.createEl("div", { cls: "control-buttons-row" });

        // 버튼 1: 현재 파일 인덱싱
        new ButtonComponent(buttonsRow)
            .setButtonText("🔄 현재 파일")
            .setTooltip("현재 열린 파일을 인덱싱합니다")
            .onClick(async () => {
                await this.indexCurrentFile();
            });

        // 버튼 2: 자동 태그 생성
        new ButtonComponent(buttonsRow)
            .setButtonText("🏷️ 자동 태그")
            .setTooltip("현재 파일에 자동으로 태그를 생성합니다")
            .onClick(async () => {
                await this.generateAutoTags();
            });

        // 버튼 3: 전체 파일 임베딩 (🆕 추가)
        new ButtonComponent(buttonsRow)
            .setButtonText("📚 전체 임베딩")
            .setTooltip("볼트 전체 파일을 임베딩합니다")
            .onClick(async () => {
                await this.indexAllFiles();
            });

        // 버튼 4: 인덱스 초기화
        new ButtonComponent(buttonsRow)
            .setButtonText("🗑️ 초기화")
            .setTooltip("인덱스를 초기화합니다")
            .setWarning()
            .onClick(async () => {
                await this.resetDatabase();
            });
    }

    async onClose(): Promise<void> {
        this.resultsContainer = null;
        this.controlsContainer = null;
        this.mainContainer = null;
        this.lastResults = null;
        this.latestRequestId = 0;
    }

    /**
     * 결과 설정 (비동기 처리)
     */
    public async setResults(results: MainDataBaseSearchResult[], requestId: number): Promise<void> {
        // 레이스 컨디션 방지
        if (requestId < this.latestRequestId) {
            console.log(`[SearchView] 오래된 요청 무시: ${requestId} < ${this.latestRequestId}`);
            return;
        }

        this.latestRequestId = requestId;

        // onOpen이 실행되지 않은 경우 버퍼에 저장
        if (!this.resultsContainer) {
            console.log(`[SearchView] onOpen 대기 중. 결과 버퍼링.`);
            this.lastResults = results;
            return;
        }

        console.log(`[SearchView] 결과 표시: ${results.length}개 (requestId: ${requestId})`);

        this.resultsContainer.empty();

        if (results.length === 0) {
            this.showEmptyState("검색 결과가 없습니다.");
            return;
        }

        // 비동기로 카드 생성 (순차 처리)
        for (const result of results) {
            await this.createResultCard(result);
        }
    }

    /**
     * 외부에서 로딩 상태를 표시하기 위한 API
     */
    public showLoadingSafe(requestId?: number): void {
        if (typeof requestId === "number" && requestId < this.latestRequestId) return;
        if (typeof requestId === "number") this.latestRequestId = requestId;

        if (!this.resultsContainer) {
            this.lastResults = null;
            return;
        }
        this.showLoading();
    }

    /**
     * 외부에서 에러 상태를 표시하기 위한 API
     */
    public showErrorSafe(message: string, requestId?: number): void {
        if (typeof requestId === "number" && requestId < this.latestRequestId) return;
        if (typeof requestId === "number") this.latestRequestId = requestId;

        if (!this.resultsContainer) {
            this.lastResults = null;
            return;
        }
        this.showError(message);
    }

    /**
     * 검색 결과를 UI에 표시
     */
    async displaySearchResults(results: MainDataBaseSearchResult[]): Promise<void> {
        if (!this.resultsContainer) {
            console.error("Results container not initialized");
            return;
        }

        this.resultsContainer.empty();

        if (results.length === 0) {
            this.showEmptyState("관련 노트를 찾을 수 없습니다.");
            console.log("검색 결과 없음");
            return;
        }

        // 결과 헤더
        const resultHeader = this.resultsContainer.createEl("div", { cls: "search-results-header" });
        resultHeader.createEl("h3", { text: `${results.length}개의 관련 노트` });

        // 각 결과를 카드로 렌더링
        for (const result of results) {
            await this.createResultCard(result);
        }

        console.log(`검색 결과 ${results.length}개 렌더링 완료`);
    }

    /**
     * 개별 검색 결과 카드 생성
     */
    private async createResultCard(result: MainDataBaseSearchResult): Promise<void> {
        if (!this.resultsContainer) return;

        const card = this.resultsContainer.createEl("div", { cls: "search-result-card" });

        // 드래그 가능하도록 설정
        card.setAttribute('draggable', 'true');
        card.style.cursor = "grab";

        // 메타데이터 영역
        const metaEl = card.createEl("div", { cls: "result-meta" });
        
        // 🔧 link_generator 함수 사용
        const fileName = cleanFileName(result.metadata.fileName);
        const fileNameEl = metaEl.createEl("strong", { cls: "result-filename" });
        fileNameEl.setText(fileName);
        
        metaEl.createEl("span", { text: " / ", cls: "result-separator" });

        // 키 정보
        const keyParts = result.metadata.key.split('/').slice(1).join('/') || result.metadata.key;
        const displayKey = keyParts.split('of')[0].trim();
        
        metaEl.createEl("span", { 
            text: displayKey,
            cls: "result-key" 
        });

        // 유사도 점수
        const scorePercentage = (result.score * 100).toFixed(1);
        const scoreEl = card.createEl("div", { cls: "result-score" });
        scoreEl.setText(`유사도: ${scorePercentage}%`);
        
        const scoreValue = parseFloat(scorePercentage);
        let scoreClass = "score-low";
        
        if (scoreValue >= this.SCORE_THRESHOLDS.HIGH) {
            scoreClass = "score-high";
        } else if (scoreValue >= this.SCORE_THRESHOLDS.MEDIUM) {
            scoreClass = "score-medium";
        }

        scoreEl.addClass(scoreClass);

        // 블록 내용 미리보기
        if (result.block && result.block.text) {
            const previewEl = card.createEl("div", { cls: "result-preview" });
            
            let previewText = this.preparePreviewText(result.block.text);
            
            try {
                await MarkdownRenderer.render(
                    this.app,
                    previewText,
                    previewEl,
                    result.metadata.filePath,
                    this
                );
                
                previewEl.querySelectorAll('a').forEach(link => {
                    link.setAttribute('tabindex', '-1');
                });

                previewEl.querySelectorAll('.heading-collapse-indicator').forEach(el => el.remove());
                
            } catch (error) {
                console.error('Markdown 렌더링 실패:', error);
                previewEl.setText(previewText);
            }
        }

        this.setupDragAndDrop(card, result);

        // 클릭 이벤트: 파일 열기
        this.registerDomEvent(card, "click", async () => {
            await this.handleResultClick(result);
        });
    }

    /**
     * 드래그 앤 드롭 설정
     */
    private setupDragAndDrop(
        element: HTMLElement,
        result: MainDataBaseSearchResult
    ): void {
        // 드래그 시작
        this.registerDomEvent(element, 'dragstart', (event: DragEvent) => {
            if (!event.dataTransfer) return;

            // 🔧 간단한 드래그 데이터 설정
            const linkText = setupDragData(event.dataTransfer, result, false);
            
            // 🔧 프리뷰 생성 (더 안정적인 방식)
            const preview = createDragPreview(result);
            
            // 🔧 타이밍 조정 - 프리뷰가 DOM에 추가된 후 설정
            requestAnimationFrame(() => {
                if (event.dataTransfer) {
                    event.dataTransfer.setDragImage(preview, 20, 20);
                }
            });
            
            element.addClass('dragging');
            element.style.cursor = 'grabbing';
            
            console.log(`[Drag] 시작: ${linkText}`);
        });

        // 드래그 종료
        this.registerDomEvent(element, 'dragend', () => {
            element.removeClass('dragging');
            element.style.cursor = 'grab';
        });
    }

    /**
     * 미리보기 텍스트 정리
     */
    private preparePreviewText(text: string): string {
        const MAX_LENGTH = 200;
        
        let cleaned = text
            .replace(/!\[\[.*?\]\]/g, '')
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/```[\s\S]*?```/g, '[코드]')
            .replace(/^#{1,6}\s+.*$/gm, '')
            .replace(/\[\[.*?\|.*?\]\]/g, (match) => {
                const parts = match.slice(2, -2).split('|');
                return parts[1] || parts[0];
            })
            .replace(/\[\[.*?\]\]/g, (match) => {
                return match.slice(2, -2);
            })
            .trim();
        
        if (cleaned.length > MAX_LENGTH) {
            cleaned = cleaned.substring(0, MAX_LENGTH);
            const lastSpace = cleaned.lastIndexOf(' ');
            if (lastSpace > 0) {
                cleaned = cleaned.substring(0, lastSpace);
            }
            cleaned += '...';
        }
        
        return cleaned;
    }

    /**
     * 검색 결과 카드 클릭 핸들러
     */
    private async handleResultClick(result: MainDataBaseSearchResult): Promise<void> {
        try {
            // 🔧 link_generator 함수 사용
            const heading = extractHeadingFromKey(result.metadata.key);
            
            if (!heading) {
                await this.app.workspace.openLinkText(
                    result.metadata.filePath,
                    "",
                    false,
                    { active: true }
                );
                return;
            }

            const linkText = `${result.metadata.filePath}#${heading}`;
            
            console.log(`[SearchView] 링크로 이동: ${linkText}`);
            
            await this.app.workspace.openLinkText(
                linkText,
                "",
                false,
                { active: true }
            );

            console.log(`[SearchView] ✅ 이동 완료`);

        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "알 수 없는 오류";
            console.error("[SearchView] 파일 열기 실패:", errorMsg);
            new Notice(`파일을 여는 중 오류: ${errorMsg}`);
        }
    }

    /**
     * 빈 상태 메시지 표시
     */
    private showEmptyState(message: string): void {
        if (!this.resultsContainer) return;

        this.resultsContainer.empty();
        const emptyStateEl = this.resultsContainer.createEl("div", { cls: "search-empty-state" });
        emptyStateEl.createEl("p", { text: message });
    }

    /**
     * 로딩 상태 표시
     */
    showLoading(): void {
        if (!this.resultsContainer) return;

        this.resultsContainer.empty();
        const loadingEl = this.resultsContainer.createEl("div", { cls: "search-loading" });
        loadingEl.createEl("p", { text: "검색 중..." });
    }

    /**
     * 에러 메시지 표시
     */
    showError(errorMessage: string): void {
        if (!this.resultsContainer) return;

        this.resultsContainer.empty();
        const errorEl = this.resultsContainer.createEl("div", { cls: "search-error" });
        errorEl.createEl("p", { text: `⚠️ ${errorMessage}` });
    }

    private async indexCurrentFile(): Promise<void> {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
            new Notice("열린 파일이 없습니다.");
            return;
        }

        if (!this.plugin.documentService) {
            new Notice("먼저 설정에서 DocumentService를 초기화하세요.");
            return;
        }

        try {
            const fileBlocks = await this.plugin.documentService.database.getFileBlockIds(file.path);

            const startTime = Date.now();
            if (fileBlocks.length > 0) {
                new Notice(
                    `현재 상태: ${fileBlocks.length}개 블록 인덱싱됨\n` +
                    `업데이트를 시작합니다...`
                );
                await this.plugin.documentService.updateOneDocument(
                    file.path,
                    this.plugin.settings.spliter
                );
            } else {
                new Notice(`인덱싱 시작: ${file.name}`);
                await this.plugin.documentService.saveOneDocument(
                    file.path,
                    this.plugin.settings.spliter
                );
            }
            const duration = Date.now() - startTime;
            new Notice(`✅ 인덱싱 완료: ${file.name} (${duration}ms)`);
        } catch (error) {
            console.error("인덱싱 실패:", error);
            const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";
            new Notice(`❌ 인덱싱 실패: ${errorMsg}`);
        }
    }

    /**
     * 데이터베이스 초기화
     */
    private async resetDatabase(): Promise<void> {
        if (!this.plugin.documentService) {
            new Notice("DocumentService가 초기화되지 않았습니다.");
            return;
        }

        const confirmed = confirm(
            "⚠️ 경고: 모든 인덱스 데이터가 삭제됩니다.\n\n" +
            "계속하시겠습니까?"
        );
        if (!confirmed) return;

        try {
            new Notice("데이터베이스 초기화 중...");
            
            if (typeof this.plugin.documentService.resetDatabase === 'function') {
                await this.plugin.documentService.resetDatabase();
            } else {
                this.plugin.documentService = null;
                await this.plugin['tryInitializeDocumentService'](true);
            }
            
            this.showEmptyState("데이터베이스가 초기화되었습니다.");
            new Notice("✅ 데이터베이스 초기화 완료");
        } catch (error) {
            console.error("데이터베이스 초기화 실패:", error);
            const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";
            new Notice(`❌ 초기화 실패: ${errorMsg}`);
        }
    }

    /**
     * 자동 태그 생성
     */
    private async generateAutoTags(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice("열린 파일이 없습니다.");
            return;
        }

        if (!this.plugin.documentService) {
            new Notice("먼저 설정에서 DocumentService를 초기화하세요.");
            return;
        }

        try {
            new Notice(`"${activeFile.basename}" 자동 태그 생성 중...`);

            const result = await this.plugin.documentService.generateAndApplyAutoTags(
                activeFile.path,
                {
                    maxTags: this.plugin.settings.autoTagMaxTags || 8,
                    language: this.plugin.settings.autoTagLanguage || 'ko',
                    includeReasoning: false
                }
            );

            if (result.addedTags.length > 0) {
                new Notice(
                    `✅ ${result.addedTags.length}개 태그 추가됨\n${result.addedTags.join(', ')}`,
                    5000
                );
            } else {
                new Notice(
                    `ℹ️ 추가할 새 태그가 없습니다\n생성된 태그: ${result.generatedTags.join(', ')}`,
                    4000
                );
            }

            console.log('[SearchView] 자동 태그 결과:', result);

        } catch (error) {
            console.error("자동 태그 생성 실패:", error);
            const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";
            new Notice(`❌ 자동 태그 생성 실패: ${errorMsg}`);
        }
    }

    /**
     * 볼트 전체 파일 임베딩
     */
    private async indexAllFiles(): Promise<void> {
        if (!this.plugin.documentService) {
            new Notice("먼저 설정에서 DocumentService를 초기화하세요.");
            return;
        }

        const confirmed = await this.confirmBulkIndexing();
        if (!confirmed) return;

        try {
            const allFiles = this.app.vault.getMarkdownFiles();
            const totalFiles = allFiles.length;

            if (totalFiles === 0) {
                new Notice("임베딩할 마크다운 파일이 없습니다.");
                return;
            }

            new Notice(`📚 전체 임베딩 시작: ${totalFiles}개 파일`);
            console.log(`[SearchView] 전체 임베딩 시작: ${totalFiles}개 파일`);

            const startTime = Date.now();

            // 🔧 결과 반환값 사용
            const result = await this.plugin.documentService.saveVault(
                allFiles,
                10,
                this.plugin.settings.spliter
            );

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            
            // 🔧 성공/실패 분리 표시
            if (result.failCount === 0) {
                new Notice(
                    `✅ 전체 임베딩 완료!\n` +
                    `처리된 파일: ${result.successCount}개\n` +
                    `소요 시간: ${duration}초`,
                    6000
                );
            } else {
                new Notice(
                    `⚠️ 임베딩 완료 (일부 실패)\n` +
                    `성공: ${result.successCount}개\n` +
                    `실패: ${result.failCount}개\n` +
                    `소요 시간: ${duration}초`,
                    8000
                );
                
                // 실패 파일 로그
                console.warn('[SearchView] 실패한 파일:', result.failedFiles);
            }

            console.log(`[SearchView] ✅ 전체 임베딩 완료: ${result.successCount}/${totalFiles}개, ${duration}초`);

            this.showEmptyState(
                `✅ ${result.successCount}개 파일 임베딩 완료\n` +
                (result.failCount > 0 ? `⚠️ ${result.failCount}개 파일 실패\n` : '') +
                `헤딩 검색 아이콘을 클릭하여 유사 문서를 찾아보세요.`
            );

        } catch (error) {
            console.error("[SearchView] 전체 임베딩 실패:", error);
            const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";
            new Notice(`❌ 전체 임베딩 실패: ${errorMsg}`, 5000);
        }
    }

/**
 * 🆕 전체 임베딩 확인 모달
 */
private async confirmBulkIndexing(): Promise<boolean> {
    return new Promise((resolve) => {
        const modal = new Modal(this.app);
        modal.titleEl.setText("전체 파일 임베딩");

        const totalFiles = this.app.vault.getMarkdownFiles().length;

        modal.contentEl.createEl("p", {
            text: `볼트 내 모든 마크다운 파일(${totalFiles}개)을 임베딩합니다.`
        });

        modal.contentEl.createEl("p", {
            text: "⚠️ 이 작업은 시간이 오래 걸릴 수 있으며, OpenAI API 사용량이 증가합니다.",
            cls: "mod-warning"
        });

        modal.contentEl.createEl("p", {
            text: `예상 소요 시간: 약 ${Math.ceil(totalFiles / 10)}분`,
            cls: "setting-item-description"
        });

        const buttonContainer = modal.contentEl.createDiv("modal-button-container");

        const confirmButton = buttonContainer.createEl("button", {
            text: "임베딩 시작",
            cls: "mod-cta"
        });
        confirmButton.addEventListener("click", () => {
            modal.close();
            resolve(true);
        });

        const cancelButton = buttonContainer.createEl("button", {
            text: "취소"
        });
        cancelButton.addEventListener("click", () => {
            modal.close();
            resolve(false);
        });

        modal.open();
    });
}
}