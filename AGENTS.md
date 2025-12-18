# Chumsa-advanced: Obsidian Vector Search Plugin

## Project Overview

**Chumsa-advanced**는 Obsidian 볼트 내 마크다운 문서에 대해 HNSW 기반 벡터 검색을 제공하는 플러그인입니다.

- **Target**: Obsidian Community Plugin (TypeScript → bundled JavaScript)
- **Entry Point**: `src/main.ts` compiled to `main.js`
- **Core Technology**: HNSW (Hierarchical Navigable Small World) vector database via hnswlib-wasm
- **Embedding**: OpenAI text-embedding-3-small (1536 dimensions)
- **Release Artifacts**: `main.js`, `manifest.json`, `styles.css`

---

## Key Features

1. **Vector Database**: HNSW index for efficient similarity search
2. **Document Indexing**: Parse markdown by headings, generate embeddings, store in vector DB
3. **Search View**: Dedicated sidebar view for semantic search with auto-linking
4. **Three-Layer Storage**:
   - Vector index (`.hnsw` files)
   - Metadata map (`METADATA_MAP.json`) - file paths, names, keys
   - Block content map (`BLOCK_MAP.json`) - markdown text, file-to-blocks mapping
5. **Testing Framework**: Comprehensive test suites for HNSW, block store, metadata store

---

## Project Structure

```
src/
  main.ts                     # Plugin lifecycle, command registration
  settings/
    settings.ts               # ChumsaSettings interface, defaults, heading config
    settings_tab.ts           # Settings UI (API key, heading level, test buttons)
  services/
    document_service.ts       # High-level document indexing & search
    embed_model.ts            # OpenAI embedding wrapper
    main_database.ts          # MainDataBase (coordinates HNSW + stores)
    search_filter.ts          # Search result filtering logic
  utils/
    hnsw_adapter.ts           # HNSWLibAdapter (IVectorDB implementation)
    block_store.ts            # BlockStore (BLOCK_MAP.json management)
    metadata_store.ts         # MetadataStore (METADATA_MAP.json management)
    markdown_parser.ts        # Parse markdown by headings
    hash_func.ts              # MurmurHash3 for consistent ID generation
    link_generator.ts         # Generate Obsidian wiki-links from search results
  views/
    search_view.ts            # SearchView (sidebar UI for search)
  widgets/
    input_widget.ts           # Custom input widget for search view
  types/
    structures.ts             # TypeScript interfaces (EmbededData, MdBlocks, etc.)
  tests/
    HNSW_test_suite.ts        # HNSW adapter tests
    block_store_test_suite.ts # Block store tests
    metadata_store_test_suite.ts # Metadata store tests
  styles.css                  # Plugin styles

esbuild.config.mjs            # Build configuration
.env                          # Environment variables (OPENAI_API_KEY, OBSIDIAN_PLUGIN_PATH)
manifest.json                 # Plugin manifest
versions.json                 # Version compatibility map
```

---

## Environment & Tooling

- **Node.js**: LTS (Node 18+ recommended)
- **Package Manager**: npm
- **Bundler**: esbuild (via `esbuild.config.mjs`)
- **Dependencies**:
  - `hnswlib-wasm`: HNSW vector database (WebAssembly)
  - `openai`: OpenAI API client for embeddings
  - `murmurhash3js-revisited`: Consistent hash function for IDs
  - `dotenv`: Environment variable management
- **Build Output**: `main.js` (bundles all deps except 'obsidian')

### Install

```bash
npm install
```

### Dev (watch mode)

Requires `.env` file with:
```env
OBSIDIAN_PLUGIN_PATH=C:/path/to/vault/.obsidian/plugins/Chumsa
OPENAI_API_KEY=sk-proj-...
```

```bash
npm run dev
```

Automatically copies `main.js`, `manifest.json`, `styles.css` to `OBSIDIAN_PLUGIN_PATH`.

### Production Build

```bash
npm run build
```

---

## Architecture

### Core Components

1. **[`src/main.ts`](src/main.ts)**: 
   - Plugin lifecycle (`onload`, `onunload`)
   - Command registration (search view toggle)
   - Initializes [`DocumentService`](src/services/document_service.ts)

