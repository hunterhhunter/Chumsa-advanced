import { MdBlocks } from "../types/structures"
import { hashString } from "./hash_func";

/**
 * 마크다운 문서를 헤딩 레벨을 기준으로 블록 단위로 분할하는 함수
 *
 * @param filePath - 마크다운 파일의 전체 경로
 * @param fileName - 마크다운 파일 이름
 * @param markdown - 파싱할 마크다운 문자열 전체 내용
 * @param spliter - 분할 기준이 되는 헤딩 레벨 (예: "###", "##", "#")
 *
 * @returns MdBlocks 객체 - 파일 정보와 블록 배열을 포함
 *   - filePath: 파일 경로
 *   - fileName: 파일 이름
 *   - blocks: 분할된 블록 배열
 *     - id: 블록 키의 해시값 (MurmurHash3)
 *     - key: 블록 식별자 (헤딩 텍스트_파일명 형식)
 *     - text: 블록의 실제 마크다운 내용
 *
 * @description
 * 동작 방식:
 * 1. 모든 헤딩을 고유 분할자로 변환 (충돌 방지)
 * 2. 지정된 헤딩 레벨을 기준으로 분할 지점 수집
 * 3. 블록 분할 수행:
 *    - 분할자가 없으면: 전체 문서를 하나의 블록으로 처리 (key: `full_document_${fileName}`)
 *    - 분할자가 있으면:
 *      - 첫 번째 분할자 이전 내용은 prologue 블록으로 처리 (key: `prologue_of_${fileName}`)
 *      - 각 헤딩부터 다음 헤딩 전까지를 하나의 블록으로 처리 (key: `${헤딩텍스트}_${fileName}`)
 * 4. 각 블록의 키는 MurmurHash3로 해싱되어 고유 ID 생성
 *
 * @example
 * ```typescript
 * const markdown = `
 * # 제목
 * 본문 내용
 * ### 섹션 1
 * 섹션 1 내용
 * ### 섹션 2
 * 섹션 2 내용
 * `;
 *
 * const result = parseMarkdownByHeadings(
 *   "/path/to/file.md",
 *   "file.md",
 *   markdown,
 *   "###"
 * );
 *
 * // result.blocks = [
 * //   { id: hash("prologue_of_file.md"), key: "prologue_of_file.md", text: "# 제목\n본문 내용" },
 * //   { id: hash("섹션 1_file.md"), key: "섹션 1_file.md", text: "### 섹션 1\n섹션 1 내용" },
 * //   { id: hash("섹션 2_file.md"), key: "섹션 2_file.md", text: "### 섹션 2\n섹션 2 내용" }
 * // ]
 * ```
 */
export function parseMarkdownByHeadings (filePath: string, fileName: string, markdown: string, spliter: string) {
    // 헤더를 분할을 위한 고유 분할자로 변경
    const headingMap: Record<string, string> = {
        "######": "__MARKDOWN_HEADING_6__",
        "#####": "__MARKDOWN_HEADING_5__",
        "####": "__MARKDOWN_HEADING_4__",
        "###": "__MARKDOWN_HEADING_3__",
        "##": "__MARKDOWN_HEADING_2__",
        "#": "__MARKDOWN_HEADING_1__",
    }

    // 분할자 대체를 위한 문자열 선언
    let replacedMarkdown = markdown;

    // --- 1. 모든 헤더를 고유 분할자로 변경 ---
    const sortedHeadings = Object.keys(headingMap).sort((a, b) => b.length - a.length) // 고유 분할자 맵을 튜플화 및 내림차순 정렬 
    // 튜플 순회하며 헤더를 고유 분할자로 대체
    for (const search of sortedHeadings) {
        const regex = new RegExp(`^${search}`, 'gm');
        replacedMarkdown = replacedMarkdown.replace(regex, `${headingMap[search]} `);
    }

    // 줄넘김 문자를 기준으로 분할 및 반환값 및 문서 분할을 위한 변수 선언
    const splitedLines = replacedMarkdown.split('\n');
    const originalLines = markdown.split('\n');         // 실제 블록 내용 생성에 사용할 원본 버전

    const result: MdBlocks = {filePath: filePath, fileName: fileName, blocks: []};

    // 입력받은 분할자를 고유 분할자로 변경
    const newSpliter = headingMap[spliter] || "__MARKDOWN_HEADING_3__";

    // --- 2. 분할 기준점 위치와 키 정보를 미리 수집 ---
    const splitPoints: { index: number, key: string }[] = [];
    splitedLines.forEach((line, index) => {
        if (line.startsWith(newSpliter)) {
            const keyText = line.replace(newSpliter, "").trim();
            splitPoints.push({
                index: index,
                key: `${keyText}_${fileName}`
            });
        }
    });

    // --- 3. 블럭 분할 ---
    if (splitPoints.length === 0) {
        // 분할자가 없는 경우 문서 전체를 하나의 블럭으로 처리
        if (markdown.trim()) {
            const blockKey = `full_document_${fileName}`;
            const hashedKey = hashString(blockKey);
            result.blocks.push( {id: hashedKey, key: blockKey, text: markdown });
        }
    } else { 
        // 분할자가 있는 경우 분할자 위의 내용을 하나의 블럭으로, 나머지도 블럭화
        let prologueContent = originalLines.slice(0, splitPoints[0].index).join('\n').trim();
        if (prologueContent) {
            const blockKey = `prologue_of_${fileName}`;
            const hashedKey = hashString(blockKey);

            result.blocks.push({id: hashedKey, key: blockKey, text: prologueContent});
        }

        for (let i = 0; i < splitPoints.length; i++) {
            const currentPoint = splitPoints[i];
            // 다음 포인트 없을 때 확인
            const start = currentPoint.index;
            const end = splitPoints.length-1 === i ? splitedLines.length : splitPoints[i+1].index;

            let blockContent = originalLines.slice(start, end).join("\n").trim();
            const hashedKey = hashString(currentPoint.key);

            result.blocks.push({id: hashedKey, key: currentPoint.key, text: blockContent});
        }
    }

    // for (const each of result.blocks) {
    //     console.log("---------------------------")
    //     console.log(`id: ${each.id} - key: ${each.key} - text: ${each.text}`)
    // }

    return result;
}