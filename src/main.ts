import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { HNSWTestSuite } from '../src/tests/HNSWTestSuite'; // 테스트 스위트만 import
import { MetadataStoreTestSuite } from './tests/metadataStoreTestSuite';

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	
	// 🎯 테스트 스위트만 있으면 됨!
	private testSuite: HNSWTestSuite;
	private testSuite2: MetadataStoreTestSuite;

	async onload() {
		await this.loadSettings();
		
		// 🆕 테스트 스위트 초기화
		this.testSuite = new HNSWTestSuite(this.app);
		this.testSuite2 = new MetadataStoreTestSuite(this.app);

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
		
		// 🧪 테스트 실행 명령어들
		this.addCommand({
			id: 'run-hnsw-test-suite',
			name: 'Run HNSW Test Suite (All)',
			callback: async () => {
				console.clear();
				await this.testSuite.runAllTests();
				await this.testSuite2.runAllTests();
			}
		});

		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});

		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						new SampleModal(this.app).open();
					}
					return true;
				}
			}
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
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
    
    getTestSuite(): HNSWTestSuite {
        return this.testSuite;
    }

	getTestSuite2(): MetadataStoreTestSuite {
        return this.testSuite2;
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

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		// 🧪 깔끔한 테스트 버튼들
		new Setting(containerEl)
			.setName('🧪 전체 테스트')
			.setDesc('모든 HNSW 기능을 체계적으로 테스트합니다')
			.addButton(button => button
				.setButtonText('전체 테스트 실행')
				.setCta()
				.onClick(async () => {
					button.setButtonText('실행 중...');
					button.setDisabled(true);
					
					try {
						console.clear();
						await this.plugin.getTestSuite().runAllTests();
						new Notice('전체 테스트 완료! 콘솔 확인');
					} catch (error) {
						console.error('테스트 실행 중 오류:', error);
						new Notice(`테스트 실패: ${error.message}`);
					} finally {
						button.setButtonText('전체 테스트 실행');
						button.setDisabled(false);
					}
				}));

		new Setting(containerEl)
			.setName('🧪 전체 테스트')
			.setDesc('모든 MetaDataStore 기능을 체계적으로 테스트합니다')
			.addButton(button => button
				.setButtonText('전체 테스트 실행')
				.setCta()
				.onClick(async () => {
					button.setButtonText('실행 중...');
					button.setDisabled(true);
					
					try {
						console.clear();
						await this.plugin.getTestSuite2().runAllTests();
						new Notice('전체 테스트 완료! 콘솔 확인');
					} catch (error) {
						console.error('테스트 실행 중 오류:', error);
						new Notice(`테스트 실패: ${error.message}`);
					} finally {
						button.setButtonText('전체 테스트 실행');
						button.setDisabled(false);
					}
				}));

		new Setting(containerEl)
			.setName('개발자 도구')
			.setDesc('테스트 결과를 보려면 개발자 도구를 여세요')
			.addButton(button => button
				.setButtonText('Ctrl+Shift+I')
				.onClick(() => {
					const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
					const shortcut = isMac ? 'Cmd+Option+I' : 'Ctrl+Shift+I';
					new Notice(`개발자 도구: ${shortcut}`);
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