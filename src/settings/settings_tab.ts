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

        // API Key Settings
        containerEl.createEl('h2', { text: 'OpenAI API Settings' });

        new Setting(containerEl)
            .setName('OpenAI API Key')
            .setDesc('Enter OpenAI API Key for embedding generation')
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

        // Index Settings
        containerEl.createEl('h2', { text: 'Index Settings' });

        new Setting(containerEl)
            .setName('Index File Name')
            .setDesc('Name of the vector index file')
            .addText(text => text
                .setPlaceholder('indexFile')
                .setValue(this.plugin.settings.indexFileName)
                .onChange(async (value) => {
                    this.plugin.settings.indexFileName = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Heading Level')
            .setDesc('Select the heading level to split documents')
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

        // Auto Tag Settings
        containerEl.createEl('h2', { text: 'Auto Tag Settings' });

        new Setting(containerEl)
            .setName('Max Tags')
            .setDesc('Maximum number of tags LLM will generate')
            .addSlider(slider => slider
                .setLimits(3, 15, 1)
                .setValue(this.plugin.settings.autoTagMaxTags)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.autoTagMaxTags = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Tag Language')
            .setDesc('Language of generated tags')
            .addDropdown(dropdown => dropdown
                .addOption('ko', 'Korean')
                .addOption('en', 'English')
                .setValue(this.plugin.settings.autoTagLanguage)
                .onChange(async (value) => {
                    this.plugin.settings.autoTagLanguage = value;
                    await this.plugin.saveSettings();
                }));

        // Test Button
        containerEl.createEl('h2', { text: 'Test' });

        new Setting(containerEl)
            .setName('Test Auto Tag on Current File')
            .setDesc('Generate auto tags for the currently open file')
            .addButton(button => button
                .setButtonText('Test')
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