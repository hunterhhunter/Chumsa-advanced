import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ChumsaPlugin from "../main";

export class ChumsaSettingTab extends PluginSettingTab {
    plugin: ChumsaPlugin;

    constructor(app: App, plugin: ChumsaPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Chumsa 설정" });

        // ===== OpenAI API Key =====
        new Setting(containerEl)
            .setName("OpenAI API Key")
            .setDesc("OpenAI API Key를 입력하세요. 입력 후 '초기화' 버튼을 눌러주세요.")
            .addText(text => text
                .setPlaceholder("sk-proj-...")
                .setValue(this.plugin.settings.OPENAI_API_KEY)
                .onChange(async (value) => {
                    this.plugin.settings.OPENAI_API_KEY = value;
                    await this.plugin.saveSettings();
                }));

        // ===== DocumentService 초기화 =====
        new Setting(containerEl)
            .setName("DocumentService 초기화")
            .setDesc("API Key 입력 후 이 버튼을 눌러 DocumentService를 초기화하세요.")
            .addButton(button => button
                .setButtonText("초기화")
                .setCta()
                .onClick(() => {
                    this.plugin.initializeDocumentService();
                }));

        // ===== 구분자 설정 =====
        new Setting(containerEl)
            .setName("헤딩 구분자")
            .setDesc("마크다운 파싱 시 사용할 헤딩 구분자 (기본값: '### ')")
            .addText(text => text
                .setPlaceholder("### ")
                .setValue(this.plugin.settings.spliter)
                .onChange(async (value) => {
                    this.plugin.settings.spliter = value;
                    await this.plugin.saveSettings();
                }));

        // ===== 테스트 섹션 =====
        containerEl.createEl("h3", { text: "테스트" });

        // 단일 문서 인덱싱
        new Setting(containerEl)
            .setName("📄 단일 문서 인덱싱")
            .setDesc("첫 번째 마크다운 파일을 임베딩하여 DB에 저장합니다.")
            .addButton(button => button
                .setButtonText("실행")
                .onClick(async () => {
                    await this.runIndexingTest(button, "single");
                }));

        // 전체 문서 인덱싱
        new Setting(containerEl)
            .setName("📚 전체 문서 인덱싱")
            .setDesc("모든 마크다운 파일을 임베딩하여 DB에 저장합니다.")
            .addButton(button => button
                .setButtonText("실행")
                .onClick(async () => {
                    await this.runIndexingTest(button, "all");
                }));

        // 유사도 검색 테스트
        new Setting(containerEl)
            .setName("🔍 유사도 검색")
            .setDesc("첫 번째 파일의 첫 헤딩으로 유사도 검색을 테스트합니다.")
            .addButton(button => button
                .setButtonText("실행")
                .onClick(async () => {
                    await this.runSearchTest(button);
                }));
    }

    /**
     * 인덱싱 테스트 실행 (공통 로직)
     */
    private async runIndexingTest(
        button: any, 
        mode: "single" | "all"
    ): Promise<void> {
        if (!this.plugin.documentService) {
            new Notice("먼저 DocumentService를 초기화해주세요.");
            return;
        }

        const originalText = button.buttonEl.textContent;
        button.setButtonText("실행 중...");
        button.setDisabled(true);

        try {
            const files = this.app.vault.getMarkdownFiles();
            if (files.length === 0) {
                new Notice("마크다운 파일이 없습니다.");
                return;
            }

            if (mode === "single") {
                await this.plugin.documentService.saveOneDocument(files[0].path);
                new Notice(`✅ 인덱싱 완료: ${files[0].name}`);
            } else {
                await this.plugin.documentService.saveVault(files);
                new Notice(`✅ 전체 인덱싱 완료: ${files.length}개 파일`);
            }
        } catch (error) {
            console.error("인덱싱 오류:", error);
            const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";
            new Notice(`❌ 인덱싱 실패: ${errorMsg}`);
        } finally {
            button.setButtonText(originalText);
            button.setDisabled(false);
        }
    }

    /**
     * 유사도 검색 테스트
     */
    private async runSearchTest(button: any): Promise<void> {
        if (!this.plugin.documentService) {
            new Notice("먼저 DocumentService를 초기화해주세요.");
            return;
        }

        const originalText = button.buttonEl.textContent;
        button.setButtonText("실행 중...");
        button.setDisabled(true);

        try {
            const files = this.app.vault.getMarkdownFiles();
            if (files.length === 0) {
                new Notice("마크다운 파일이 없습니다.");
                return;
            }

            const testFileName = files[0].name;
            const testHeading = "### PromptArmor: Simple yet Effective Prompt Injection Defenses";
            
            console.log(`검색 테스트: ${testFileName}, 헤딩: ${testHeading}`);
            
            const results = await this.plugin.documentService.searchSimilarBlocks(
                testFileName,
                testHeading,
                this.plugin.settings.spliter
            );

            console.log(`검색 결과 ${results.length}개:`, results);
            new Notice(`✅ 검색 완료: ${results.length}개 결과`);
        } catch (error) {
            console.error("검색 오류:", error);
            const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";
            new Notice(`❌ 검색 실패: ${errorMsg}`);
        } finally {
            button.setButtonText(originalText);
            button.setDisabled(false);
        }
    }
}