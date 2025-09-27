import { App, MetadataCache, normalizePath } from 'obsidian';
import { MetaData, EmbededData } from '../types/structures';
import { normalize } from 'path';

export class MetaDataStore {
    private app: App;
    private store: Map<number, MetaData> = new Map();

    // DONE: Constructor 작성
    constructor(app: App) {
        this.app = app;
    }

    // DONE: initialize 함수 선언
    public async initialize() {
        // 메타데이터 맵.json 경로
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/METADATA_MAP.json`);
        // JSON 파일 존재 확인
        const exist = await this.app.vault.adapter.exists(mapPath);
        // 존재할시 불러오기
        if ( exist ) {
            await this.loadMaps();
        } else { 
            this.store = new Map();
        }
    }
    

    // DONE: 메타데이터 삽입, 삭제, 업데이트, 검색 로직 작성
    public addItems(data: MetaData[]): void {
        // TODO: 에러 처리(지금은 pass - pass한 문서 따로 정리해서 남겨두기?) 로직 정리
        for (const each of data) {
            // 메타데이터 검증
            if ( each.filePath === "" ) {
                console.warn(`MetaDataStore - 파일 경로 비어있음 ID: ${each.filePath}`);
                continue;
            }
            
            if ( !each.id ) {
                console.warn(`MetaDataStore - ID 비어있음`);
                continue;
            }

            if ( each.key === "" ) {
                console.warn(`MetaDataStore - key 비어있음 ID: ${each.id}`);
                continue;
            }

            if ( this.store.has(each.id) ) {
                console.warn(`MetaDataStore - 이미 보유중인 ID: ${each.id}`);
                continue;
            }
            // map에 데이터 추가
            this.store.set(each.id, each);
        }
    }

    public deleteItem(id: number): void {
        // ID에 해당하는 데이터가 존재하지 않는 경우 pass
        if ( !this.store.has(id) ) {
            console.warn(`MetaDataStore - ID에 해당하는 데이터가 존재하지 않음: ID: ${id}`);
            // TODO: 에러 스로잉(이벤트) 처리하기
            return;
        } else {
            this.store.delete(id);
        }
    }

    public updateItem(id: number, data: MetaData) {
        // DB처럼 삽입 후 삭제를 원칙으로 함.
        // ID에 해당하는 데이터가 존재하지 않는 경우 - 현재는 패스
        // TODO: 데이터가 존재하지 않는 경우에 에러 스로잉(이벤트) 처리하기 or 그냥 삽입해주기
        if ( !this.store.has(id) ) {
            console.warn(`MetaDataStore - ID에 해당하는 데이터가 존재하지 않음 ID: ${id}`);
            return;
        } else {
            this.deleteItem(id);
            this.addItems([data]);
        }
    }

    public search(id: number): MetaData | Error {
        // ID에 해당하는 데이터가 없는 경우 에러 스로잉(이벤트) 처리하기 or 무시 후 리턴 결정
        if ( !this.store.has(id) ) {
            console.warn(`MetaDataStore - ID에 해당하는 데이터가 존재하지 않음 ID: ${id}`);
            return new Error(`MetaDataStore - ID에 해당하는 데이터가 존재하지 않음 ID: ${id}`);
        } else {
            const result = this.store.get(id);

            if (!result) { 
                console.warn(`MetaDataStore - ID에 해당하는 데이터가 존재하지 않음 ID: ${id}`);
                return new Error(`MetaDataStore - ID에 해당하는 데이터가 존재하지 않음 ID: ${id}`);
            }
            return result;
        }
    }

    // DONE: 파일에서 매핑 불러오는 로직
    public async loadMaps(): Promise<void> {
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/METADATA_MAP.json`);
        try {
            const exist = await this.app.vault.adapter.exists(mapPath);

            if ( !exist ) {
                this.store = new Map();
            } else {
                const stringifiedMap = await this.app.vault.adapter.read(mapPath);

                const mapObj = JSON.parse(stringifiedMap);

                this.store = new Map(
                    Object.entries(mapObj).map(([key, value]) => [Number(key), value as MetaData])
                );
            }
        } catch (error) {
            // TODO: 에러 스로잉(이벤트) 처리하기
            console.warn(`MetaDataStore - 맵 로드 중 에러 발생 Error: ${error}`);

        }
    }

    // DONE: 메타데이터 파일에 저장 로직
    public async saveMaps(): Promise<void> {
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/METADATA_MAP.json`);

        try {
            const stringfiedMap = JSON.stringify(Object.fromEntries(this.store), null, 2);

            await this.app.vault.adapter.write(`${mapPath}`, stringfiedMap);
        } catch (error) {
            // TODO: 에러 스로잉(이벤트) 처리
            console.warn(`MetaDataStore - 맵 저장 중 에러 발생 Error: ${error}`);
        }
    }

    public count() {
        return this.store.size;
    }

    public async resetStore() {
        this.store.clear();
        const mapPath = normalizePath(`${this.app.vault.configDir}/plugins/Chumsa/METADATA_MAP.json`);
        await this.app.vault.adapter.remove(mapPath);
    }

    public clearMap() {
        this.store.clear();
    }
}