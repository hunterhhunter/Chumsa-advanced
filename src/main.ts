import * as dotenv from 'dotenv';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, setIcon, Setting, TFile } from 'obsidian';
import { DocumentService } from './services/document_service';
import { SearchView, SEARCH_VIEW_TYPE } from './views/search_view';
import { ChumsaSettings, DEFAULT_SETTINGS, getHeadingConfig, HeadingLevel } from './settings/settings';
import { ChumsaSettingTab } from './settings/settings_tab';

dotenv.config();

export default class MyPlugin extends Plugin {
	settings: ChumsaSettings;
	documentService: DocumentService | null = null;
	// 검색 레이스 컨디션 방지용 ID 관리 변수
	private searchRequestSeq = 0;

	async onload() {
		await this.loadSettings();
		
		await this.tryInitializeDocumentService();

		// 기존 Obsidian 플러그인 코드들...
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			new Notice('This is a notice!');
		});
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

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

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	/**
     * 헤딩 검색 핸들러 (분리된 메서드)
     */
    private async handleHeadingSearch(
        heading: Element,
        context: any
    ): Promise<void> {
        if (!this.documentService) {
            new Notice('먼저 DocumentService를 초기화해주세요.');
            return;
        }

        const searchView = await this.activateSearchView();
        if (!searchView) {
            new Notice('검색 뷰를 열 수 없습니다.');
            return;
        }

        const requestId = ++this.searchRequestSeq;
        searchView.showLoadingSafe(requestId);

        try {
            const sectionInfo = context.getSectionInfo(heading as HTMLElement);
            if (!sectionInfo) {
                searchView.showErrorSafe("헤딩 정보를 가져올 수 없습니다.", requestId);
                return;
            }

            const lines = sectionInfo.text.split('\n');
            const clickLineText = lines[sectionInfo.lineStart];

            if (!clickLineText) {
                searchView.showErrorSafe("헤딩 텍스트를 가져올 수 없습니다.", requestId);
                return;
            }

            const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
            const fileName = file ? file.name : context.sourcePath.split('/').pop()!;

            console.log(`검색 시작 - 파일: ${fileName}, 헤딩: ${clickLineText}`);

            const searchResults = await this.documentService.searchSimilarBlocks(
                fileName,
                clickLineText,
                this.settings.spliter
            );

            await searchView.setResults(searchResults, requestId);
            console.log(`검색 결과 ${searchResults.length}개 반환`);

        } catch (error) {
            console.error('검색 중 오류 발생:', error);
            const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";
            searchView.showErrorSafe(`검색 실패: ${errorMsg}`, requestId);
        }
    }

	onunload() {
		// 정리 작업
		this.searchRequestSeq = 0;
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
        const apiKey = this.settings.OPENAI_API_KEY?.trim();
        if (!apiKey) {
            new Notice('OpenAI API Key가 설정되어 있지 않습니다. 설정에서 입력하세요.');
            return;
        }
        if (this.documentService && !force) {
            // 이미 초기화됨
            return;
        }
        try {
            // 기존 인스턴스가 있으면 교체
            this.documentService = new DocumentService(this.app, apiKey, "indexFile");
            new Notice('DocumentService가 초기화되었습니다.');
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('DocumentService 초기화 실패:', error);
            new Notice(`DocumentService 초기화 실패: ${msg}`);
        }
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