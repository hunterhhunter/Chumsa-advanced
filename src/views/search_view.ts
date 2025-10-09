import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { MainDataBaseSearchResult } from "src/types/structures";

export const SEARCH_VIEW_TYPE = "search-view";

export class SearchView extends ItemView {

    constructor(leaf: WorkspaceLeaf){
        super(leaf);
    }

    getViewType(): string {
        return SEARCH_VIEW_TYPE;
    }
    getDisplayText(): string {
        return "Connection Recommemdation"
    }
    
    async onOpen(): Promise<void> {
        this.containerEl.addClass('chumsa-side-view');

        const container = this.contentEl;
        container.empty();
        container.createEl("h2", { text: "관련 노트를 찾아보세요." });
    }

    async onClose(): Promise<void> {
        
    }


}