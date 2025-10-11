export type HeadingLevel = 'h1'|'h2'|'h3'|'h4'|'h5'|'h6';

export interface ChumsaSettings {
    OPENAI_API_KEY: string;
    // 기존 spliter는 유지(하위호환), 새로 headingLevel 사용
    spliter: string;
    indexFileName: string;
    headingLevel: HeadingLevel;
}

export const HEADING_CONFIGS: Record<HeadingLevel, { tag: HeadingLevel; splitter: string; label: string }> = {
    h1: { tag: 'h1', splitter: '# ',     label: 'Header 1' },
    h2: { tag: 'h2', splitter: '## ',    label: 'Header 2' },
    h3: { tag: 'h3', splitter: '### ',   label: 'Header 3' },
    h4: { tag: 'h4', splitter: '#### ',  label: 'Header 4' },
    h5: { tag: 'h5', splitter: '##### ', label: 'Header 5' },
    h6: { tag: 'h6', splitter: '###### ',label: 'Header 6' },
};

export function getHeadingConfig(level: HeadingLevel) {
    return HEADING_CONFIGS[level] ?? HEADING_CONFIGS.h3;
}

export const DEFAULT_SETTINGS: ChumsaSettings = {
    OPENAI_API_KEY: "",
    spliter: "### ",           // 기존 필드 유지
    indexFileName: "indexFile",
    headingLevel: 'h3',        // 신규: 기본값 H3
};