2. **[`DocumentService`](src/services/document_service.ts)**:
   - High-level API: `saveOneDocument`, `updateOneDocument`, `saveVault`, `searchSimilarBlocks`
   - Coordinates [`MainDataBase`](src/services/main_database.ts) and [`EmbedModel`](src/services/embed_model.ts)

3. **[`MainDataBase`](src/services/main_database.ts)**:
   - Orchestrates [`HNSWLibAdapter`](src/utils/hnsw_adapter.ts), [`BlockStore`](src/utils/block_store.ts), [`MetadataStore`](src/utils/metadata_store.ts)
   - Methods: `addItems`, `search`, `deleteFileBlocks`, `getFileBlockIds`

4. **[`HNSWLibAdapter`](src/utils/hnsw_adapter.ts)**:
   - Implements [`IVectorDB`](src/types/structures.ts) interface
   - HNSW index management (initialize, add, search, save, load)
   - ID-to-vector mapping for consistency

5. **[`EmbedModel`](src/services/embed_model.ts)**:
   - Wraps OpenAI API
   - Generates embeddings for markdown blocks

6. **[`SearchView`](src/views/search_view.ts)**:
   - Sidebar view (VIEW_TYPE: "chumsa-search-view")
   - Search input, results display, auto-linking
   - File indexing UI

### Data Flow

```
User triggers indexing
  ↓
[main.ts] → DocumentService.saveOneDocument(filePath, spliter)
  ↓
[document_service.ts] → parseMarkdownByHeadings(filePath, fileName, content, spliter)
  ↓
[markdown_parser.ts] → MdBlocks { filePath, fileName, blocks: [{ id, key, text }] }
  ↓
[document_service.ts] → EmbedModel.embeddingBlocks(blocks)
  ↓
[embed_model.ts] → OpenAI API → EmbededData[] { id, vector[], metadata }
  ↓
[document_service.ts] → MainDataBase.addItems(blocks, embededData)
  ↓
[main_database.ts] → HNSWLibAdapter.addItems(data)
                  → BlockStore.addBlocks(blocks)
                  → MetadataStore.addMetadata(data)
  ↓
Storage: *.hnsw, BLOCK_MAP.json, METADATA_MAP.json
```

### ID Generation

- Uses [`MurmurHash3`](src/utils/hash_func.ts) for consistent IDs
- Key format: `"${headingText} of ${fileName}"` or special keys (`prologue_of_${fileName}`, `full_document_${fileName}`)

### Storage

- **Vector Index**: `<vault>/.obsidian/plugins/Chumsa/*.hnsw` (HNSW binary)
- **Metadata Map**: `METADATA_MAP.json` (ID → { filePath, fileName, key })
- **Block Map**: `BLOCK_MAP.json` (ID → { key, text }, file-to-blocks index)

---

## Key Interfaces

From [`src/types/structures.ts`](src/types/structures.ts):

```ts
export interface EmbededData {
    id: number;
    vector: number[];
    metadata: MetaData;
}

export interface MdHeaddingBlock {
    id: number;      // Hashed from key
    key: string;     // "${headingText} of ${fileName}"
    text: string;    // Markdown content
}

export interface MdBlocks {
    filePath: string;
    fileName: string;
    blocks: MdHeaddingBlock[];
}

export interface MetaData {
    filePath: string;
    fileName: string;
    key: string;
}

export interface MainDataBaseSearchResult {
    id: number;
    score: number;
    metadata: MetaData;
    block: MdHeaddingBlock;
}

export interface IVectorDB {
    initialize(indexFilePath: string, dimensions: number, maxElements: number): Promise<boolean>;
    addItems(data: EmbededData[]): Promise<void>;
    search(queryVector: number[], top_k: number): Promise<VectorSearchResults>;
    save(): Promise<void>;
    loadMaps(): Promise<void>;
    count(): Promise<number>;
}
```

---

## Settings

From [`src/settings/settings.ts`](src/settings/settings.ts):

```ts
export interface ChumsaSettings {
    OPENAI_API_KEY: string;
    spliter: string;          // Legacy field (e.g., "### ")
    indexFileName: string;
    headingLevel: HeadingLevel; // 'h1'|'h2'|'h3'|'h4'|'h5'|'h6'
}

export const DEFAULT_SETTINGS: ChumsaSettings = {
    OPENAI_API_KEY: "",
    spliter: "### ",
    indexFileName: "indexFile",
    headingLevel: 'h3',
};
```

