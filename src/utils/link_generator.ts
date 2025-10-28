import { MainDataBaseSearchResult } from "src/types/structures";

/**
 * 검색 결과로부터 Obsidian 위키링크 생성
 */
export function generateWikiLink(
    result: MainDataBaseSearchResult,
    includeScore: boolean = false
): string {
    const fileName = cleanFileName(result.metadata.fileName);
    const heading = extractHeading(result.metadata.key);
    
    let linkText = heading 
        ? `[[${fileName}#${normalizeHeading(heading)}]]`
        : `[[${fileName}]]`;
    
    if (includeScore) {
        const scorePercentage = (result.score * 100).toFixed(1);
        linkText += ` <!-- 유사도: ${scorePercentage}% -->`;
    }
    
    return linkText;
}

/**
 * .md 확장자 제거
 */
function cleanFileName(fileName: string): string {
    return fileName.replace(/\.md$/i, '');
}

/**
 * metadata.key에서 헤더 텍스트 추출
 * 예: "vault/path/### 헤더 제목 of file.md" → "헤더 제목"
 */
function extractHeading(key: string): string | null {
    const keyParts = key.split('/');
    const lastPart = keyParts[keyParts.length - 1];
    const beforeOf = lastPart.split(' of ')[0];
    const cleaned = beforeOf.replace(/^#{1,6}\s+/, '').trim();
    
    return cleaned || null;
}

/**
 * 헤더 텍스트 정규화 (공백 처리)
 */
function normalizeHeading(heading: string): string {
    return heading.replace(/\s+/g, ' ').trim();
}