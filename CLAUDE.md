# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Build and Development:
- `npm run dev` - Start development build with watch mode
- `npm run build` - Production build (runs TypeScript check then bundles with esbuild)
- `npm test` - Run Jest tests
- `npm run version` - Bump version and update manifest

Important: The build outputs directly to vault plugin folder via OBSIDIAN_PLUGIN_PATH environment variable.

## Architecture

This is an Obsidian plugin implementing a vector database using HNSW (Hierarchical Navigable Small World) algorithm. Key components:

### Core Architecture
- **MainDataBase** (`src/services/main_database.ts`): Service layer orchestrating vector operations with HNSWLibAdapter, MetaDataStore, and BlockStore. Provides unified CRUD operations (addItems, deleteItem, updateItem, search) and coordinates data consistency across three storage layers.
- **HNSWLibAdapter** (`src/utils/hnsw_adapter.ts`): Vector database adapter implementing cosine similarity search using hnswlib-wasm
- **MetaDataStore** (`src/utils/metadata_store.ts`): Manages metadata for stored vectors with persistent JSON storage (METADATA_MAP.json)
- **BlockStore** (`src/utils/block_store.ts`): Manages markdown block content linked to vector IDs with persistent JSON storage (BLOCK_MAP.json)
- **Plugin Entry** (`src/main.ts`): Obsidian plugin lifecycle with test suite integration

### Data Flow & Storage
- **ID Generation**: Uses MurmurHash3 (`src/utils/hash_func.ts`) to generate consistent IDs from markdown block keys
- **Three-Layer Storage**:
  - Vector index (*.hnsw files) - HNSW binary format
  - Metadata (METADATA_MAP.json) - Maps ID to file path, name, and key
  - Block content (BLOCK_MAP.json) - Maps ID to markdown text content
- **Vector Dimensions**: 3D for testing, typically 1536D for production (OpenAI embeddings)
- **Similarity Metric**: Cosine similarity via hnswlib-wasm
- **Storage Location**: All files stored in vault's plugin folder via OBSIDIAN_PLUGIN_PATH

### Key Interfaces (`src/types/structures.ts`)
- `IVectorDB`: Standard interface for vector database operations
- `EmbededData`: Vector data with id and embedding array
- `MetaData`: Metadata linking ID to file location (id, key, filePath, fileName)
- `MdHeaddingBlock`: Markdown block content (id, key, text)
- `MdBlocks`: File-level container for blocks (filePath, fileName, blocks[])
- `MainDataBaseSearchResult`: Unified search result combining score, metadata, and block content

### Testing Framework
- Custom test runner (`src/tests/test_runner.ts`) with timeout support
- HNSWTestSuite (`src/tests/HNSW_test_suite.ts`) validates adapter functionality
- MetadataStoreTestSuite and BlockStoreTestSuite for component testing
- Test commands accessible via Obsidian command palette or settings tab

## Development Notes

- **Build System**: esbuild with watch mode, outputs directly to vault via OBSIDIAN_PLUGIN_PATH
- **Environment**: Requires `.env` file with `OBSIDIAN_PLUGIN_PATH` pointing to vault's plugin folder
- **TypeScript**: Strict mode enabled
- **Dependencies**: All bundled into main.js except 'obsidian' (external)
- **Vector Validation**: Enforces dimension consistency and NaN detection before operations
- **Test Access**: Via command palette ("Run HNSW Test Suite") or settings tab buttons
- **Hash Function**: MurmurHash3 for consistent ID generation from block keys

## Important Rules
- Always answer in Korean
- File path separator: Use forward slashes for cross-platform compatibility in code