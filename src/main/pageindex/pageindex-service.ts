/**
 * PageIndex Service
 * Vectorless, reasoning-based RAG that builds hierarchical JSON tree indices from PDFs.
 * TypeScript-native implementation of the PageIndex algorithm.
 *
 * Algorithm:
 *   1. Extract per-page text from PDF
 *   2. LLM detects document structure (TOC or inferred from content)
 *   3. LLM adds summaries to each section node
 *   4. Result stored as JSON in workspace directory
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGoogleApiKey } from '../gemini/index';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageIndexNode {
  title: string;
  node_id: string;
  start_index: number;
  end_index: number;
  summary?: string;
  text?: string;
  nodes?: PageIndexNode[];
}

export interface PageIndexDocument {
  id: string;
  type: 'pdf';
  path: string;
  doc_name: string;
  doc_description: string;
  page_count: number;
  structure: PageIndexNode[];
  pages?: Array<{ page: number; content: string }>;
}

interface MetaEntry {
  type: 'pdf';
  doc_name: string;
  doc_description: string;
  path: string;
  page_count: number;
}

const META_INDEX = '_meta.json';

// ── Workspace helpers ─────────────────────────────────────────────────────────

function getWorkspacePath(): string {
  const base = app
    ? app.getPath('userData')
    : path.join(process.env.HOME || '', 'Library', 'Application Support', 'egdesk');
  const ws = path.join(base, 'pageindex');
  fs.mkdirSync(ws, { recursive: true });
  return ws;
}

function readJSON<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ── PDF per-page text extraction ──────────────────────────────────────────────

async function extractPagesText(filePath: string): Promise<string[]> {
  // Lazy require to avoid issues if pdf-parse is not bundled in renderer
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse');

  const pageTexts: string[] = [];

  function pageRender(pageData: any): Promise<string> {
    return pageData.getTextContent().then((textContent: any) => {
      let text = '';
      let lastY: number | null = null;
      for (const item of textContent.items as any[]) {
        const y: number = item.transform ? item.transform[5] : 0;
        if (lastY === null || Math.abs(y - lastY) < 5) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = y;
      }
      pageTexts.push(text);
      return text;
    });
  }

  const dataBuffer = fs.readFileSync(filePath);
  await pdfParse(dataBuffer, { pagerender: pageRender });

  return pageTexts;
}

// ── LLM helpers ───────────────────────────────────────────────────────────────

function getGeminiModel(modelName = 'gemini-2.0-flash') {
  const { apiKey } = getGoogleApiKey();
  if (!apiKey) {
    throw new Error('Google API key not configured. Set it in EGDesk settings.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Truncate text to a token budget (rough char estimate: ~4 chars/token).
 */
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n...[truncated]';
}

/**
 * Build a compact page-text summary for the LLM.
 * For large PDFs we sample evenly to stay within context.
 */
function buildPageSample(pages: string[], maxTotalChars = 40000): string {
  if (pages.length === 0) return '';

  const perPage = Math.floor(maxTotalChars / pages.length);
  const lines: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const snippet = truncate(pages[i] || '', perPage);
    lines.push(`[Page ${i + 1}]\n${snippet}`);
  }

  return lines.join('\n\n');
}

// ── Tree building ─────────────────────────────────────────────────────────────

async function buildStructure(
  pages: string[],
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>
): Promise<{ doc_name: string; doc_description: string; structure: PageIndexNode[] }> {
  const pageCount = pages.length;
  const pageSample = buildPageSample(pages);

  const prompt = `You are a document structure analyzer. I have extracted text from a ${pageCount}-page PDF document. Analyze the content and create a hierarchical table of contents.

DOCUMENT PAGES:
${pageSample}

TASK: Create a hierarchical document index (table of contents) based on the actual content above.

Return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "doc_name": "Full document title",
  "doc_description": "1-2 sentence description of what this document covers",
  "structure": [
    {
      "title": "Chapter or section title",
      "start_index": 1,
      "end_index": 5,
      "nodes": [
        {
          "title": "Subsection title",
          "start_index": 2,
          "end_index": 3,
          "nodes": []
        }
      ]
    }
  ]
}

Rules:
- start_index and end_index are 1-based page numbers (1 to ${pageCount})
- start_index must be <= end_index
- Every page (1 to ${pageCount}) must be covered by at least one top-level node
- Maximum 3 levels of nesting
- Return ONLY the JSON object, no other text`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip any accidental markdown fences
  const jsonText = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`LLM returned invalid JSON for document structure: ${err}\nResponse: ${jsonText.slice(0, 500)}`);
  }

  const structure: PageIndexNode[] = assignNodeIds(parsed.structure || []);
  clampPageRanges(structure, pageCount);

  return {
    doc_name: parsed.doc_name || path.basename(''),
    doc_description: parsed.doc_description || '',
    structure,
  };
}

/**
 * Assign unique node IDs to every node in the tree.
 */
