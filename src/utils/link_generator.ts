import { MainDataBaseSearchResult } from "src/types/structures";

/**
 * 검색 결과로부터 Obsidian 위키링크 생성
 */
export function generateWikiLink(
    result: MainDataBaseSearchResult,
    includeScore: boolean = false
): string {
    const fileName = cleanFileName(result.metadata.fileName);
    const heading = extractHeadingFromKey(result.metadata.key);
    
    let linkText: string;
    
    if (heading) {
        // 🔧 헤딩 정규화 적용
        const normalizedHeading = normalizeHeading(heading);
        linkText = `[[${fileName}#${normalizedHeading}]]`;
    } else {
        linkText = `[[${fileName}]]`;
    }
    
    if (includeScore) {
        const scorePercentage = (result.score * 100).toFixed(1);
        linkText += ` <!-- 유사도: ${scorePercentage}% -->`;
    }
    
    return linkText;
}

/**
 * .md 확장자 제거
 */
export function cleanFileName(fileName: string): string {
    return fileName.replace(/\.md$/i, '');
}

/**
 * metadata.key에서 헤더 텍스트 추출
 * 예: "vault/path/### 헤더 제목 of file.md" → "헤더 제목"
 */
export function extractHeadingFromKey(key: string): string | null {
    // 마지막 '/' 이후 부분 추출
    const keyParts = key.split('/');
    const lastPart = keyParts[keyParts.length - 1];
    
    // ' of ' 앞부분 추출
    const beforeOf = lastPart.split(' of ')[0];
    
    // 헤딩 마크다운 제거 (###, ##, # 등)
    const cleaned = beforeOf.replace(/^#{1,6}\s+/, '').trim();
    
    return cleaned || null;
}

/**
 * 헤더 텍스트 정규화 (공백 처리)
 */
function normalizeHeading(heading: string): string {
    return heading.replace(/\s+/g, ' ').trim();
}