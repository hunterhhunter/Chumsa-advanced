import { MainDataBaseSearchResult } from "src/types/structures";
import { generateWikiLink } from "./link_generator";

/**
 * 드래그 이벤트 데이터 설정
 */
export function setupDragData(
    dataTransfer: DataTransfer,
    result: MainDataBaseSearchResult,
    includeScore: boolean = false
): string {
    const linkText = generateWikiLink(result, includeScore);
    
    // Obsidian이 인식하는 형식
    dataTransfer.setData('text/plain', linkText);
    dataTransfer.setData('text/obsidian', linkText);
    dataTransfer.effectAllowed = 'link';
    
    return linkText;
}

/**
 * 드래그 프리뷰 이미지 생성
 */
export function createDragPreview(result: MainDataBaseSearchResult): HTMLElement {
    const preview = document.createElement('div');
    preview.addClass('chumsa-drag-preview');
    
    preview.style.cssText = `
        position: absolute;
        top: -1000px;
        left: -1000px;
        padding: 10px 16px;
        background: var(--background-primary);
        border: 2px solid var(--interactive-accent);
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        opacity: 0.95;
        max-width: 320px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
    `;
    
    preview.textContent = `📄 ${result.metadata.fileName}`;
    
    document.body.appendChild(preview);
    setTimeout(() => preview.remove(), 100);
    
    return preview;
}