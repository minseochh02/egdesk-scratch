import { generateTextWithAI, getGoogleApiKey, generateStructuredText } from '../gemini';
import { WebsiteSummary } from './company-research-stage2';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import * as cheerio from 'cheerio';
import { fetch } from 'undici';

/**
 * Stage 3: Agentic Research
 * Translated from companyreport/Code.js
 */

export interface ResearchTopic {
  topic: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface ResearchResult {
  topic: string;
  findings: string;
  sources: Array<{ title: string; url: string }>;
  groundingChunks?: GroundingChunk[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title?: string;
  };
}

export interface AgenticResearchData {
  domain: string;
  topics: ResearchTopic[];
  validatedFindings: Array<{ validatedFinancials: string; confidenceLevel: 'high' | 'medium' | 'low'; validatedURLs: Array<{ url: string; title: string }>; urlAnalysis: Array<{ url: string; reason: string }> }>;
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
 * Save research result to disk
 */
function saveResearchResult(domain: string, result: AgenticResearchData) {
  try {
    const fileName = `${domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_research.json`;
    const filePath = path.join(getCacheDir(), fileName);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    console.log(`[Research] Result saved to: ${filePath}`);
  } catch (error) {
    console.error(`[Research] Failed to save result:`, error);
  }
}

/**
 * Load research result from disk if it exists and is not too old (e.g., 1 day)
 */
function loadResearchResult(domain: string): AgenticResearchData | null {
  try {
    const fileName = `${domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_research.json`;
    const filePath = path.join(getCacheDir(), fileName);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      if (stats.mtimeMs > oneDayAgo) {
        const data = fs.readFileSync(filePath, 'utf8');
        const result = JSON.parse(data);
        result.cached = true;
        console.log(`[Research] Loaded cached result from: ${filePath}`);
        return result;
      }
    }
  } catch (error) {
    console.warn(`[Research] Failed to load cached result:`, error);
  }
  return null;
}

/**
 * Main Stage 3 Function: Agentic Research (Giron Pattern)
 */
export async function executeAgenticResearch(domain: string, summary: WebsiteSummary, bypassCache: boolean = false): Promise<AgenticResearchData | null> {
  // Try to load from cache first unless bypassed
  if (!bypassCache) {
    const cachedResult = loadResearchResult(domain);
    if (cachedResult) {
      return cachedResult;
    }
  }

  try {
    const { apiKey } = getGoogleApiKey();
    if (!apiKey) throw new Error('Google API Key not found');

    // 1. Coordinator: Plan research topics
    console.log(`[Research] Planning initial topics for ${domain}...`);
    let topics = await coordinateResearch(domain, summary, apiKey);
    const allValidatedFindings: Array<{ validatedFinancials: string; confidenceLevel: 'high' | 'medium' | 'low'; validatedURLs: Array<{ url: string; title: string }>; urlAnalysis: Array<{ url: string; reason: string }> }> = [];
    
    // Agentic Loop (Max 2 iterations for completeness check)
    for (let iteration = 1; iteration <= 2; iteration++) {
      console.log(`[Research] [Iteration ${iteration}] Executing research for ${topics.length} topics...`);
      
      const iterationValidatedFindings: Array<{ validatedFinancials: string; confidenceLevel: 'high' | 'medium' | 'low'; validatedURLs: Array<{ url: string; title: string }>; urlAnalysis: Array<{ url: string; reason: string }> }> = [];
      for (const topic of topics) {
        console.log(`[Research] Investigating topic: ${topic.topic}...`);
        const finding = await investigateTopic(domain, topic, summary.companyName, apiKey);
        
        if (finding) {
          // 3-Validation: Validate finding
          const validatedFinding = await validateFinding(domain, summary, finding, apiKey);
          if (validatedFinding) {
            iterationValidatedFindings.push(validatedFinding);
          }
        }
      }

      allValidatedFindings.push(...iterationValidatedFindings);

      // 3-Check: Completeness check
      console.log(`[Research] [Iteration ${iteration}] Checking completeness...`);
      const check = await checkResearchCompleteness(domain, summary, allValidatedFindings, apiKey);
      
      if (check.isComplete || iteration >= 2) {
        console.log(`[Research] Research complete${check.isComplete ? ' (AI verified)' : ' (Max iterations reached)'}.`);
        break;
      } else {
        console.log(`[Research] Research incomplete. Next topics: ${check.nextTopics.map(t => t.topic).join(', ')}`);
        topics = check.nextTopics;
      }
    }

    const finalResult: AgenticResearchData = {
      domain,
      topics, // Last set of topics
      validatedFindings: allValidatedFindings
    };

    saveResearchResult(domain, finalResult);
    return finalResult;
  } catch (error: any) {
    console.error(`[Research] Error during agentic research for ${domain}:`, error);
    return null;
  }
}

/**
 * Step 3-Validation: Confirm findings belong to the company
 */
async function validateFinding(domain: string, websiteSummary: WebsiteSummary, financialResearchResult: ResearchResult, apiKey: string): Promise<{ validatedFinancials: string; confidenceLevel: 'high' | 'medium' | 'low'; validatedURLs: Array<{ url: string; title: string }>; urlAnalysis: Array<{ url: string; reason: string }> } | null> {
  try {
    const rawURLs = financialResearchResult.groundingChunks
      ?.filter(chunk => chunk.web && chunk.web.uri)
      .map(chunk => ({
        title: chunk.web?.title || '',
        uri: chunk.web!.uri
      })) || [];

    console.log(`[Validation] Resolving redirects for ${rawURLs.length} URLs...`);

    const finalURLs: Array<{ originalURI: string; title: string; finalURL: string }> = [];
    const requests = rawURLs.map(urlData =>
      fetch(urlData.uri, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } })
    );

