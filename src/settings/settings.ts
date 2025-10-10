export interface ChumsaSettings {
    OPENAI_API_KEY: string;
    spliter: string;
    indexFileName: string;
}

export const DEFAULT_SETTINGS: ChumsaSettings = {
    OPENAI_API_KEY: "",
    spliter: "### ",
    indexFileName: "indexFile",
};