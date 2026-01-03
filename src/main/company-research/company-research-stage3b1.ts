import { generateTextWithAI, getGoogleApiKey } from '../gemini';
import { WebsiteSummary } from './company-research-stage2';
import { AgenticResearchData } from './company-research-stage3';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * Stage 3B-1: Detailed Report Generation
 * Synthesizes Website Summary and Agentic Research into a comprehensive report.
 */

export interface DetailedReport {
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
 * Save detailed report to disk
 */
function saveDetailedReport(domain: string, result: DetailedReport) {
  try {
    const fileName = `${domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report_detailed.json`;
    const filePath = path.join(getCacheDir(), fileName);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    console.log(`[Report 3B1] Result saved to: ${filePath}`);
  } catch (error) {
    console.error(`[Report 3B1] Failed to save result:`, error);
  }
}

/**
 * Load detailed report from disk
 */
function loadDetailedReport(domain: string): DetailedReport | null {
  try {
    const fileName = `${domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report_detailed.json`;
    const filePath = path.join(getCacheDir(), fileName);
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const result = JSON.parse(data);
      result.cached = true;
      return result;
    }
  } catch (error) {
    console.warn(`[Report 3B1] Failed to load cached result:`, error);
  }
  return null;
}

/**
 * Main Stage 3B-1 Function: Generate Detailed Report
 */