function assignNodeIds(nodes: any[]): PageIndexNode[] {
  return nodes.map((n) => ({
    title: n.title || 'Untitled',
    node_id: uuidv4(),
    start_index: Number(n.start_index) || 1,
    end_index: Number(n.end_index) || 1,
    nodes: n.nodes ? assignNodeIds(n.nodes) : [],
  }));
}

/**
 * Ensure all page ranges are within [1, pageCount].
 */
function clampPageRanges(nodes: PageIndexNode[], pageCount: number): void {
  for (const node of nodes) {
    node.start_index = Math.max(1, Math.min(node.start_index, pageCount));
    node.end_index = Math.max(node.start_index, Math.min(node.end_index, pageCount));
    if (node.nodes && node.nodes.length > 0) {
      clampPageRanges(node.nodes, pageCount);
    }
  }
}

// ── Summary generation ────────────────────────────────────────────────────────

async function addSummaries(
  nodes: PageIndexNode[],
  pages: string[],
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>
): Promise<void> {
  for (const node of nodes) {
    const start = node.start_index - 1; // 0-based
    const end = node.end_index;         // exclusive
    const sectionPages = pages.slice(start, end);
    const sectionText = truncate(sectionPages.join('\n\n'), 8000);

    if (sectionText.trim().length > 0) {
      try {
        const prompt = `Summarize the following document section titled "${node.title}" in 2-4 sentences. Focus on key concepts, decisions, or findings. Return only the summary text, no labels or headers.

SECTION CONTENT:
${sectionText}`;

        const result = await model.generateContent(prompt);
        node.summary = result.response.text().trim();
      } catch {
        node.summary = '';
      }
    }

    if (node.nodes && node.nodes.length > 0) {
      await addSummaries(node.nodes, pages, model);
    }
  }
}

// ── Persistence helpers ───────────────────────────────────────────────────────

function makeMetaEntry(doc: PageIndexDocument): MetaEntry {
  return {
    type: 'pdf',
    doc_name: doc.doc_name,
    doc_description: doc.doc_description,
    path: doc.path,
    page_count: doc.page_count,
  };
}

function saveMeta(workspace: string, docId: string, entry: MetaEntry): void {
  const metaPath = path.join(workspace, META_INDEX);
  const existing = readJSON<Record<string, MetaEntry>>(metaPath) || {};
  existing[docId] = entry;
  fs.writeFileSync(metaPath, JSON.stringify(existing, null, 2), 'utf-8');
}

function loadMeta(workspace: string): Record<string, MetaEntry> {
  const metaPath = path.join(workspace, META_INDEX);
  return readJSON<Record<string, MetaEntry>>(metaPath) || {};
}

function saveDocument(workspace: string, doc: PageIndexDocument): void {
  // For PDF: strip text fields from structure nodes before saving (redundant with pages)
  const toSave = { ...doc };
  toSave.structure = stripTextFields(doc.structure);
  const docPath = path.join(workspace, `${doc.id}.json`);
  fs.writeFileSync(docPath, JSON.stringify(toSave, null, 2), 'utf-8');
  saveMeta(workspace, doc.id, makeMetaEntry(doc));
}

function stripTextFields(nodes: PageIndexNode[]): PageIndexNode[] {
  return nodes.map((n) => {
    const { text: _text, ...rest } = n;
    return {
      ...rest,
      nodes: n.nodes ? stripTextFields(n.nodes) : [],
    };
  });
}

function loadDocument(workspace: string, docId: string): PageIndexDocument | null {
  const docPath = path.join(workspace, `${docId}.json`);
  return readJSON<PageIndexDocument>(docPath);
}

// ── Page range parser ─────────────────────────────────────────────────────────

