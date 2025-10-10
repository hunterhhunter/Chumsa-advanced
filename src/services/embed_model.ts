import OpenAI from "openai";
import { EmbededData, MdBlocks, MdHeaddingBlock } from "src/types/structures";

export class EmbedModel {
    private client: OpenAI;

    constructor(apiKey: string) {
        this.client = new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true
        });
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