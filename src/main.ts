import * as dotenv from 'dotenv';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, setIcon, Setting, TFile } from 'obsidian';
import { DocumentService } from './services/document_service';
import { SearchView, SEARCH_VIEW_TYPE } from './views/search_view';
dotenv.config();


interface MyPluginSettings {
	mySetting: string;
	OPENAI_API_KEY: string;
	spliter: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	OPENAI_API_KEY: "",
	spliter: "### ",
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	documentService: DocumentService | null = null;

	async onload() {
		await this.loadSettings();
		
		// 기존 Obsidian 플러그인 코드들...
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			new Notice('This is a notice!');
		});
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

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
					this.activateSearchView();
					// 정확한 키 생성을 위한 작업
					const clickLineIndex = context.getSectionInfo(headings as HTMLElement)!.lineStart;
					const clickLineText = context.getSectionInfo(headings as HTMLElement)?.text.split('\n')[clickLineIndex];
					if (!clickLineText) return;

					console.log(`---------------${context.getSectionInfo(headings as HTMLElement)?.lineStart}`);

					const sourcePath = context.sourcePath;
					const file = this.app.vault.getAbstractFileByPath(sourcePath);

					let fileName = ""
					if (!file) {
						fileName = sourcePath.split('\n').pop()!;
					} else {
						fileName = file.name;
					}

					// 1009: 현재 유사도 검색한 결고 콘솔에 띄우기까지 완료
					const ad = await this.documentService?.searchSimilarBlocks(fileName, clickLineText, this.settings.spliter)!;
					for (const each of ad) {
						console.log(`ID: ${each.id}, Score: ${each.score}, Text: ${each.block.text}`)
					}
				});
			})
		});

		// TODO: 세팅 탭 다른 파일로 분리 + spliter 설정가능하게
		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
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
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// search view를 여는 함수
	async activateSearchView() {
		// 이미 동일한 타입의 뷰가 열려있으면 그거 사용
		const existingLeaves = this.app.workspace.getLeavesOfType(SEARCH_VIEW_TYPE);
		if (existingLeaves.length > 0) {
			this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}

		// 오른쪽에 새로운 뷰 열기
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: SEARCH_VIEW_TYPE,
				active: true
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}
}

// =================== 설정창 (간단해진 버전) ===================
class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// OpenAI API Key 설정
		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('OpenAI API Key를 입력하세요. 입력 후 "초기화" 버튼을 눌러주세요.')
			.addText(text => text
				.setPlaceholder('sk-proj-...')
				.setValue(this.plugin.settings.OPENAI_API_KEY)
				.onChange(async (value) => {
					this.plugin.settings.OPENAI_API_KEY = value;
					await this.plugin.saveSettings();
				}));

		// DocumentService 초기화 버튼
		new Setting(containerEl)
			.setName('DocumentService 초기화')
			.setDesc('API Key 입력 후 이 버튼을 눌러 DocumentService를 초기화하세요.')
			.addButton(button => button
				.setButtonText('초기화')
				.setCta()
				.onClick(() => {
					this.plugin.initializeDocumentService();
				}));

		// 문서 인덱싱 테스트 버튼
		new Setting(containerEl)
			.setName('📄 문서 인덱싱 테스트')
			.setDesc('하나의 마크다운 파일을 임베딩하여 DB에 저장합니다.')
			.addButton(button => button
				.setButtonText('테스트 실행')
				.onClick(async () => {
					if (!this.plugin.documentService) {
						new Notice('먼저 DocumentService를 초기화해주세요.');
						return;
					}

					button.setButtonText('실행 중...');
					button.setDisabled(true);

					try {
						const files = this.app.vault.getMarkdownFiles();
						if (files.length === 0) {
							new Notice('마크다운 파일이 없습니다.');
							return;
						}

						await this.plugin.documentService.saveOneDocument(files[0].path);
						new Notice(`파일 인덱싱 완료: ${files[0].name}`);
					} catch (error) {
						console.error('인덱싱 중 오류:', error);
						new Notice(`인덱싱 실패: ${error.message}`);
					} finally {
						button.setButtonText('테스트 실행');
						button.setDisabled(false);
					}
				}));

		// 모든 문서 인덱싱 테스트 버튼
		new Setting(containerEl)
			.setName('📄 모든 문서 인덱싱 테스트')
			.setDesc('모든 마크다운 파일을 임베딩하여 DB에 저장합니다.')
			.addButton(button => button
				.setButtonText('테스트 실행')
				.onClick(async () => {
					if (!this.plugin.documentService) {
						new Notice('먼저 DocumentService를 초기화해주세요.');
						return;
					}

					button.setButtonText('실행 중...');
					button.setDisabled(true);

					try {
						const files = this.app.vault.getMarkdownFiles();
						if (files.length === 0) {
							new Notice('마크다운 파일이 없습니다.');
							return;
						}

						await this.plugin.documentService.saveVault(files);
						new Notice(`파일 인덱싱 완료: ${files[0].name}`);
					} catch (error) {
						console.error('인덱싱 중 오류:', error);
						new Notice(`인덱싱 실패: ${error.message}`);
					} finally {
						button.setButtonText('테스트 실행');
						button.setDisabled(false);
					}
				}));


		// 문서 검색 테스트 버튼
		new Setting(containerEl)
			.setName('📄 문서 검색 테스트')
			.setDesc('관련문서 검색 되는지 테스팅')
			.addButton(button => button
				.setButtonText('테스트 실행')
				.onClick(async () => {
					if (!this.plugin.documentService) {
						new Notice('먼저 DocumentService를 초기화해주세요.');
						return;
					}

					button.setButtonText('실행 중...');
					button.setDisabled(true);

					try {
						const files = this.app.vault.getMarkdownFiles();
						if (files.length === 0) {
							new Notice('마크다운 파일이 없습니다.');
							return;
						}

						console.log(`${files[0].name}`)
						await this.plugin.documentService.searchSimilarBlocks(files[0].name, "### PromptArmor: Simple yet Effective Prompt Injection Defenses", "### ");
						new Notice(`검색 완료: ${files[1].name}`);
					} catch (error) {
						console.error('인덱싱 중 오류:', error);
						new Notice(`인덱싱 실패: ${error.message}`);
					} finally {
						button.setButtonText('테스트 실행');
						button.setDisabled(false);
					}
				}));
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}