    const responses = await Promise.all(requests);

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const urlData = rawURLs[i];
      let resolvedURL = urlData.uri;

      if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
        resolvedURL = response.headers.get('location')!;
        console.log(`    ${i + 1}/${responses.length}: ${response.status} -> ${resolvedURL.substring(0, 80)}...`);
      } else if (response.status === 200) {
        resolvedURL = urlData.uri;
        console.log(`    ${i + 1}/${responses.length}: 200 OK (no redirect)`);
      } else {
        console.log(`    ${i + 1}/${responses.length}: ${response.status} (unexpected status)`);
      }
      finalURLs.push({
        originalURI: urlData.uri,
        title: urlData.title,
        finalURL: resolvedURL
      });
    }

    const companyNameMatch = websiteSummary.companyName || domain;

    const prompt = `You are a data validation expert. Your task is to analyze each URL below and determine which pages contain information about the CORRECT COMPANY.\n\n==================================================\nCOMPANY INFORMATION (from crawling ${domain}):\n==================================================\nCompany Name: ${companyNameMatch}\nDomain: ${domain}\n\n${JSON.stringify(websiteSummary, null, 2)}\n\n==================================================\nFINANCIAL INFORMATION (from Google Search - organized by source):\n==================================================\n${financialResearchResult.findings}\n\n==================================================\nURLS TO VALIDATE (Analyze to verify company match):\n==================================================\n\n${finalURLs.map((urlData, idx) => `\n${idx + 1}. ${urlData.finalURL}\n   Title: ${urlData.title}\n`).join('\n')}\n\n==================================================\nVALIDATION INSTRUCTIONS:\n==================================================\n\n**YOUR TASK**: Analyze each URL above and determine which pages contain information about "${companyNameMatch}" (the CORRECT COMPANY).\n\nFor each URL above:\n\n1. **Check if the URL is about "${companyNameMatch}"** (at ${domain})\n   - Compare the financial data content with the website summary\n   - Look for matching: company name, industry, location, products\n\n2. **KEEP URLs that**:\n   - Contain information about "${companyNameMatch}"\n   - Are from third-party sources (JobKorea, Saramin, JobPlanet, etc.)\n   - Match the company identity from the website summary\n\n3. **REMOVE URLs that**:\n   - Are from the company's own website (any URL containing "${domain}")\n   - Mention a DIFFERENT company (e.g., different business with similar name)\n   - Are generic or unrelated\n\n4. **Output**:\n   - List of validated URLs to fetch in the next stage\n   - Analysis of why each URL was kept or removed\n\n==================================================\nOUTPUT FORMAT (JSON):\n==================================================\n\nReturn a JSON object with the following structure:\n\n{\n  \"validatedFinancials\": \"Clean financial information with only verified data from sources with Company Identity: YES\",\n  \"confidenceLevel\": \"high/medium/low - overall confidence in the validated data\",\n  \"validatedURLs\": [\n    {\n      \"url\": \"https://www.jobkorea.co.kr/Recruit/Co_Read/C/example123\",\n      \"title\": \"JobKorea 기업 채용정보\"\n    },\n    {\n      \"url\": \"https://www.jobplanet.co.kr/companies/example/...\",\n      \"title\": \"JobPlanet 기업정보\"\n    }\n  ],\n  \"urlAnalysis\": [\n    {\n      \"url\": \"Full URL from grounding sources\",\n      \"reason\": \"Reason for keeping or removing\"\n    }\n  ]\n}\n`;

  const responseSchema = {
    type: "object",
    properties: {
        validatedFinancials: { type: "string" },
        confidenceLevel: { type: "string", enum: ["high", "medium", "low"] },
        validatedURLs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              url: { type: "string" },
              title: { type: "string" }
            },
            required: ["url", "title"]
          }
        },
        urlAnalysis: {
          type: "array",
          items: {
            type: "object",
            properties: {
              url: { type: "string" },
              reason: { type: "string" }
    },
            required: ["url", "reason"]
          }
        }
      },
      required: ["validatedFinancials", "confidenceLevel", "validatedURLs", "urlAnalysis"]
  };

    const result = await generateTextWithAI({
      prompt,
      model: 'gemini-2.5-flash-lite', 
      temperature: 0.1,
      apiKey,
      responseSchema,
      parseJson: true
    });

    return result.json as any; 

  } catch (error) {
    console.error(`[Research] Validation failed:`, error);
    return null;
  }
}

