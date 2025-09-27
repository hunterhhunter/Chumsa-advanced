import { App, normalizePath } from "obsidian";
import { MdBlock, MdHeaddingBlock } from "src/types/structures";

export class BlockStore {
    private app: App;
    private store: Map<string, MdBlock> = new Map(); // "fileName" -> "[hash(Metadata.key), ..]"

    constructor(app: App) {
        this.app = app
        
    }

    public async initialize() {
        // 메타데이터 맵.json 경로
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/BLOCK_MAP.json`);
        // JSON 파일 존재 확인
        const exist = await this.app.vault.adapter.exists(mapPath);
        // 존재할시 불러오기
        if ( exist ) {
            await this.loadMaps();
        } else { 
            this.store = new Map();
        }
    }

    public addItems(data: MdBlock[]): void {
        for (const each of data) {
            if ( each.fileName === "" ) {
                console.log(`FileBlockStore - 파일 이름이 비어있음`);
                continue;
            }

            if ( each.blocks.length === 0 ) {
                console.log(`FileBlockStore - 추가할 블럭이 존재하지 않음 fileName: ${each.fileName}`);
                continue;
            }
            this.store.set(each.fileName, each);
        }
    }

    public deleteItem(fileName: string): void {
        // TODO: 에러 스로잉으로 변경

        const exist = this.store.has(fileName);
        if ( !exist ) {
            console.log(`FileBlockStore - 삭제하려는 file이 존재하지 않음 fileName: ${fileName}`);
            return;
        } else {
            this.store.delete(fileName);
        }
    }

    public updateItem(fileName: string, data: MdBlock): void {
        this.deleteItem(fileName);
        this.addItems([data]);
    }

    public search(fileName: string): MdBlock | void {
        const exist = this.store.has(fileName);
        if ( !exist ) {
            console.log(`FileBlockStore - 검색하려는 file이 존재하지 않음 fileName: ${fileName}`);
            return;
        } else {
            const result = this.store.get(fileName);
            return result;
        }
    }

    public async saveMaps(): Promise<void> {
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/BLOCK_MAP.json`);
        
        try {
            const stringfiedMap = JSON.stringify(Object.fromEntries(this.store), null, 2);

            await this.app.vault.adapter.write(`${mapPath}`, stringfiedMap);
        } catch (error) {
            // TODO: 에러 스로잉(이벤트) 처리
            console.warn(`MetaDataStore - 맵 저장 중 에러 발생 Error: ${error}`);
        }
    }

    public async loadMaps(): Promise<void> {
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/BLOCK_MAP.json`);
        try {
            const exist = await this.app.vault.adapter.exists(mapPath);

            if ( !exist ) {
                this.store = new Map();
            } else {
                const stringifiedMap = await this.app.vault.adapter.read(mapPath);

                const mapObj = JSON.parse(stringifiedMap);

                this.store = new Map(
                    Object.entries(mapObj).map(([key, value]) => [String(key), value as MdBlock])
                );
            }
        } catch (error) {
            // TODO: 에러 스로잉(이벤트) 처리하기
            console.warn(`MetaDataStore - 맵 로드 중 에러 발생 Error: ${error}`);
        }
    }

    public count() {
        return this.store.size;
    }

    public async resetStore() {
        this.store.clear();
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/BLOCK_MAP.json`);
        await this.app.vault.adapter.remove(mapPath);
    }

    public clearMap() {
        this.store.clear();
    }
}