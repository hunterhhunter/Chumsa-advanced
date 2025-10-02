// TODO: 임베딩 관장하는 클래스 EmbedModel 생성
// TODO: 임베딩 단위는 MdHeaddingBlock
// TODO: 임베딩은 배치단위로 진행하며, 배치단위 임베딩 종료시 maindatabase에 저장이 완료된 후 다음 배치 시작. 한 배치는 한 노트(md)에 존재하는 HeaddingBlock이 될 것.
// TODO: MdHeaddingBlock을 입력받아 MdHeaddingBlock[], EmbededData[]를 반환하는 임베딩 함수 작성
// TODO: BlockStore에 저장할 때 fileBlocksMap에는 MdHeaddingBlock의 text를 해싱한 id를 입력