**Heading Levels**:
- [`HEADING_CONFIGS`](src/settings/settings.ts): Maps `HeadingLevel` to `{ tag, splitter, label }`
- Used by [`parseMarkdownByHeadings`](src/utils/markdown_parser.ts) to split documents

---

## Commands & Views

### Commands

From [`src/main.ts`](src/main.ts):

```ts
this.addCommand({
    id: "toggle-search-view",
    name: "검색 뷰 열기/닫기",
    callback: () => { /* Toggle SearchView */ }
});
```

### Search View

- **Type**: `SEARCH_VIEW_TYPE` ("chumsa-search-view")
- **Location**: Right sidebar
- **Features**:
  - Search input with query embedding
  - Results display with similarity scores
  - Auto-link generation (wiki-links with headings)
  - "Index Current File" button

---

## Testing

From [`src/tests/`](src/tests/):

1. **[`HNSW_test_suite.ts`](src/tests/HNSW_test_suite.ts)**: HNSW adapter tests (add, search, save, load, delete)
2. **[`block_store_test_suite.ts`](src/tests/block_store_test_suite.ts)**: Block store tests (add, retrieve, delete, file mapping)
3. **[`metadata_store_test_suite.ts`](src/tests/metadata_store_test_suite.ts)**: Metadata store tests (add, retrieve, delete, batch operations)

**Run Tests**:
- Via command palette: "Run HNSW Test Suite" (currently disabled in main.ts)
- Via settings tab buttons (indexing/search tests)

---

## Development Notes

### Build System

- **esbuild** with watch mode
- **Output**: Directly to vault via `OBSIDIAN_PLUGIN_PATH`
- **Static Files**: `manifest.json`, `styles.css` auto-copied on build
- **API Key Injection**: `process.env.OPENAI_API_KEY` replaced at build time (esbuild `define`)

### Environment

Requires `.env` file:
```env
OBSIDIAN_PLUGIN_PATH=C:/Users/.../vault/.obsidian/plugins/Chumsa
OPENAI_API_KEY=sk-proj-...
```

### TypeScript

- **Strict Mode**: Enabled with `--isolatedModules`
- All files must be modules (have import/export)

### Dependencies

- **Bundled**: All deps except 'obsidian' (external)
- **Key Deps**: hnswlib-wasm, openai, murmurhash3js-revisited

### Vector Validation

- Enforces dimension consistency (1536D for production, 3D for tests)
- NaN detection before HNSW operations

### Hash Function

- **MurmurHash3** for consistent ID generation from block keys
- See [`src/utils/hash_func.ts`](src/utils/hash_func.ts)

---

## Common Tasks

### Add a New Command

In [`src/main.ts`](src/main.ts):
```ts
this.addCommand({
    id: "my-command-id",
    name: "My Command Name",
    callback: () => { /* Implementation */ }
});
```

### Add a New Setting

1. Update [`src/settings/settings.ts`](src/settings/settings.ts):
   ```ts
   export interface ChumsaSettings {
       // ... existing fields
       newSetting: boolean;
   }
   
   export const DEFAULT_SETTINGS: ChumsaSettings = {
       // ... existing defaults
       newSetting: false,
   };
   ```

2. Add UI in [`src/settings/settings_tab.ts`](src/settings/settings_tab.ts):
   ```ts
   new Setting(containerEl)
       .setName("New Setting")
       .setDesc("Description")
       .addToggle(toggle => toggle
           .setValue(this.plugin.settings.newSetting)
           .onChange(async (value) => {
               this.plugin.settings.newSetting = value;
               await this.plugin.saveSettings();
           }));
   ```

### Add a Test Suite

1. Create `src/tests/my_test_suite.ts`:
   ```ts
   import { App } from 'obsidian';
   
   export class MyTestSuite {
       private app: App;
       
       constructor(app: App) {
           this.app = app;
       }
       
       async runAllTests(): Promise<void> {
           console.log('🧪 Running My Test Suite...');
           await this.testFeature();
           console.log('✅ All tests passed');
       }
       
       private async testFeature(): Promise<void> {
           // Test implementation
       }
   }
   ```

