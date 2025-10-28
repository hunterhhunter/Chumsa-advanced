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
    
    // 🔧 Obsidian이 인식하는 올바른 형식
    dataTransfer.setData('text/plain', linkText);
    
    // 🔧 effectAllowed 설정
    dataTransfer.effectAllowed = 'copyLink';
    
    console.log(`[Drag] 링크 생성: ${linkText}`);
    
    return linkText;
}

/**
 * 드래그 프리뷰 생성
 */
export function createDragPreview(result: MainDataBaseSearchResult): HTMLElement {
    const preview = document.createElement('div');
    preview.addClass('chumsa-drag-preview');
    
    preview.style.cssText = `
        position: absolute;
        top: -1000px;
        left: -1000px;
        padding: 8px 14px;
        background: var(--background-primary);
        border: 1px solid var(--interactive-accent);
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        opacity: 0.9;
        max-width: 300px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        pointer-events: none;
        z-index: 9999;
    `;
    
    const fileName = result.metadata.fileName.replace(/\.md$/i, '');
    preview.textContent = `🔗 ${fileName}`;
    
    document.body.appendChild(preview);
    
    // 5초 후 제거
    setTimeout(() => preview.remove(), 5000);
    
    return preview;
}