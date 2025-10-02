import { App, normalizePath } from "obsidian";
import { MdBlocks, MdHeaddingBlock } from "src/types/structures";

// ID -> MdHeaddingBlock 저장소
export class BlockStore {
    private app: App;
    private headdingBlockstore: Map<number, MdHeaddingBlock> = new Map(); // "id" -> "MdHeaddingBlock"
    private fileBlocksMap: Map<string, number[]> = new Map(); // "filePath" -> [id1, id2, ...]

    constructor(app: App) {
        this.app = app
    }

    public async initialize() {
        await this.loadMaps();
    }

    public addItems(data: MdHeaddingBlock[], filePath?: string): void {
        const blockIds: number[] = [];

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
            blockIds.push(each.id);
        }

        // filePath가 제공된 경우 fileBlocksMap 업데이트
        if ( filePath && blockIds.length > 0 ) {
            const existingIds = this.fileBlocksMap.get(filePath) || [];
            // 기존 ID와 새 ID를 합치고 중복 제거
            const mergedIds = Array.from(new Set([...existingIds, ...blockIds]));
            this.fileBlocksMap.set(filePath, mergedIds);
        }
    }

    public deleteItem(id: number): void {
        // TODO: 에러 스로잉으로 변경

        const exist = this.headdingBlockstore.has(id);
        if ( !exist ) {
            console.log(`BlockStore - 삭제하려는 file이 존재하지 않음 ID: ${id}`);
            return;
        }

        // headdingBlockstore에서 삭제
        this.headdingBlockstore.delete(id);

        // fileBlocksMap에서도 해당 ID 제거
        for (const [filePath, ids] of this.fileBlocksMap.entries()) {
            const filteredIds = ids.filter(blockId => blockId !== id);
            if (filteredIds.length === 0) {
                // 파일에 블럭이 하나도 없으면 파일 엔트리도 삭제
                this.fileBlocksMap.delete(filePath);
            } else if (filteredIds.length !== ids.length) {
                // ID가 제거되었으면 업데이트
                this.fileBlocksMap.set(filePath, filteredIds);
            }
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
        const blockMapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/BLOCK_MAP.json`);
        const fileBlocksMapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/FILE_BLOCKS_MAP.json`);

        try {
            // headdingBlockstore 저장
            const stringfiedMap = JSON.stringify(Object.fromEntries(this.headdingBlockstore), null, 2);
            await this.app.vault.adapter.write(blockMapPath, stringfiedMap);

            // fileBlocksMap 저장
            const stringifiedFileBlocksMap = JSON.stringify(Object.fromEntries(this.fileBlocksMap), null, 2);
            await this.app.vault.adapter.write(fileBlocksMapPath, stringifiedFileBlocksMap);
        } catch (error) {
            // TODO: 에러 스로잉(이벤트) 처리
            console.warn(`BlockStore - 맵 저장 중 에러 발생 Error: ${error}`);
        }
    }

    public async loadMaps(): Promise<void> {
        const blockMapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/BLOCK_MAP.json`);
        const fileBlocksMapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/FILE_BLOCKS_MAP.json`);

        try {
            // headdingBlockstore 로드
            const blockMapExist = await this.app.vault.adapter.exists(blockMapPath);
            if ( !blockMapExist ) {
                this.headdingBlockstore = new Map();
            } else {
                const stringifiedMap = await this.app.vault.adapter.read(blockMapPath);
                const mapObj = JSON.parse(stringifiedMap);
                this.headdingBlockstore = new Map(
                    Object.entries(mapObj).map(([key, value]) => [Number(key), value as MdHeaddingBlock])
                );
            }

            // fileBlocksMap 로드
            const fileBlocksMapExist = await this.app.vault.adapter.exists(fileBlocksMapPath);
            if ( !fileBlocksMapExist ) {
                this.fileBlocksMap = new Map();
            } else {
                const stringifiedFileBlocksMap = await this.app.vault.adapter.read(fileBlocksMapPath);
                const fileBlocksMapObj = JSON.parse(stringifiedFileBlocksMap);
                this.fileBlocksMap = new Map(
                    Object.entries(fileBlocksMapObj).map(([key, value]) => [key, value as number[]])
                );
            }
        } catch (error) {
            // TODO: 에러 스로잉(이벤트) 처리하기
            console.warn(`BlockStore - 맵 로드 중 에러 발생 Error: ${error}`);
        }
    }

    public count() {
        return this.headdingBlockstore.size;
    }

    public async resetStore() {
        this.headdingBlockstore.clear();
        this.fileBlocksMap.clear();

        const blockMapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/BLOCK_MAP.json`);
        const fileBlocksMapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/FILE_BLOCKS_MAP.json`);

        await this.app.vault.adapter.remove(blockMapPath);
        await this.app.vault.adapter.remove(fileBlocksMapPath);
    }

    public clearMap() {
        this.headdingBlockstore.clear();
        this.fileBlocksMap.clear();
    }

    // 파일별 블럭 ID 조회 메서드들

    /**
     * 특정 파일이 가지고 있는 모든 블럭 ID 리스트 반환
     */
    public getFileBlockIds(filePath: string): number[] {
        return this.fileBlocksMap.get(filePath) || [];
    }

    /**
     * 특정 파일의 모든 블럭 삭제
     */
    public deleteFileBlocks(filePath: string): void {
        const blockIds = this.getFileBlockIds(filePath);
        for (const id of blockIds) {
            this.headdingBlockstore.delete(id);
        }
        this.fileBlocksMap.delete(filePath);
    }

    /**
     * 파일 경로 변경 시 fileBlocksMap 업데이트
     */
    public renameFilePath(oldPath: string, newPath: string): void {
        const blockIds = this.fileBlocksMap.get(oldPath);
        if (blockIds) {
            this.fileBlocksMap.delete(oldPath);
            this.fileBlocksMap.set(newPath, blockIds);
        }
    }

    /**
     * 모든 파일 경로 목록 반환
     */
    public getAllFilePaths(): string[] {
        return Array.from(this.fileBlocksMap.keys());
    }

    /**
     * 특정 파일이 블럭을 가지고 있는지 확인
     */
    public hasFile(filePath: string): boolean {
        return this.fileBlocksMap.has(filePath);
    }
}