2. Register in [`src/main.ts`](src/main.ts):
   ```ts
   import { MyTestSuite } from './tests/my_test_suite';
   
   this.addCommand({
       id: "run-my-tests",
       name: "Run My Test Suite",
       callback: async () => {
           const suite = new MyTestSuite(this.app);
           await suite.runAllTests();
       }
   });
   ```

### Extend Search Functionality

1. **Add Filter**: Modify [`src/services/search_filter.ts`](src/services/search_filter.ts)
2. **Customize Linking**: Edit [`src/utils/link_generator.ts`](src/utils/link_generator.ts)
3. **Update UI**: Modify [`src/views/search_view.ts`](src/views/search_view.ts)

---

## Troubleshooting

### Plugin Doesn't Load

- Ensure `main.js`, `manifest.json`, `styles.css` are in `<vault>/.obsidian/plugins/Chumsa/`
- Check Obsidian console (Ctrl+Shift+I) for errors
- Verify plugin is enabled in **Settings → Community plugins**

### Build Failures

- Run `npm install` to ensure dependencies are installed
- Check `.env` file exists with correct paths
- If `main.js` is missing, run `npm run build`

### Indexing Errors

- Verify `OPENAI_API_KEY` is valid (starts with `sk-proj-`)
- Check network connectivity
- Ensure markdown files exist in vault
- Review console logs for detailed error messages

### Search Returns No Results

- Confirm files are indexed (check `METADATA_MAP.json` size)
- Verify HNSW index file exists (`*.hnsw`)
- Test with known document content
- Check [`SearchFilter`](src/services/search_filter.ts) thresholds

### Memory Issues

- HNSW index can be large (adjust `maxElements` in [`HNSWLibAdapter.initialize`](src/utils/hnsw_adapter.ts))
- Consider batch processing for large vaults
- Monitor WASM memory usage

---

## Security & Privacy

- **Local-First**: All processing happens locally (except OpenAI API calls)
- **API Key Storage**: Stored in plugin settings (`.obsidian/plugins/Chumsa/data.json`)
- **Network Requests**: Only to OpenAI for embeddings (explicit user action)
- **Data Collection**: None. No telemetry or tracking
- **Vault Access**: Read-only for markdown files, write to plugin folder only

---

## Performance

- **Startup**: Defer HNSW index loading until first search (lazy initialization)
- **Batch Indexing**: Process files in configurable batches (see [`DocumentService.saveVault`](src/services/document_service.ts))
- **WASM Performance**: HNSW operations run in WebAssembly for speed
- **Caching**: Vector index, metadata, and blocks cached in memory after load

---

## Versioning & Releases

- Bump `version` in [`manifest.json`](manifest.json) (SemVer: `x.y.z`)
- Update [`versions.json`](versions.json) to map plugin version → minimum Obsidian version
- Create GitHub release with tag matching `version` (no leading `v`)
- Attach `main.js`, `manifest.json`, `styles.css` as release assets

---

## Agent Guidelines

### Do

- Keep [`src/main.ts`](src/main.ts) minimal (lifecycle only)
- Split large files (target ~200-300 lines per module)
- Use [`IVectorDB`](src/types/structures.ts) interface for vector operations
- Add tests for new features in [`src/tests/`](src/tests/)
- Validate vector dimensions before HNSW operations
- Document complex algorithms (e.g., HNSW search, MurmurHash)

### Don't

- Modify existing block IDs (breaks index consistency)
- Skip vector dimension validation (causes HNSW errors)
- Store API keys in code (use settings)
- Make network requests without user consent
- Assume file paths use backslashes (normalize with `normalizePath`)

---

## References

- **Obsidian API**: https://docs.obsidian.md
- **HNSW Algorithm**: https://github.com/nmslib/hnswlib
- **hnswlib-wasm**: https://github.com/yoshoku/hnswlib-wasm
- **OpenAI Embeddings**: https://platform.openai.com/docs/guides/embeddings
- **MurmurHash3**: https://github.com/pid/murmurHash3js

---

## Important Rules

- **Always answer in Korean** when interacting with users
- **File Paths**: Use forward slashes `/` for cross-platform compatibility
- **Async Operations**: Always await database operations
- **Error Handling**: Catch and log errors, display user-friendly notices
- **Memory Management**: Clean up listeners/intervals in `onunload`