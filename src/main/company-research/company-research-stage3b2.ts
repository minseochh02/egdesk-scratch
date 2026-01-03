import { generateTextWithAI, getGoogleApiKey } from '../gemini';
import { WebsiteSummary } from './company-research-stage2';
import { AgenticResearchData } from './company-research-stage3';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * Stage 3B-2: Executive Summary Generation
 * Synthesizes data into a punchy, 30-second summary focused on concrete numbers.
 */

export interface ExecutiveSummary {
  content: string; // Markdown format
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
 * Save executive summary to disk
 */
function saveExecutiveSummary(domain: string, result: ExecutiveSummary) {
  try {
    const fileName = `${domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report_exec.json`;
    const filePath = path.join(getCacheDir(), fileName);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    console.log(`[Report 3B2] Result saved to: ${filePath}`);
  } catch (error) {
    console.error(`[Report 3B2] Failed to save result:`, error);
  }
}

/**
 * Load executive summary from disk
 */
function loadExecutiveSummary(domain: string): ExecutiveSummary | null {
  try {
    const fileName = `${domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report_exec.json`;
    const filePath = path.join(getCacheDir(), fileName);
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const result = JSON.parse(data);
      result.cached = true;
      return result;
    }
  } catch (error) {
    console.warn(`[Report 3B2] Failed to load cached result:`, error);
  }
  return null;
}

/**
 * Main Stage 3B-2 Function: Generate Executive Summary
 */
export async function generateExecutiveSummary(
  domain: string, 
  detailedReport: string, // Detailed report content (Markdown)
  inquiryData: any,     // Inquiry data
  summary: WebsiteSummary, 
  research: AgenticResearchData,
  bypassCache: boolean = false
): Promise<ExecutiveSummary | null> {
  if (!bypassCache) {
    const cached = loadExecutiveSummary(domain);
    if (cached) return cached;
  }

  const companyName = inquiryData.company || domain;

  const prompt = `You are a sales intelligence analyst creating an executive summary.

Read the detailed analysis report below and create a concise **Executive Summary IN KOREAN (한국어)** that sales teams can read in 30 seconds.

---

**Detailed Analysis Report:**
${detailedReport}

---

**CRITICAL WRITING STYLE FOR EXECUTIVE SUMMARY (핵심 작성 스타일)**:
- **FACTUAL (사실적) 요약 작성** - 구체적인 숫자와 데이터 포함 필수
- ❌ 나쁜 예: "꾸준한 매출 성장을 기록했으며"
- ✅ 좋은 예: "매출 100억원(2020년)에서 150억원(2022년)으로 50% 성장"
- ❌ 나쁜 예: "다수의 인증을 보유하고 있으며"
- ✅ 좋은 예: "ISO 9001 및 CE 인증 보유"
- ❌ 나쁜 예: "오랜 역사를 가진 기업으로"
- ✅ 좋은 예: "1980년 설립(44년 운영)"
- **구체적인 수치, 퍼센트, 날짜, 이름 포함 필수**
- **경영진이 관심 있는 NOTICEABLE FACTS에 집중**

예시:
- 회사 개요: "1980년 설립(44년), 직원 150명, 매출 200억원(2022년)"
- 재무 건전성: "매출 200억원(+15% YoY), 영업이익률 8%, 신용등급 AA"
- 핵심 강점: "스마트그리드 기술 특허 40+, 삼성/LG 파트너십"

---

Create an **Executive Summary** in the following format (한국어):

## ${companyName} 요약 정보

**회사 개요 (Company Profile)**
[Write 2-3 sentences with SPECIFIC FACTS: company name, industry, establishment year (and how many years), employees (number), headquarters, core business, revenue with year, growth trend with percentage]

**핵심 사업 및 역량 (Core Business & Capabilities)**
• [Main business area 1 - with specific technology/product names]
• [Main business area 2 - with specific capabilities]
• [Main business area 3 - with specific markets or applications]
• [Geographic reach or special capability - with specific locations or numbers]

**재무 건전성 (Financial Health)**
[Write 1-2 sentences with SPECIFIC NUMBERS: revenue trend with amounts and years, credit rating (if available), ownership structure, financial metrics]

**문의 배경 (Inquiry Context)**
[Write 2-3 sentences: what SPECIFIC product/service they requested, why they likely need it based on business profile, which business area it aligns with]

**핵심 강점 (Key Strengths)**
• [Strength 1 - brief, one line, with SPECIFIC facts]
• [Strength 2 - brief, one line, with SPECIFIC facts]
• [Strength 3 - brief, one line, with SPECIFIC facts]
• [Strength 4 if applicable - brief, one line, with SPECIFIC facts]

**주요 자격 및 인증 (Notable Credentials)**
• [Major certification with SPECIFIC name, key client with SPECIFIC name, or industry recognition with SPECIFIC award name]
• [Key project or achievement with SPECIFIC details]
• [Another notable credential if applicable with SPECIFIC facts]

---

**CRITICAL FORMATTING RULES**:
1. **Line breaks for bullets**: Each bullet point MUST be on a separate line
2. **Mix prose and bullets**: Use prose (1-3 sentences) for Company Profile, Financial Health, and Inquiry Context. Use bullets for lists.
3. **Be concise**: Each bullet should be ONE line only. Prose sections should be 1-3 sentences maximum.
4. **No recommendation**: Do NOT include recommendation in Executive Summary - that's in the detailed report
5. Final output must be **ONLY THE EXECUTIVE SUMMARY CONTENT**, no extra commentary or conversational text.`;

  try {
    const { apiKey } = getGoogleApiKey();
    if (!apiKey) throw new Error('Google API Key not found');

    console.log(`[Report 3B2] Generating executive summary for ${domain} using gemini-2.5-flash...`);
    const result = await generateTextWithAI({
      prompt,
      model: 'gemini-2.5-flash',
      temperature: 0.2, // Match Code.js temperature
      maxOutputTokens: 4000, // Prevent truncation
      apiKey
    });

    const execSummary = { content: result.text };
    saveExecutiveSummary(domain, execSummary);
    return execSummary;
  } catch (error: any) {
    console.error(`[Report 3B2] Error generating executive summary:`, error);
    return null;
  }
}

