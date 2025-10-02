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
- **HNSWLibAdapter** (`src/utils/hnsw_adapter.ts`): Vector database adapter implementing cosine similarity search using hnswlib-wasm
- **MainDataBase** (`src/services/vectorDB.ts`): Service layer orchestrating vector operations with HNSWLibAdapter, MetaDataStore, and BlockStore
- **MetaDataStore** (`src/utils/metadata_store.ts`): Manages metadata for stored vectors with persistent JSON storage
- **BlockStore** (`src/utils/block_store.ts`): Manages markdown block content linked to vector IDs
- **Plugin Entry** (`src/main.ts`): Obsidian plugin lifecycle with test suite integration

### Vector Search System
- Uses 3-dimensional vectors for testing, typically 1536 dimensions for production embeddings
- Implements persistent storage via JSON mapping files (ID_TO_VECTOR.json, METADATA_MAP.json)
- HNSW index files (*.hnsw) stored in vault's plugin folder
- Cosine similarity metric for vector comparisons

### Key Interfaces (`src/types/structures.ts`)
- `IVectorDB`: Standard interface for vector database operations
- `EmbededData`: Vector data structure with id and vector array
- `MetaData`: Metadata for stored vectors (id, key, filePath, fileName)
- `VectorSearchResult`: Search results with scores

### Testing Framework
- Custom test runner (`src/tests/test_runner.ts`) with timeout support
- HNSWTestSuite (`src/tests/HNSW_test_suite.ts`) validates adapter functionality
- MetadataStoreTestSuite and BlockStoreTestSuite for component testing
- Test commands accessible via Obsidian command palette or settings tab

## Development Notes

- TypeScript strict mode enabled
- Bundle all dependencies into main.js using esbuild
- Requires .env file with OBSIDIAN_PLUGIN_PATH for development
- Vector validation includes dimension checks and NaN detection
- Test suite accessible through plugin commands or settings tab

## important rules
- always answer in Korean