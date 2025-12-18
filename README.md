# Chumsa - Obsidian AI Connection Partner

**Chumsa** is a powerful plugin that connects and recommends knowledge within Obsidian based on AI. Using OpenAI's embedding technology and vector search, it instantly finds data related to the heading or document you are currently writing.

!["./essets/working_example.png"]

## ✨ Key Features

### 1. 🔗 Heading-based Context Search
Click the **link icon** automatically generated next to the document's heading (title). AI finds snippets from other notes in your vault that are similar to the context of that heading.
- **Auto Detection**: Search buttons are automatically attached to headings of each level (H1~H6).
- **Semantic Search**: Performs meaning-based (Semantic) search, not just simple keywords.

### 2. 🧠 Semantic Search View
You can directly search for what you are curious about through the **Search View** in the sidebar.
- Recommends the most relevant note blocks based on vector similarity.
- You can navigate directly to the note from the search results.

### 3. 🏷️ Auto Tagging
Analyzes the content of the document you are writing to automatically recommend and add appropriate tags.
- **LLM-based Analysis**: Identifies the core topics and context of the document to generate the most suitable tags.
- **Frontmatter Integration**: Automatically adds generated tags to the Frontmatter (`tags` field) at the top of the document.
- **Duplicate Prevention**: Smartly merges only new tags while keeping existing ones.

---

## ⚙️ Setup and Getting Started

### Prerequisites
- **OpenAI API Key**: This plugin uses OpenAI's Embedding and Chat API.

### Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release of this repository.
2. Place them in your vault's `.obsidian/plugins/chumsa-plugin/` folder.
3. Enable **Chumsa** in Obsidian Settings > Community Plugins.

### Initial Setup
1. Go to **Settings > Chumsa**.
2. Enter your **OpenAI API Key**.
3. Set the **Heading Spliter Level** (Default: H3). This level determines how documents are split for vector indexing.
4. Wait for a moment while the plugin automatically scans your documents and generates indexing data.

~["./essets/setting.png"]

---

## 🛠 Tech Stack
- **TypeScript**: Main language for the plugin
- **HNSWLib-Wasm**: Local vector search engine (Optimized for Browser/Electron environments)
- **OpenAI API**: Embedding generation (text-embedding-3-small, etc.) and chat
- **Obsidian API**: UI integration and file system control

## 🗓 Deployment and Contribution
This project is open source. Please leave bug reports or feature suggestions on [Issues](https://github.com/hunterhhunter/Chumsa-advanced/issues).