function parsePages(pages: string): number[] {
  const result: number[] = [];
  for (const part of pages.split(',')) {
    const p = part.trim();
    if (p.includes('-')) {
      const [a, b] = p.split('-', 2).map((s) => parseInt(s.trim(), 10));
      if (isNaN(a) || isNaN(b) || a > b) throw new Error(`Invalid range: ${p}`);
      for (let i = a; i <= b; i++) result.push(i);
    } else {
      const n = parseInt(p, 10);
      if (isNaN(n)) throw new Error(`Invalid page number: ${p}`);
      result.push(n);
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}

// ── Main service ──────────────────────────────────────────────────────────────

export class PageIndexService {
  private workspace: string;
  /** In-memory cache: meta entries + lazily loaded full docs */
  private documents: Map<string, Partial<PageIndexDocument> & MetaEntry & { id: string }> = new Map();

  constructor() {
    this.workspace = getWorkspacePath();
    this.loadWorkspace();
  }

  private loadWorkspace(): void {
    const meta = loadMeta(this.workspace);
    for (const [docId, entry] of Object.entries(meta)) {
      this.documents.set(docId, { ...entry, id: docId });
    }
    console.log(`[PageIndex] Loaded ${this.documents.size} document(s) from workspace.`);
  }

  private ensureLoaded(docId: string): void {
    const entry = this.documents.get(docId);
    if (!entry || (entry as any).structure !== undefined) return;

    const full = loadDocument(this.workspace, docId);
    if (full) {
      this.documents.set(docId, { ...entry, ...full });
    }
  }

  /**
   * Index a PDF document. Returns the document ID.
   */
  async indexDocument(filePath: string, titleOverride?: string, descriptionOverride?: string): Promise<string> {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`File not found: ${absPath}`);
    }

    const ext = path.extname(absPath).toLowerCase();
    if (ext !== '.pdf') {
      throw new Error(`Only PDF files are supported. Got: ${ext}`);
    }

    console.log(`[PageIndex] Extracting text from: ${absPath}`);
    const pages = await extractPagesText(absPath);
    console.log(`[PageIndex] Extracted ${pages.length} pages.`);

    const model = getGeminiModel('gemini-2.0-flash');

    console.log('[PageIndex] Building document structure...');
    const { doc_name, doc_description, structure } = await buildStructure(pages, model);

    console.log('[PageIndex] Adding summaries to sections...');
    await addSummaries(structure, pages, model);

    const finalName = titleOverride?.trim() || doc_name;
    const finalDesc = descriptionOverride?.trim() || doc_description;

    const docId = uuidv4();
    const doc: PageIndexDocument = {
      id: docId,
      type: 'pdf',
      path: absPath,
      doc_name: finalName,
      doc_description: finalDesc,
      page_count: pages.length,
      structure,
      pages: pages.map((content, i) => ({ page: i + 1, content })),
    };

    saveDocument(this.workspace, doc);

    // Cache in memory (without heavy pages array)
    this.documents.set(docId, {
      id: docId,
      type: 'pdf',
      doc_name: finalName,
      doc_description: finalDesc,
      path: absPath,
      page_count: pages.length,
    });

    console.log(`[PageIndex] Indexing complete. Document ID: ${docId}`);
    return docId;
  }

  /**
   * List all indexed documents (lightweight metadata only).
   */
  listDocuments(): Array<{ id: string; doc_name: string; doc_description: string; path: string; page_count: number }> {
    return Array.from(this.documents.values()).map((d) => ({
      id: d.id,
      doc_name: d.doc_name,
      doc_description: d.doc_description,
      path: d.path,
      page_count: d.page_count,
    }));
  }

  /**
   * Return document metadata as JSON string.
   */
  getDocument(docId: string): string {
    const doc = this.documents.get(docId);
    if (!doc) {
      return JSON.stringify({ error: `Document ${docId} not found` });
    }
    return JSON.stringify({
      doc_id: docId,
      doc_name: doc.doc_name,
      doc_description: doc.doc_description,
      type: 'pdf',
      status: 'completed',
      page_count: doc.page_count,
    });
  }

  /**
   * Return the document's tree structure as JSON string (text fields excluded to save tokens).
   */
  getDocumentStructure(docId: string): string {
    this.ensureLoaded(docId);
    const doc = this.documents.get(docId) as any;
    if (!doc) {
      return JSON.stringify({ error: `Document ${docId} not found` });
    }
    const structure = doc.structure || [];
    return JSON.stringify(stripTextFields(structure), null, 2);
  }

  /**
   * Return page content for a pages string (e.g. '5-7', '3,8', '12').
   */
  getPageContent(docId: string, pages: string): string {
    this.ensureLoaded(docId);
    const doc = this.documents.get(docId) as any;
    if (!doc) {
      return JSON.stringify({ error: `Document ${docId} not found` });
    }

    let pageNums: number[];
    try {
      pageNums = parsePages(pages);
    } catch (err) {
      return JSON.stringify({ error: `Invalid pages format "${pages}": ${err}` });
    }

    const cachedPages: Array<{ page: number; content: string }> = doc.pages || [];
    if (cachedPages.length > 0) {
      const pageMap = new Map(cachedPages.map((p) => [p.page, p.content]));
      const result = pageNums
        .filter((n) => pageMap.has(n))
        .map((n) => ({ page: n, content: pageMap.get(n)! }));
      return JSON.stringify(result, null, 2);
    }

    // Fallback: re-extract from disk
    try {
      const pageTextsPromise = extractPagesText(doc.path);
      // Synchronous fallback is not ideal; return error suggesting re-index
      return JSON.stringify({
        error: 'Page content not cached. Re-index the document or use get_document_structure.',
      });
    } catch (err) {
      return JSON.stringify({ error: `Failed to read pages: ${err}` });
    }
  }

  /**
   * Remove a document from the index.
   */
  deleteDocument(docId: string): boolean {
    if (!this.documents.has(docId)) return false;

    const docPath = path.join(this.workspace, `${docId}.json`);
    if (fs.existsSync(docPath)) fs.unlinkSync(docPath);

    this.documents.delete(docId);

    // Update meta
    const metaPath = path.join(this.workspace, META_INDEX);
    const meta = readJSON<Record<string, MetaEntry>>(metaPath) || {};
    delete meta[docId];
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    return true;
  }
}

// Singleton instance
let _instance: PageIndexService | null = null;

export function getPageIndexService(): PageIndexService {
  if (!_instance) {
    _instance = new PageIndexService();
  }
  return _instance;
}
