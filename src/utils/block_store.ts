import { App, normalizePath } from "obsidian";
import { MdBlocks, MdHeaddingBlock } from "src/types/structures";

// ID -> MdHeaddingBlock 저장소
export class BlockStore {
    private app: App;
    private headdingBlockstore: Map<number, MdHeaddingBlock> = new Map(); // "id" -> "[hash(Metadata.key), ..]"
    // TODO: filePath -> 해싱된 헤더키 보유 리스트 즉. 파일별로 어떤 헤더블럭을 가지고 있는지 알 수 있는 Map을 만들어야함.
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
            this.headdingBlockstore = new Map();
        }
    }

    public addItems(data: MdHeaddingBlock[]): void {
        for (const each of data) {
            if ( each.key.length === 0 ) {
                console.log(`BlockStore - Key가 비어있음 ID: ${each.id}`);
                continue;
            }

            if ( each.text.length === 0 ) {
                console.log(`BlockStore - 내용이 비어있음 ID: ${each.id}`);
                continue;
            }
            this.headdingBlockstore.set(each.id, each);
        }
    }

    public deleteItem(id: number): void {
        // TODO: 에러 스로잉으로 변경

        const exist = this.headdingBlockstore.has(id);
        if ( !exist ) {
            console.log(`BlockStore - 삭제하려는 file이 존재하지 않음 ID: ${id}`);
            return;
        } else {
            this.headdingBlockstore.delete(id);
        }
    }

    public updateItem(id: number, data: MdHeaddingBlock): void {
        this.deleteItem(id);
        this.addItems([data]);
    }

    public search(id: number): MdHeaddingBlock {
        const exist = this.headdingBlockstore.has(id);
        if ( !exist ) {
            console.log(`BlockStore - 검색하려는 file이 존재하지 않음 id: ${id}`);
            throw new Error(`NotFoundError - BlockStore ID: ${id}`)
        } else {
            const result = this.headdingBlockstore.get(id)!;
            return result;
        }
    }

    public async saveMaps(): Promise<void> {
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/BLOCK_MAP.json`);
        
        try {
            const stringfiedMap = JSON.stringify(Object.fromEntries(this.headdingBlockstore), null, 2);

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
                this.headdingBlockstore = new Map();
            } else {
                const stringifiedMap = await this.app.vault.adapter.read(mapPath);

                const mapObj = JSON.parse(stringifiedMap);

                this.headdingBlockstore = new Map(
                    Object.entries(mapObj).map(([key, value]) => [Number(key), value as MdHeaddingBlock])
                );
            }
        } catch (error) {
            // TODO: 에러 스로잉(이벤트) 처리하기
            console.warn(`MetaDataStore - 맵 로드 중 에러 발생 Error: ${error}`);
        }
    }

    public count() {
        return this.headdingBlockstore.size;
    }

    public async resetStore() {
        this.headdingBlockstore.clear();
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/BLOCK_MAP.json`);
        await this.app.vault.adapter.remove(mapPath);
    }

    public clearMap() {
        this.headdingBlockstore.clear();
    }
}