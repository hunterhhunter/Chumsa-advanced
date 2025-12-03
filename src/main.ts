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
		console.log('[Main] ===== 플러그인 로드 시작 =====');
    
        await this.loadSettings();
        console.log('[Main] ✅ 설정 로드 완료');
        console.log(`[Main] API 키 존재: ${!!this.settings.OPENAI_API_KEY}`);
        console.log(`[Main] API 키 길이: ${this.settings.OPENAI_API_KEY?.length || 0}`);
        
        await this.tryInitializeDocumentService();
        console.log(`[Main] DocumentService 초기화: ${!!this.documentService}`);
        
        this.initializeSearchFilter();
        console.log(`[Main] SearchFilter 초기화: ${!!this.searchFilter}`);

            // 🔧 AI 채팅 뷰 등록
        this.registerView(
            AI_CHAT_VIEW_TYPE,
            (leaf) => new AIChatView(leaf, this)
        );

        this.addRibbonIcon('message-circle', 'AI 채팅 열기', async () => {
            await this.activateAIChatView();
        });

        // 🔧 AI 채팅 토글 명령어
        this.addCommand({
            id: "toggle-ai-chat-view",
            name: "AI 채팅 열기/닫기",
            callback: () => this.toggleAIChatView()
        });

		// --------------------- SEARCH_VIEW 관련 로직 ---------------------
		// SEARCH_VIEW를 등록
		this.registerView(SEARCH_VIEW_TYPE, (leaf) => new SearchView(leaf, this));

		// SEARCH_VIEW를 열기 위한 리본아이콘 등록
		this.addRibbonIcon(
			"brain-circuit", "첨사: 검색 뷰 열기", () => this.activateSearchView()
		);

		this.registerMarkdownPostProcessor((element, context) => {
			// 설정 내 spliter 레벨 가져오기
			const cfg = getHeadingConfig(this.settings.headingLevel);

			// 랜더링된 요소 내에서 spliter 태그 찾기
			const headings = element.querySelectorAll(cfg.tag);
			
			headings.forEach(headings => {
				if (headings.querySelector(".search-icon")) {
					return;
				}

				const iconEl = headings.createEl('span', {
					cls: 'search-icon',				   // css 스타일링을 위한 클래스
					attr: {
						'aria-label': "관련 자료 검색", // 마우스 호버링시 나올 툴팁
						
					}
				});

				setIcon(iconEl, 'link');

				// 아이콘 클릭시 실행할 이벤트 등록
				this.registerDomEvent(iconEl, 'click', async (event: MouseEvent) => {
                    event.preventDefault();
                    event.stopPropagation();
                    await this.handleHeadingSearch(headings, context);
                });
			})
		});

		this.addSettingTab(new ChumsaSettingTab(this.app, this));
	}

    /**
     * 🆕 AI 채팅 뷰 활성화 (항상 열림)
     */
    private async activateAIChatView() {
        const { workspace } = this.app;
        
        let leaf = workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)[0];
        
        if (!leaf) {
            // 오른쪽 사이드바에 새 리프 생성
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: AI_CHAT_VIEW_TYPE,
                    active: true,
                });
                leaf = rightLeaf;
            }
        }
        
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    /**
     * AI 채팅 뷰 토글
     */
    private async toggleAIChatView() {
        const { workspace } = this.app;
        
        let leaf = workspace.getLeavesOfType(AI_CHAT_VIEW_TYPE)[0];
        
        if (leaf) {
            workspace.revealLeaf(leaf);
        } else {
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: AI_CHAT_VIEW_TYPE,
                    active: true,
                });
                workspace.revealLeaf(rightLeaf);
            }
        }
    }

	private async handleHeadingSearch(
        heading: Element,
        context: any
    ): Promise<void> {
        const headingText = heading.textContent || "";
        const fileName = context.sourcePath?.split('/').pop()?.replace('.md', '') || 'unknown';

        console.log('[Main] ===== 헤딩 검색 시작 =====');
        console.log(`[Main] 원본 헤딩 텍스트: "${headingText}"`);
        console.log(`[Main] 파일명: "${fileName}"`);
        console.log(`[Main] 전체 경로: "${context.sourcePath}"`);

        // 🔧 입력 검증 강화
        if (!headingText || headingText.trim().length === 0) {
            console.error('[Main] 검색 실패: 빈 헤딩');
            new Notice('검색할 헤딩 텍스트가 없습니다.');
            return;
        }

        if (!fileName || fileName === 'unknown') {
            console.error('[Main] 검색 실패: 파일명 추출 실패');
            console.error('[Main] context.sourcePath:', context.sourcePath);
            new Notice('파일명을 확인할 수 없습니다.');
            return;
        }

        if (!this.documentService) {
            console.error('[Main] 검색 실패: DocumentService 초기화 안됨');
            new Notice('먼저 설정에서 OpenAI API Key를 입력하세요.');
            return;
        }

        // SearchView 열기
        const searchView = await this.activateSearchView();
        if (!searchView) {
            console.error('[Main] SearchView 활성화 실패');
            new Notice('검색 뷰를 열 수 없습니다.');
            return;
        }

        const requestId = ++this.searchRequestSeq;
        searchView.showLoadingSafe(requestId);

        try {
            console.log('[Main] DocumentService.searchSimilarBlocks 호출...');
            
            const results = await this.documentService.searchSimilarBlocks(
                fileName,
                headingText,
                this.settings.spliter,
                50
            );

            console.log(`[Main] ✅ 검색 성공: ${results.length}개 결과`);

            // 품질 필터링
            const filteredResults = this.searchFilter?.filterResults(results, [], context.sourcePath) || results;
            console.log(`[Main] 필터링 후 결과: ${filteredResults.length}개`);

            // SearchView에 결과 전달
            await searchView.setResults(filteredResults, requestId);

        } catch (error) {
            console.error('[Main] ===== 검색 실패 =====');
            console.error('[Main] 에러 상세:', error);
            
            // 🔧 에러 타입별 메시지
            let errorMessage = '검색 중 오류가 발생했습니다.';
            
            if (error instanceof Error) {
                console.error('[Main] 에러 메시지:', error.message);
                console.error('[Main] 에러 스택:', error.stack);

                if (error.message.includes('빈 텍스트')) {
                    errorMessage = '검색 텍스트가 비어있습니다. 헤딩을 확인하세요.';
                } else if (error.message.includes('임베딩')) {
                    errorMessage = '임베딩 생성 실패. API 키를 확인하세요.';
                } else if (error.message.includes('네트워크') || error.message.includes('API')) {
                    errorMessage = '네트워크 오류. 인터넷 연결을 확인하세요.';
                } else if (error.message.includes('인덱스')) {
                    errorMessage = '인덱스 오류. 파일을 다시 인덱싱하세요.';
                }
            }

            searchView.showErrorSafe(errorMessage, requestId);
            new Notice(`❌ ${errorMessage}`);
        }
    }

	onunload() {
		// 정리 작업
		this.searchRequestSeq = 0;
        // 🔧 AI 채팅 뷰 정리
        this.app.workspace.detachLeavesOfType(AI_CHAT_VIEW_TYPE);
	}

	async loadSettings() {
    const raw = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);

		// 마이그레이션: headingLevel 없고 spliter만 있을 때 유추
		if (!this.settings.headingLevel) {
			const m = (this.settings.spliter || "### ").trim();
			const map: Record<string, 'h1'|'h2'|'h3'|'h4'|'h5'|'h6'> = {
				'#': 'h1','##': 'h2','###': 'h3','####': 'h4','#####': 'h5','######': 'h6'
			};
			this.settings.headingLevel = map[m.replace(/\s+$/, '')] ?? 'h3';
			// 동기화
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
        console.log('[Main] tryInitializeDocumentService 시작');
        console.log(`[Main] force: ${force}, 기존 서비스: ${!!this.documentService}`);

        if (!this.settings.OPENAI_API_KEY) {
            console.warn('[Main] API 키 없음, DocumentService 초기화 건너뜀');
            new Notice('OpenAI API 키를 설정에서 입력해주세요.');
            return;
        }

        if (this.documentService && !force) {
            console.log('[Main] DocumentService 이미 초기화됨, 건너뜀');
            return;
        }

        try {
            console.log('[Main] DocumentService 생성 중...');
            
            this.documentService = new DocumentService(
                this.app,
                this.settings.OPENAI_API_KEY,
                this.settings.indexFileName
            );

            console.log('[Main] ✅ DocumentService 초기화 완료');

        } catch (error) {
            console.error('[Main] DocumentService 초기화 실패:', error);
            new Notice(`서비스 초기화 실패: ${(error as Error).message}`);
            this.documentService = null;
        }
    }

    /**
     * SearchFilter 초기화
     */
    private initializeSearchFilter(): void {
        this.searchFilter = new SearchFilter(this.app);
        console.log('SearchFilter 초기화 완료');
    }

    public async handleHeadingLevelChange(level: HeadingLevel): Promise<void> {
    const cfg = getHeadingConfig(level);
    try {
        // 1) DocumentService 재초기화
        await this.tryInitializeDocumentService(true);

        if (!this.documentService) {
            new Notice("DocumentService 초기화 실패로 재인덱싱을 건너뜁니다.");
            return;
        }

        // 2) DB 초기화(+ 선택) 후 전체 재인덱싱
        await this.documentService.resetDatabase();
        const files = this.app.vault.getMarkdownFiles();
        if (files.length > 0) {
            new Notice(`전체 재인덱싱 시작 (${files.length}개)…`);
            await this.documentService.saveVault(files, 10, cfg.splitter);
            new Notice("전체 재인덱싱 완료");
        }

        // 3) 모든 Markdown 뷰 재렌더링
        await this.rerenderAllMarkdownViews();

        } catch (e) {
            console.error("헤딩 레벨 변경 처리 중 오류:", e);
            new Notice("헤딩 레벨 변경 처리 실패. 콘솔 로그를 확인하세요.");
        }
    }

    /**
     * 마크다운 문서 껐다 켜서 강제 재랜더링
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

