import { generateTextWithAI, getGoogleApiKey } from '../gemini';
import { CrawlResult, ScrapedPage } from './company-research-stage1';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * Stage 2: Website Summary
 * Translated from companyreport/Code.js
 */

export interface WebsiteSummary {
  companyName: string;
  headquarters: string;
  establishedYear: string;
  businessFields: string[];
  productsServices: string[];
  majorProjects: string[];
  contactInfo: {
    email?: string;
    phone?: string;
    address?: string;
  };
  rawSummary: string;
  cached?: boolean;
}

/**
 * Get the cache directory for company research results
 */
function getCacheDir(): string {
  const baseDir = app.getPath('userData');
  const cacheDir = path.join(baseDir, 'company-research-cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

/**
 * Save summary result to disk
 */
function saveSummaryResult(domain: string, result: WebsiteSummary) {
  try {
    const fileName = `${domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.json`;
    const filePath = path.join(getCacheDir(), fileName);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    console.log(`[Summary] Result saved to: ${filePath}`);
  } catch (error) {
    console.error(`[Summary] Failed to save result:`, error);
  }
}

/**
 * Load summary result from disk if it exists and is not too old (e.g., 1 day)
 */
function loadSummaryResult(domain: string): WebsiteSummary | null {
  try {
    const fileName = `${domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.json`;
    const filePath = path.join(getCacheDir(), fileName);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      if (stats.mtimeMs > oneDayAgo) {
        const data = fs.readFileSync(filePath, 'utf8');
        const result = JSON.parse(data);
        result.cached = true;
        console.log(`[Summary] Loaded cached result from: ${filePath}`);
        return result;
      }
    }
  } catch (error) {
    console.warn(`[Summary] Failed to load cached result:`, error);
  }
  return null;
}

/**
 * Main Stage 2 Function: Summarize Website Content
 */
export async function summarizeWebsiteContent(crawlResult: CrawlResult, bypassCache: boolean = false): Promise<WebsiteSummary | null> {
  const { domain, pages } = crawlResult;
  
  if (!pages || pages.length === 0) {
    console.warn(`[Summary] No pages to summarize for ${domain}`);
    return null;
  }

  // Try to load from cache first unless bypassed
  if (!bypassCache) {
  const cachedResult = loadSummaryResult(domain);
  if (cachedResult) {
    return cachedResult;
    }
  }

  // Combine content from all pages, with a limit to avoid token overflow
  // Prioritize homepage and shallow pages
  const sortedPages = [...pages].sort((a, b) => a.depth - b.depth);
  const consolidatedContent = pages.map((page, idx) =>
    `\n=== 페이지 ${idx + 1}: ${page.title} ===\nURL: ${page.url}\n\n${page.content}`
  ).join('\n\n---\n\n');

  const prompt = `당신은 기업 웹사이트 분석 전문가입니다.

아래는 **${domain}** 웹사이트에서 수집한 **${pages.length}개 페이지**의 전체 내용입니다.

${consolidatedContent}

---

위 내용을 **구조화하고 정리**하세요. (요약 말고 재구성 - 중복 제거, 흐름 개선, 상세 내용 유지)

**작업 목표**:
- ❌ 요약 (내용 축약 금지)
- ✅ 구조화 (섹션별 정리)
- ✅ 중복 제거 (같은 내용 여러 페이지 반복 시)
- ✅ 흐름 개선 (읽기 쉽게)
- ✅ 상세 유지 (제품 설명, 기술 스펙, 프로젝트 등 모두 포함)

## 1. 회사 기본 정보
- **정식 회사명**: [Full legal name]
- **공식 웹사이트**: ${domain}
- **본사 국가**: [국가명만 - 예: 한국, 미국, 일본, 독일 등] ← **필수 항목! 웹사이트에서 찾을 수 없으면 도메인(.kr, .com 등)과 언어로 추론**
- **본사 위치**: [도시, 상세 주소]
- **설립 연도**: [년도]
- **주요 연혁**: [모든 마일스톤 나열 - 축약 금지]

## 2. 사업 분야 및 제품/서비스
- **주요 산업 분야**: [상세 설명]
- **핵심 제품/서비스**: [모든 제품/서비스 나열 - 축약 금지. 기술 스펙 포함]
- **기술 역량**: [보유 기술, 전문성, R&D 역량 상세]
- **타겟 시장**: [주요 시장, 고객군, 적용 분야 상세]

## 3. 주요 프로젝트 및 실적
- **대표 프로젝트**: [모든 프로젝트 나열 - 축약 금지]
- **주요 고객사**: [모든 고객사 나열]
- **인증 및 수상**: [모든 인증, 수상 경력 나열 - ISO, 특허, 정부 인증 등]

## 4. 연락처 정보
- **이메일**: [모든 이메일 주소]
- **전화번호**: [모든 전화번호]
- **주소**: [본사 + 지사/해외 오피스 모두]
- **기타**: [소셜 미디어, 대표자, 추가 연락처]

**작성 지침**:
1. 웹사이트에 명시된 **모든 사실** 포함 (축약 금지)
2. 중복 내용만 제거 (같은 정보 여러 페이지 반복 시)
3. 추측하지 마세요
4. 한글로 작성하세요 (회사명, URL 등 고유명사 제외)
5. 읽기 쉽게 구조화하되 **상세 내용 유지**
6. **재무 정보(매출, 직원 수, 신용등급 등)는 제외** - 다음 단계에서 조사합니다`;

  const responseSchema = {
    type: "object",
    properties: {
      companyName: { type: "string" },
      headquarters: { type: "string" },
      establishedYear: { type: "string" },
      businessFields: { type: "array", items: { type: "string" } },
      productsServices: { type: "array", items: { type: "string" } },
      majorProjects: { type: "array", items: { type: "string" } },
      contactInfo: {
        type: "object",
        properties: {
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" }
        }
      },
      rawSummary: { type: "string" }
    },
    required: ["companyName", "headquarters", "establishedYear", "businessFields", "productsServices", "majorProjects", "contactInfo", "rawSummary"]
  };

  try {
    const { apiKey } = getGoogleApiKey();
    if (!apiKey) {
      throw new Error('Google API Key not found');
    }

    console.log(`[Summary] Generating summary for ${domain} using gemini-2.5-flash-lite...`);
    const result = await generateTextWithAI({
      prompt,
      model: 'gemini-2.5-flash-lite',
      temperature: 0.2,
      apiKey,
      responseSchema, // Use schema for structured output
      parseJson: true
    });

    if (result.json) {
      const summaryResult = result.json as WebsiteSummary;
      saveSummaryResult(domain, summaryResult);
      return summaryResult;
    } else {
      console.warn('[Summary] Failed to parse JSON response, falling back to raw text');
      const fallbackResult = {
        companyName: 'Unknown',
        headquarters: 'Unknown',
        establishedYear: 'Unknown',
        businessFields: [],
        productsServices: [],
        majorProjects: [],
        contactInfo: {},
        rawSummary: result.text
      };
      saveSummaryResult(domain, fallbackResult);
      return fallbackResult;
    }
  } catch (error: any) {
    console.error(`[Summary] Error during summary for ${domain}:`, error);
    return null;
  }
}

