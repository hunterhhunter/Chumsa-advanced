import * as dotenv from 'dotenv';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, setIcon, Setting, TFile } from 'obsidian';
import { DocumentService } from './services/document_service';
import { SearchView, SEARCH_VIEW_TYPE } from './views/search_view';
import { ChumsaSettings, DEFAULT_SETTINGS } from './settings/settings';
import { ChumsaSettingTab } from './settings/settings-tab';

dotenv.config();

export default class MyPlugin extends Plugin {
	settings: ChumsaSettings;
	documentService: DocumentService | null = null;
	// 검색 레이스 컨디션 방지용 ID 관리 변수
	private searchRequestSeq = 0;

	async onload() {
		await this.loadSettings();
		
		// 기존 Obsidian 플러그인 코드들...
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			new Notice('This is a notice!');
		});
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// --------------------- SEARCH_VIEW 관련 로직 ---------------------
		// SEARCH_VIEW를 등록
		this.registerView(SEARCH_VIEW_TYPE, (leaf) => new SearchView(leaf));

		// SEARCH_VIEW를 열기 위한 리본아이콘 등록
		this.addRibbonIcon(
			"brain-circuit", "첨사: 검색 뷰 열기", () => this.activateSearchView()
		);

		this.registerMarkdownPostProcessor((element, context) => {
			// 랜더링된 요소 내에서 h3 헤딩 태그 찾기
			const headings = element.querySelectorAll("h3");
			
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
				iconEl.addEventListener('click', async (event) => {
					event.preventDefault();
                    event.stopPropagation();

					await this.handleHeadingSearch(headings, context);
				});
			})
		});

		// TODO: spliter 설정가능하게
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

	// DocumentService 초기화 메서드
	initializeDocumentService() {
		if (!this.settings.OPENAI_API_KEY) {
			new Notice('OpenAI API Key를 설정에서 입력해주세요.');
			return;
		}

		try {
			// TODO: indexFileName은 인덱스 초기화마다 바꿔줘야함.
			this.documentService = new DocumentService(this.app, this.settings.OPENAI_API_KEY, "indexFile");
			new Notice('DocumentService가 초기화되었습니다.');
		} catch (error) {
			new Notice(`DocumentService 초기화 실패: ${error.message}`);
		}
	}

	onunload() {
		// 정리 작업
		this.searchRequestSeq = 0;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
}