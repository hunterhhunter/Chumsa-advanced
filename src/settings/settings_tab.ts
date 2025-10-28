import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "src/main";
import { HEADING_CONFIGS, HeadingLevel } from "./settings";

export class ChumsaSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // API 키 설정
        containerEl.createEl('h2', { text: 'OpenAI API 설정' });

        new Setting(containerEl)
            .setName('OpenAI API 키')
            .setDesc('임베딩 생성을 위한 OpenAI API 키를 입력하세요')
            .addText(text => text
                .setPlaceholder('sk-proj-...')
                .setValue(this.plugin.settings.OPENAI_API_KEY)
                .onChange(async (value) => {
                    this.plugin.settings.OPENAI_API_KEY = value;
                    await this.plugin.saveSettings();
                    
                    // DocumentService 재초기화
                    if (this.plugin.documentService) {
                        this.plugin.documentService.updateApiKey(value);
                    }
                }));

        // 색인 설정
        containerEl.createEl('h2', { text: '색인 설정' });

        new Setting(containerEl)
            .setName('색인 파일 이름')
            .setDesc('벡터 인덱스 파일의 이름')
            .addText(text => text
                .setPlaceholder('indexFile')
                .setValue(this.plugin.settings.indexFileName)
                .onChange(async (value) => {
                    this.plugin.settings.indexFileName = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('헤딩 레벨')
            .setDesc('문서를 분할할 헤딩 레벨을 선택하세요')
            .addDropdown(dropdown => {
                Object.entries(HEADING_CONFIGS).forEach(([level, config]) => {
                    dropdown.addOption(level, config.label);
                });
                
                dropdown
                    .setValue(this.plugin.settings.headingLevel)
                    .onChange(async (value: HeadingLevel) => {
                        this.plugin.settings.headingLevel = value;
                        this.plugin.settings.spliter = HEADING_CONFIGS[value].splitter;
                        await this.plugin.saveSettings();
                        
                        // 헤딩 레벨 변경 처리
                        await this.plugin.handleHeadingLevelChange(value);
                    });
            });

        // 자동 태그 설정
        containerEl.createEl('h2', { text: '자동 태그 설정' });

        new Setting(containerEl)
            .setName('최대 태그 개수')
            .setDesc('LLM이 생성할 최대 태그 개수')
            .addSlider(slider => slider
                .setLimits(3, 15, 1)
                .setValue(this.plugin.settings.autoTagMaxTags)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.autoTagMaxTags = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('태그 언어')
            .setDesc('생성할 태그의 언어')
            .addDropdown(dropdown => dropdown
                .addOption('ko', '한국어')
                .addOption('en', 'English')
                .setValue(this.plugin.settings.autoTagLanguage)
                .onChange(async (value) => {
                    this.plugin.settings.autoTagLanguage = value;
                    await this.plugin.saveSettings();
                }));

        // 테스트 버튼
        containerEl.createEl('h2', { text: '테스트' });

        new Setting(containerEl)
            .setName('현재 파일 자동 태그 테스트')
            .setDesc('현재 열린 파일에 대해 자동 태그를 생성합니다')
            .addButton(button => button
                .setButtonText('테스트')
                .onClick(async () => {
                    const activeFile = this.app.workspace.getActiveFile();
                    if (!activeFile) {
                        return;
                    }

                    if (!this.plugin.documentService) {
                        return;
                    }

                    try {
                        const result = await this.plugin.documentService.generateAndApplyAutoTags(
                            activeFile.path,
                            {
                                maxTags: this.plugin.settings.autoTagMaxTags,
                                language: this.plugin.settings.autoTagLanguage
                            }
                        );

                        console.log('자동 태그 테스트 결과:', result);
                    } catch (error) {
                        console.error('자동 태그 테스트 실패:', error);
                    }
                }));
    }
}