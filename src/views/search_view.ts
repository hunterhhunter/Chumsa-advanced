import { ItemView, WorkspaceLeaf, TFile, Notice, normalizePath } from "obsidian";
import { MainDataBaseSearchResult } from "src/types/structures";

export const SEARCH_VIEW_TYPE = "search-view";

export class SearchView extends ItemView {
    private resultsContainer: HTMLElement | null = null;

    // 레이스 컨디션 방지용 최신 요청 ID
    private latestRequestId = 0;

    // onOpen 이전에 전달된 결과 버퍼
    private lastResults: MainDataBaseSearchResult[] | null = null;

    private readonly SCORE_THRESHOLDS = {
        HIGH: 80,
        MEDIUM: 60
    };

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return SEARCH_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Connection Recommendation";
    }
    
    async onOpen(): Promise<void> {
        this.containerEl.addClass('chumsa-side-view');

        const container = this.contentEl;
        container.empty();
        
        // 헤더 영역
        const headerEl = container.createEl("div", { cls: "search-view-header" });
        headerEl.createEl("h2", { text: "관련 노트를 찾아보세요." });
        
        // 결과 컨테이너 생성 및 참조 저장
        this.resultsContainer = container.createEl("div", { cls: "search-results-container" });
        
        // 초기 안내 혹은 버퍼된 결과 표시
        if (this.lastResults && this.lastResults.length > 0) {
            await this.displaySearchResults(this.lastResults);
        } else {
            this.showEmptyState("헤딩 옆의 검색 아이콘을 클릭하여 관련 노트를 찾아보세요.");
        }
    }

    async onClose(): Promise<void> {
        this.resultsContainer = null;
        this.lastResults = null;
        this.latestRequestId = 0;
    }

    /**
     * 외부에서 안전하게 결과를 전달하기 위한 API
     * - requestId가 최신이 아닐 경우 무시
     * - 뷰가 아직 열리지 않은 경우 버퍼링
     */
    public async setResults(results: MainDataBaseSearchResult[], requestId: number): Promise<void> {
        if (typeof requestId === "number" && requestId < this.latestRequestId) return;
        if (typeof requestId === "number") this.latestRequestId = requestId;

        this.lastResults = results;

        if (!this.resultsContainer) {
            // 아직 뷰가 열리지 않았으므로 버퍼에 저장만
            return;
        }
        await this.displaySearchResults(results);
    }

    /**
     * 외부에서 로딩 상태를 표시하기 위한 API
     */
    public showLoadingSafe(requestId?: number): void {
        if (typeof requestId === "number" && requestId < this.latestRequestId) return;
        if (typeof requestId === "number") this.latestRequestId = requestId;

        if (!this.resultsContainer) {
            // 뷰가 열리면 기본 안내가 표시됨
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

        // 기존 내용 제거
        this.resultsContainer.empty();

        // 결과가 없는 경우
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
            this.createResultCard(result);
        }

        console.log(`검색 결과 ${results.length}개 렌더링 완료`);
    }

    /**
     * 개별 검색 결과 카드 생성
     */
    private createResultCard(result: MainDataBaseSearchResult): void {
        if (!this.resultsContainer) return;

        const card = this.resultsContainer.createEl("div", { cls: "search-result-card" });

        // 포인터 스타일
        card.style.cursor = "pointer";

        // 메타데이터 영역
        const metaEl = card.createEl("div", { cls: "result-meta" });
        
        // 파일명 (굵게)
        const fileNameEl = metaEl.createEl("strong", { cls: "result-filename" });
        fileNameEl.setText(result.metadata.fileName);
        
        // 구분자 및 키 정보
        metaEl.createEl("span", { text: " / ", cls: "result-separator" });
        metaEl.createEl("span", { 
            text: result.metadata.key.split('/').slice(1).join('/') || result.metadata.key,
            cls: "result-key" 
        });

        // 유사도 점수
        const scorePercentage = (result.score * 100).toFixed(1);
        const scoreEl = card.createEl("div", { cls: "result-score" });
        scoreEl.setText(`유사도: ${scorePercentage}%`);
        
        // 점수에 따른 색상 표시
        const scoreValue = parseFloat(scorePercentage);
        let scoreClass = "score-low";
        
        if (scoreValue >= this.SCORE_THRESHOLDS.HIGH) {
            scoreClass = "score-high";
        } else if (scoreValue >= this.SCORE_THRESHOLDS.MEDIUM) {
            scoreClass = "score-medium";
        }

        // 점수 클래스 더하기
        scoreEl.addClass(scoreClass);

        // 블록 내용 미리보기
        if (result.block && result.block.text) {
            const previewEl = card.createEl("div", { cls: "result-preview" });
            const previewText = result.block.text.length > 150 
                ? result.block.text.slice(0, 150) + "..." 
                : result.block.text;
            previewEl.setText(previewText);
        }

        // 클릭 이벤트 등록: 파일 열기
        this.registerDomEvent(card, "click", async () => {
            await this.handleResultClick(result);
        });
    }

    /**
     * 검색 결과 카드 클릭 핸들러
     */
    private async handleResultClick(result: MainDataBaseSearchResult): Promise<void> {
        try {
            const normalizedPath = normalizePath(result.metadata.filePath);
            const file = this.app.vault.getAbstractFileByPath(normalizedPath);
            if (!(file instanceof TFile)) {
                new Notice("파일을 찾을 수 없습니다.");
                return;
            }
            const leaf = this.app.workspace.getLeaf(false);
            if (!leaf) {
                new Notice("새 탭을 열 수 없습니다.");
                return;
            }
            // TODO: 해당 헤더 위치로 이동
            await leaf.openFile(file);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "알 수 없는 오류";
            console.error("Failed to open file:", errorMsg, result.metadata);
            new Notice(`파일을 여는 중 오류가 발생했습니다: ${errorMsg}`);
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
}