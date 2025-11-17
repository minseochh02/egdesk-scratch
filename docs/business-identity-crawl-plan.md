# Business Identity Web Crawl & Analysis Plan

## Overview
Enhance the business identity system to crawl and analyze multiple pages from a business website, not just the homepage. This will provide a more comprehensive understanding of the business.

## Typical Business Website Structure

### 1. **Core Pages (High Priority)**
These pages are found on almost every business website and contain critical identity information:

#### Homepage (`/` or `/index`)
- **Purpose**: Main entry point, brand overview
- **Key Info**: Value proposition, hero messaging, primary CTA
- **Priority**: ✅ Always crawl

#### About Us (`/about`, `/about-us`, `/company`, `/our-story`)
- **Purpose**: Company history, mission, vision, values
- **Key Info**: Founding story, team, company culture, values
- **Priority**: ✅ High priority - essential for identity

#### Contact (`/contact`, `/contact-us`, `/get-in-touch`)
- **Purpose**: Contact information, location, support
- **Key Info**: 
  - Physical address (reveals location, market focus)
  - Phone numbers (business hours, timezone)
  - Email addresses (department structure)
  - Contact forms (what they want to know)
- **Priority**: ✅ High priority - reveals operational details

#### Products/Services (`/products`, `/services`, `/solutions`, `/offerings`)
- **Purpose**: What the business sells
- **Key Info**: 
  - Product/service categories
  - Pricing models (if public)
  - Feature descriptions
  - Use cases
- **Priority**: ✅ High priority - core business offering

### 2. **Secondary Pages (Medium Priority)**
Important but not always present:

#### Blog/News (`/blog`, `/news`, `/articles`, `/insights`)
- **Purpose**: Content marketing, thought leadership
- **Key Info**: 
  - Topics they write about (expertise areas)
  - Writing style and tone
  - Target audience interests
- **Priority**: ⚠️ Medium - reveals content strategy

#### Careers/Jobs (`/careers`, `/jobs`, `/join-us`, `/we-are-hiring`)
- **Purpose**: Recruitment, company culture
- **Key Info**: 
  - Company culture description
  - Benefits and perks
  - Growth stage indicators
  - Team size hints
- **Priority**: ⚠️ Medium - reveals culture and growth

#### Case Studies (`/case-studies`, `/portfolio`, `/work`, `/projects`)
- **Purpose**: Social proof, client examples
- **Key Info**: 
  - Client types (target market)
  - Success metrics
  - Industry focus
- **Priority**: ⚠️ Medium - reveals client base

#### Pricing (`/pricing`, `/plans`, `/packages`)
- **Purpose**: Pricing information
- **Key Info**: 
  - Pricing model (subscription, one-time, etc.)
  - Target market segment (enterprise vs SMB)
  - Feature tiers
- **Priority**: ⚠️ Medium - reveals business model

### 3. **Support & Resources (Lower Priority)**
Useful for completeness:

#### Help/Support (`/help`, `/support`, `/faq`)
- **Purpose**: Customer support
- **Key Info**: Common questions, support channels
- **Priority**: ⚠️ Low - operational info

#### Resources (`/resources`, `/downloads`, `/whitepapers`)
- **Purpose**: Educational content
- **Key Info**: Content themes, expertise areas
- **Priority**: ⚠️ Low - supplementary

#### Legal (`/privacy`, `/terms`, `/legal`)
- **Purpose**: Legal compliance
- **Key Info**: Business structure, jurisdiction
- **Priority**: ⚠️ Low - rarely useful for identity

### 4. **E-commerce Specific Pages**
For online stores:

#### Shop/Store (`/shop`, `/store`, `/products`)
- **Purpose**: Product catalog
- **Key Info**: Product categories, pricing, inventory
- **Priority**: ✅ High (if e-commerce site)

#### Cart/Checkout (`/cart`, `/checkout`)
- **Purpose**: Purchase flow
- **Key Info**: Payment methods, shipping options
- **Priority**: ⚠️ Low - functional pages

### 5. **Industry-Specific Pages**
Varies by industry:

#### For SaaS/Tech:
- `/features` - Product capabilities
- `/integrations` - Ecosystem connections
- `/api` or `/developers` - Technical audience
- `/security` - Trust signals

#### For Agencies/Consultancies:
- `/services` - Service offerings
- `/clients` or `/testimonials` - Social proof
- `/team` - People behind the business

#### For E-commerce:
- `/categories` - Product organization
- `/brands` - Brand partnerships
- `/reviews` - Customer feedback

## Link Discovery Strategy

### 1. **Navigation Menu Analysis**
- Extract all links from:
  - Main navigation (header)
  - Footer navigation
  - Mobile menu
  - Sidebar navigation