export async function generateDetailedReport(
  domain: string, 
  summary: WebsiteSummary, 
  research: AgenticResearchData,
  inquiryData: any, // Assuming inquiryData type for now
  bypassCache: boolean = false
): Promise<DetailedReport | null> {
  if (!bypassCache) {
    const cached = loadDetailedReport(domain);
    if (cached) return cached;
  }

  // Prepare data for the prompt
  const companyName = summary.companyName || domain;
  const inquiryInfo = inquiryData ? JSON.stringify(inquiryData, null, 2) : 'No specific inquiry information provided.';
  
  // Construct research content from validated findings
  // Each validated finding has: validatedFinancials, confidenceLevel, validatedURLs, urlAnalysis
  const researchContent = research.validatedFindings.map((finding, idx) => {
    const sourcesText = finding.validatedURLs?.map(urlObj => `- ${urlObj.title || urlObj.url} (${urlObj.url})`).join('\n') || 'No sources';
    
    return `
**Research Finding ${idx + 1}** (Confidence: ${finding.confidenceLevel || 'medium'})

${finding.validatedFinancials || 'No validated information available'}

**Sources:**
${sourcesText}
`;
  }).join('\n---\n');

  const prompt = `You are a professional sales intelligence analyst.

Create a **structured DETAILED REPORT IN KOREAN (한국어)** based on the following information:

---

**Inquiry Information:**
${inquiryInfo}

---

**Homepage Content** (Korean, structured):
${JSON.stringify(summary, null, 2)}

---

**Web Research Results** (English, by topic):
${researchContent}

---

Integrate the above information and create a **DETAILED ANALYSIS REPORT IN KOREAN (한국어)** in the following format. **Complete ALL sections**.
**IMPORTANT: Write the entire report in Korean language, including all section headings, content, and bullet points.**

# ${companyName} - 상세 분석 보고서

## 1. 회사 개요

**[Company Name]** is a [industry] company established in [year], operating for [X] years. Headquartered in [city, country], the company specializes in [core business focus]. [Add 1-2 sentences describing what they do and their market position].

**Key Milestones:**
- [Year]: [Milestone event]
- [Year]: [Milestone event]
- [Year]: [Milestone event]

(Write EACH milestone as a BULLET POINT on a SEPARATE line with dash and space)

## 2. 사업 분야 및 제품/서비스

The company operates in the [industry] sector, focusing on [business focus]. [1 sentence about their core competency or specialization].

**Core Products/Services:**
- [Product/Service 1]: [brief description]
- [Product/Service 2]: [brief description]
- [Product/Service 3]: [brief description]

**Target Markets:**
[Write 1-2 sentences about who they serve, key applications, and geographic markets - prose, NO bullets]

## 3. 재무 정보

**IF financial data available:**

**Revenue:**
The company reported revenue of [Amount] in [Year], [Amount] in [Year], and [Amount] in [Year]. [Add growth trend or change percentage if available]. (Write as prose sentences, NOT bullets)

**Financial Metrics:**
Operating profit stood at [amount] ([year]), with net income of [amount] ([year]). The company maintains [credit rating] credit rating. [Add equity ratio, debt ratio, or other metrics if available]. (Write as 1-2 prose sentences, NOT bullets)

**Listing Status:**
[Listed/Unlisted]. [If listed, add exchange and symbol in same sentence]

**IF NO financial data available:**
"Detailed financial information is not publicly available for this company."

## 4. 회사 규모 및 신뢰도

The company employs approximately [number] people as of [year] and has been operating for [X] years since [year]. [If applicable: add 1 sentence about locations/subsidiaries/global presence].

**Certifications & Recognition:**
[List key certifications, major clients, and awards as inline text separated by commas or semicolons - NOT bullets]

## 5. 주요 프로젝트 및 실적

**Major Clients** (if available):
- [Client 1]
- [Client 2]
- [Client 3]

**Certifications & Awards** (if available):
- [Certification/Award 1]
- [Certification/Award 2]
- [Certification/Award 3]

**Representative Projects** (if available):
[Write 1-2 sentences about key projects, their scope, and outcomes - prose, NOT bullets]

## 6. 종합 평가 및 추천

**Key Strengths:**
- [Strength 1 with brief explanation]
- [Strength 2 with brief explanation]
- [Strength 3 with brief explanation]

**Competitive Differentiation:**
[Write 2-3 sentences about what makes this company unique, their market position, and distinguishing factors - prose, NOT bullets]

**B2B Trade Suitability:**
The company demonstrates [assessment] reliability based on [reason], [assessment] technical capability evidenced by [reason], and [assessment] trade stability supported by [reason].

**Overall Recommendation: [Highly Suitable / Suitable / Moderate / Limited]**

[1-2 sentences explaining the reasoning based on financials, capabilities, and fit]

## 7. 문의 배경 분석

**What They Requested:**
[Quote or summarize the inquiry message content]

**Inferred Background & Needs:**
[Write 2-3 sentences about why they likely need this product/service based on their business areas, current projects, or market position]

**Related Business Areas:**
[Write 1-2 sentences about which parts of their business connect to this inquiry]

**Timing & Context:**
[If inferable: write 1-2 sentences about why now - new projects, expansion, technology upgrade, etc. If not inferable, write "Information not available"]

## 8. Supporting Information

**Primary Contact:**
- Email: [email if available]
- Phone: [phone if available]
- Address: [address if available]
- Fax: [fax if available]

(Write EACH contact field as a BULLET POINT on a SEPARATE line)

**Additional Contacts** (if available):
[Subsidiaries, regional offices, or alternative contacts]

**Company Background:**
[Write 2-3 sentences about detailed history, significant developments, company evolution, or other relevant background information]

---

**CRITICAL WRITING STYLE**:
- **Use bullets ONLY for true lists**: product lists, certifications list, key strengths list, contact fields
- **Use prose for everything else**: company overview, business description, financial metrics, assessments, inquiry analysis
- **Embed data in natural sentences**: "The company reported revenue of 13B KRW in 2022 (+18%)" NOT "- 2022: 13B KRW (+18%)"
- **Keep it concise**: 1-3 sentences per concept, NO long paragraphs
- **NO markdown tables**: Use prose or inline lists (Google Docs compatibility)
- **Balance**: About 30% bullets (true lists only), 70% prose (natural sentences)

---

**Writing Guidelines**:
1. **Fully integrate** all three sources: inquiry information + website summary + web research results
2. **Inquiry Context Analysis (Section 7)**: Use the inquiry message to infer why they need the requested product/service based on their business profile
3. Consolidate duplicate information across sections
4. Remove [ ] placeholders - if information is not available, state so (e.g., "Information not available")
5. Generate factual content. Do not generate example content, always generate based on actual data
6. Use a professional, objective tone
7. Focus on business-relevant facts for B2B trade
8. Final output must be **ONLY THE REPORT CONTENT**, no extra commentary or conversational text.`;

  try {
    const { apiKey } = getGoogleApiKey();
    if (!apiKey) throw new Error('Google API Key not found');

    console.log(`[Report 3B1] Generating detailed report for ${domain} using gemini-2.5-flash...`);
    const result = await generateTextWithAI({
      prompt,
      model: 'gemini-2.5-flash',
      temperature: 0.3, // Match Code.js temperature
      maxOutputTokens: 15000, // Korean text requires more tokens
      apiKey
    });

    const detailedReport = { content: result.text };
    saveDetailedReport(domain, detailedReport);
    return detailedReport;
  } catch (error: any) {
    console.error(`[Report 3B1] Error generating detailed report:`, error);
    return null;
  }
}

