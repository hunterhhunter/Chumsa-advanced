import { ItemView, WorkspaceLeaf, TFile, Notice, normalizePath, ButtonComponent, MarkdownRenderer, MarkdownView } from "obsidian";
import MyPlugin from "src/main";
import { MainDataBaseSearchResult } from "src/types/structures";
import { getHeadingConfig } from "src/settings/settings";

export const SEARCH_VIEW_TYPE = "search-view";

export class SearchView extends ItemView {
    private resultsContainer: HTMLElement | null = null;
    private controlsContainer: HTMLElement | null = null;
    private plugin: MyPlugin;

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
        this.containerEl.addClass('chumsa-side-view');

        const container = this.contentEl;
        container.empty();
        
        // 헤더 영역
        const headerEl = container.createEl("div", { cls: "search-view-header" });
        headerEl.createEl("h2", { text: "관련 노트를 찾아보세요." });

        // ===== 컨트롤 버튼 영역 =====
        this.controlsContainer = container.createEl("div", { cls: "search-view-controls" });
        this.createControlButtons();

        // 구분선
        container.createEl("hr", { cls: "search-view-divider" });
        
        // 결과 컨테이너 생성 및 참조 저장
        this.resultsContainer = container.createEl("div", { cls: "search-results-container" });
        
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

        // 버튼 2: 인덱스 초기화
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
    private async createResultCard(result: MainDataBaseSearchResult): Promise<void> {
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

        // 키 정보 (첫 번째 공백 전까지)
        const keyParts = result.metadata.key.split('/').slice(1).join('/') || result.metadata.key;
        const displayKey = keyParts.split('of')[0].trim(); // 공백으로 자르고 첫 번째 부분만
        
        metaEl.createEl("span", { 
            text: displayKey,
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

        // 블록 내용 미리보기 (Markdown 렌더링)
        if (result.block && result.block.text) {
            const previewEl = card.createEl("div", { cls: "result-preview" });
            
            // 텍스트 정리 및 길이 제한
            let previewText = this.preparePreviewText(result.block.text);
            
            try {
                // Markdown 렌더링
                await MarkdownRenderer.render(
                    this.app,
                    previewText,
                    previewEl,
                    result.metadata.filePath, // 소스 경로 (링크 해석용)
                    this
                );
                
                // 렌더링된 내용을 읽기 전용으로 설정
                previewEl.querySelectorAll('a').forEach(link => {
                    link.setAttribute('tabindex', '-1');
                });

                // 헤더 옆 링크 버튼 제거
                previewEl.querySelectorAll('.heading-collapse-indicator').forEach(el => el.remove());
                
            } catch (error) {
                // 렌더링 실패 시 일반 텍스트로 표시
                console.error('Markdown 렌더링 실패:', error);
                previewEl.setText(previewText);
            }
        }

        // 클릭 이벤트 등록: 파일 열기
        this.registerDomEvent(card, "click", async () => {
            await this.handleResultClick(result);
        });
    }

    /**
     * 미리보기 텍스트 정리
     */
    private preparePreviewText(text: string): string {
        const MAX_LENGTH = 200;
        
        // 이미지, 임베드, 복잡한 요소 제거
        let cleaned = text
            .replace(/!\[\[.*?\]\]/g, '')           // Obsidian 이미지
            .replace(/!\[.*?\]\(.*?\)/g, '')        // Markdown 이미지
            .replace(/```[\s\S]*?```/g, '[코드]')   // 코드 블록
            .replace(/^#{1,6}\s+.*$/gm, '')         // 헤더 제거 (### 제목 등)
            .replace(/\[\[.*?\|.*?\]\]/g, (match) => {
                // 내부 링크: [[파일|표시텍스트]] → 표시텍스트만
                const parts = match.slice(2, -2).split('|');
                return parts[1] || parts[0];
            })
            .replace(/\[\[.*?\]\]/g, (match) => {
                // 내부 링크: [[파일]] → 파일명만
                return match.slice(2, -2);
            })
            .trim();
        
        // 길이 제한 (단어 단위로 자르기)
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
            const heading = this.extractHeadingFromKey(result.metadata.key);
            
            if (!heading) {
                // 헤더 없으면 파일만 열기
                await this.app.workspace.openLinkText(
                    result.metadata.filePath,
                    "",
                    false,
                    { active: true }
                );
                return;
            }

            // 🔧 Obsidian 내장 API로 파일#헤더 형식 링크 열기
            const linkText = `${result.metadata.filePath}#${heading}`;
            
            console.log(`[SearchView] 링크로 이동: ${linkText}`);
            
            await this.app.workspace.openLinkText(
                linkText,
                "",           // sourcePath (현재 파일 경로, 빈 문자열 가능)
                false,        // newLeaf (false = 현재 탭에서 열기)
                { active: true }  // state
            );

            console.log(`[SearchView] ✅ 이동 완료`);

        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "알 수 없는 오류";
            console.error("[SearchView] 파일 열기 실패:", errorMsg);
            new Notice(`파일을 여는 중 오류: ${errorMsg}`);
        }
    }

    /**
     * metadata.key에서 헤더 텍스트 추출
     * 예: "vault/path/### 헤더 제목 of file.md" → "헤더 제목"
     */
    private extractHeadingFromKey(key: string): string | null {
        // 경로에서 마지막 부분만 추출
        const keyParts = key.split('/');
        const lastPart = keyParts[keyParts.length - 1];
        
        // " of " 앞부분만 추출
        const beforeOf = lastPart.split(' of ')[0];
        
        // ### 같은 헤더 마커 제거
        const cleaned = beforeOf.replace(/^#{1,6}\s+/, '').trim();
        
        return cleaned || null;
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
            // 인덱싱 전 상태 확인
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
            
            // DocumentService에 resetDatabase 메서드가 있다고 가정
            // 없다면 직접 database.initialize()를 호출
            if (typeof this.plugin.documentService.resetDatabase === 'function') {
                await this.plugin.documentService.resetDatabase();
            } else {
                // fallback: 직접 초기화
                this.plugin.documentService = null;
                await this.plugin['tryInitializeDocumentService'](true);
            }
            
            // 결과 화면 초기화
            this.showEmptyState("데이터베이스가 초기화되었습니다.");
            new Notice("✅ 데이터베이스 초기화 완료");
        } catch (error) {
            console.error("데이터베이스 초기화 실패:", error);
            const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";
            new Notice(`❌ 초기화 실패: ${errorMsg}`);
        }
    }
}