### 2. **Common Link Patterns**
Look for links containing:
- `/about*` - About pages
- `/contact*` - Contact pages
- `/product*`, `/service*` - Offerings
- `/blog*`, `/news*` - Content
- `/career*`, `/job*` - Hiring
- `/pricing*`, `/plan*` - Pricing
- `/case-study*`, `/portfolio*` - Examples
- `/help*`, `/support*`, `/faq*` - Support

### 3. **Footer Links**
Footer often contains:
- Company info links
- Legal pages
- Social media links
- Contact information

### 4. **Internal Link Analysis**
- Scan page content for internal links
- Build site map from link relationships
- Identify most linked-to pages (importance indicator)

## Data Structure for Crawled Content

```typescript
interface CrawledPage {
  url: string;
  path: string; // e.g., "/about"
  pageType: 'homepage' | 'about' | 'contact' | 'products' | 'blog' | 'careers' | 'pricing' | 'other';
  title: string;
  description?: string;
  content: {
    text: string;
    headings: string[]; // H1, H2, H3
    links: {
      internal: string[]; // Links to other pages on same domain
      external: string[]; // Links to other domains
    };
    images: {
      alt: string;
      src: string;
    }[];
    forms?: {
      type: string; // 'contact', 'newsletter', etc.
      fields: string[];
    }[];
  };
  metadata: {
    wordCount: number;
    language: string;
    lastModified?: string;
  };
  priority: 'high' | 'medium' | 'low';
}

interface WebsiteCrawlResult {
  domain: string;
  baseUrl: string;
  pages: CrawledPage[];
  siteStructure: {
    navigation: {
      main: string[];
      footer: string[];
    };
    commonPages: {
      about?: string;
      contact?: string;
      products?: string;
      blog?: string;
      careers?: string;
      pricing?: string;
    };
  };
  insights: {
    industry?: string;
    businessModel?: string; // 'saas', 'ecommerce', 'agency', etc.
    targetMarket?: string; // 'b2b', 'b2c', 'b2b2c'
    languages: string[];
  };
}
```

## Enhanced Business Identity Schema

After crawling, the AI should analyze:

```typescript
interface EnhancedBusinessIdentity {
  // Existing fields...
  coreIdentity: string;
  brandCategory: string;
  targetAudience: string;
  toneVoice: string;
  signatureProof: string;
  
  // New fields from multi-page analysis:
  businessModel: {
    type: 'saas' | 'ecommerce' | 'agency' | 'consultancy' | 'marketplace' | 'other';
    details: string;
  };
  
  companyInfo: {
    location?: string; // From contact page
    size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
    stage?: 'early' | 'growth' | 'mature';
    culture?: string; // From about/careers pages
    values?: string[]; // From about page
  };
  
  offerings: {
    products?: string[];
    services?: string[];
    pricingModel?: string;
    keyFeatures?: string[];
  };
  
  contentStrategy: {
    blogTopics?: string[];
    contentThemes?: string[];
    thoughtLeadership?: string[];
  };
  
  contactInfo: {
    email?: string;
    phone?: string;
    address?: string;
    socialMedia?: {
      platform: string;
      url: string;
    }[];
  };
  
  siteStructure: {
    keyPages: string[];
    navigationPattern: string;
    userJourney?: string;
  };
}
```

## Implementation Phases

### Phase 1: Basic Multi-Page Crawl
1. Crawl homepage
2. Extract navigation links
3. Crawl top 3-5 most important pages (About, Contact, Products)
4. Combine content for AI analysis

### Phase 2: Smart Page Discovery
1. Pattern matching for common page types
2. Priority-based crawling (high → medium → low)
3. Limit total pages (e.g., max 10 pages)
4. Respect robots.txt

### Phase 3: Deep Analysis
1. Analyze page relationships
2. Extract structured data (contact forms, product listings)
3. Identify business model from patterns
4. Build comprehensive identity profile

### Phase 4: Advanced Features
1. Multi-language detection
2. E-commerce product catalog analysis
3. Blog content theme extraction
4. Social media link discovery

## Technical Considerations

### Crawling Limits
- **Max pages**: 10-15 pages per site
- **Max depth**: 2-3 levels from homepage
- **Timeout**: 30 seconds per page
- **Rate limiting**: 1 request per second

### Error Handling
- Handle 404s gracefully
- Skip non-HTML content
- Handle redirects
- Respect robots.txt

### Performance
- Parallel crawling (with limits)
- Cache results
- Incremental updates

## Example Crawl Flow

```
1. Start with homepage: example.com
   ├─ Extract navigation links
   ├─ Identify page types
   └─ Extract content

2. Discover key pages:
   ├─ /about → High priority
   ├─ /contact → High priority
   ├─ /products → High priority
   └─ /blog → Medium priority

3. Crawl discovered pages:
   ├─ Extract structured content
   ├─ Find additional links
   └─ Build site map

4. Analyze combined content:
   ├─ Business model detection
   ├─ Industry classification
   ├─ Target audience analysis
   └─ Generate comprehensive identity
```