/**
 * Step 3-Check: Evaluate research completeness
 */
async function checkResearchCompleteness(
  domain: string, 
  summary: WebsiteSummary, 
  validatedFindings: Array<{ validatedFinancials: string; confidenceLevel: 'high' | 'medium' | 'low'; validatedURLs: Array<{ url: string; title: string }>; urlAnalysis: Array<{ url: string; reason: string }> }>, 
  apiKey: string
): Promise<{ isComplete: boolean, nextTopics: ResearchTopic[] }> {
  const prompt = `당신은 기업 분석 보고서 작성을 위한 리서치 품질 관리자입니다.

아래는 **${domain}** 기업에 대해 현재까지 수집된 리서치 결과입니다. 이 정보를 바탕으로 상세 분석 보고서를 작성하기에 정보가 충분한지 평가하고, 부족하다면 추가로 조사해야 할 주제를 제안해 주세요.

**웹사이트 홈페이그 내용 요약 (200자 내외)**:
${summary.rawSummary ? summary.rawSummary.substring(0, 200) + '...' : '정보 없음'}

**현재까지 수집된 리서치 결과**: 
${validatedFindings.map(f => `[Validated Financials: ${f.validatedFinancials.substring(0, 100)}...] Confidence: ${f.confidenceLevel}`).join('\n')}

**평가 기준**:
- **충분한 정보**: 재무 상태 (매출, 수익성, 투자 유치 등), 최근 1년 내 주요 뉴스/이슈, 기업의 대외적 평판 (언론, 채용 리뷰), 시장 내 경쟁력 등이 충분히 확보되었는가?
- **부족한 정보**: 위에 언급된 정보 중 아직 부족하거나 심층 조사가 필요한 부분이 있는가?

**출력 형식**: JSON
{
  "isComplete": true/false,
  "reason": "평가 이유",
  "nextTopics": [
    { "topic": "추가 조사 필요 주제", "priority": "high/medium/low", "reason": "이유" }
  ]
}
결과가 없으면 nextTopics는 빈 배열로 반환합니다.
`;

  const responseSchema = {
    type: "object",
    properties: {
      isComplete: { type: "boolean" },
      reason: { type: "string" },
      nextTopics: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topic: { type: "string" },
            priority: { type: "string" },
            reason: { type: "string" }
          },
          required: ["topic", "priority", "reason"]
        }
      }
    },
    required: ["isComplete", "reason", "nextTopics"]
  };

  try {
    const result = await generateTextWithAI({
      prompt,
      model: 'gemini-2.5-flash',
      temperature: 0.2,
      apiKey,
      responseSchema,
      parseJson: true
    });

    return {
      isComplete: result.json?.isComplete ?? true,
      nextTopics: result.json?.nextTopics ?? []
    };
  } catch (error) {
    console.error(`[Research] Completeness check failed:`, error);
    return { isComplete: true, nextTopics: [] };
  }
}

