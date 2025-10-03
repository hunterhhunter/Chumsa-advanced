// TODO: 임베딩 관장하는 클래스 EmbedModel 생성
// TODO: 임베딩 단위는 MdHeaddingBlock
// TODO: 임베딩은 배치단위로 진행하며, 배치단위 임베딩 종료시 maindatabase에 저장이 완료된 후 다음 배치 시작. 한 배치는 한 노트(md)에 존재하는 HeaddingBlock이 될 것.
// TODO: MdHeaddingBlock을 입력받아 MdHeaddingBlock[], EmbededData[]를 반환하는 임베딩 함수 작성
// TODO: BlockStore에 저장할 때 fileBlocksMap에는 MdHeaddingBlock의 text를 해싱한 id를 입력

import OpenAI from "openai";
import { MainDataBase } from "./main_database";
import { EmbededData, MdBlocks, MdHeaddingBlock } from "src/types/structures";

export class EmbedModel {
    private database: MainDataBase;
    private client: OpenAI = new OpenAI();
    
    constructor(database: MainDataBase, apiKey: string) {
        this.database = database;
        this.client = new OpenAI({apiKey: apiKey});
    }

    public async embeddingOneText(text: string) {
        const res = await this.client.embeddings.create({
            model: "text-embedding-3-small",
            input: text
        });

        const vec = res.data[0].embedding;
        return vec;
    }

    public async embeddingBlock(block: MdHeaddingBlock): Promise<EmbededData> {
        const res = await this.client.embeddings.create({
            model: "text-embedding-3-small",
            input: block.text
        });

        const embededData: EmbededData = { id: block.id, vector: res.data[0].embedding };
        return embededData;
    }

    public async embeddingBlocks(blocks: MdBlocks): Promise<EmbededData[]> {
        const texts = blocks.blocks.map(block => block.text);

        const res = await this.client.embeddings.create({
            model: "text-embedding-3-small",
            input: texts
        })

        const returnValue: EmbededData[] = [];

        res.data.forEach((value, index) => {
            returnValue.push({id: blocks.blocks[index].id, vector: value.embedding});
        })
        return returnValue;
    }
}