/**
 * Step 3-Coordinator: Decide what needs to be researched
 */
async function coordinateResearch(domain: string, summary: WebsiteSummary, apiKey: string): Promise<ResearchTopic[]> {
  const prompt = `You are a research strategy coordinator.

**Company**: ${domain}

**Homepage Content** (structured, ${JSON.stringify(summary, null, 2).length} chars):
${JSON.stringify(summary, null, 2)}

**Report Template Requirements**:
## 최종 보고서 필수 섹션:
1. Company Overview
2. Business Areas & Products/Services
3. Key Projects & Achievements
4. Contact Information
5. Company Size & Credibility (직원 수, 연혁, 인증)
6. Financial Information (매출, 영업이익, 순이익, 신용등급)
7. Overall Assessment (강점, 경쟁력, B2B 적합성)

---

**YOUR TASK**: Analyze the homepage content and determine what additional information needs to be researched from external web sources to complete ALL sections of the report template.

**Instructions**:
1. Review what information is ALREADY available in the homepage content
2. Identify what information is MISSING for each report section
3. Generate specific research topics for missing information
4. Prioritize topics by importance (high/medium/low)

**Use the generateResearchTopics function to output your research plan.**

Focus on topics that require external third-party sources (not company's own website):
- Financial data (revenue, profit, credit rating)
- Employee count and benefits
- Industry rankings and comparisons
- Third-party certifications and awards
- Major clients and projects (if not on homepage)
- Market analysis and competitive positioning
`;

  const responseSchema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        topic: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        reason: { type: "string" }
      },
      required: ["topic", "priority", "reason"]
    }
  };

  const result = await generateTextWithAI({
    prompt,
    model: 'gemini-2.5-flash', // Updated to gemini-2.5-flash as requested
    temperature: 0.3,
    apiKey,
    responseSchema,
    parseJson: true
  });

  return result.json || [];
}

/**
 * Step 3-Loop: Investigate a single topic using Google Search Grounding
 */
async function investigateTopic(domain: string, topic: ResearchTopic, companyName: string, apiKey: string): Promise<ResearchResult | null> {
  const prompt = `당신은 전문 리서치 에이전트입니다. 다음 주제에 대해 심층 조사하여 보고해 주세요.
반드시 제공된 검색 도구를 사용하여 최신 정보를 확인하세요.

**조사 대상**: ${companyName} (${domain})
**조사 주제**: ${topic.topic}
**조사 의도**: ${topic.reason}

결과에는 구체적인 수치, 날짜, 출처가 포함되어야 합니다. 한국어로 답변해 주세요.
`;

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey });
    
    console.log(`[Research] Calling Gemini with Google Search Grounding for: ${topic.topic}...`);
    
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash", // Updated to gemini-2.5-flash as requested
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} } as any]
      }
    });

    const text = response.text || '';
    
    // Extract sources from grounding metadata if available
    const sources: Array<{ title: string; url: string }> = [];
    const metadata = (response as any).candidates?.[0]?.groundingMetadata;
    
    if (metadata?.groundingChunks) {
      metadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.url) {
          sources.push({
            title: chunk.web.title || chunk.web.url,
            url: chunk.web.url
          });
        }
      });
    }

    // Deduplicate sources
    const uniqueSources = Array.from(new Map(sources.map(s => [s.url, s])).values());

    return {
      topic: topic.topic,
      findings: text,
      sources: uniqueSources,
      groundingChunks: metadata?.groundingChunks || []
    };
  } catch (error) {
    console.error(`[Research] Investigation failed for ${topic.topic}:`, error);
    return null;
  }
}

