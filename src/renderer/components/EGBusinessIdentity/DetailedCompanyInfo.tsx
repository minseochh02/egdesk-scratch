import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faPhone, faEnvelope, faMapMarkerAlt, faCube, faHandshake, faIndustry, faTrophy } from '../../utils/fontAwesomeIcons';
import ImageViewerModal from './ImageViewerModal';
import './DetailedCompanyInfo.css';

interface Product {
  name: string;
  kind: 'product' | 'service' | 'platform' | 'trade' | 'mixed';
  oneLineSummary?: string;
  canonicalLandingUrl?: string;
  canonicalHubUrl?: string;
  imageUrls?: string[];
  pageUrls?: string[];
}

interface ContactInfo {
  companyNameKo?: string;
  companyNameEn?: string;
  taglineFromAbout?: string;
  email?: string;
  addressKo?: string;
  phones?: {
    main?: string;
    trade?: string;
    sales?: string;
    [key: string]: string | undefined;
  };
}

interface CompanyStructure {
  summary?: string;
  divisionsKo?: string[];
  positioning?: {
    cfRe100?: string;
    fusionNarrative?: string;
    awardMention?: string;
    [key: string]: string | undefined;
  };
}

interface PartnersNetwork {
  tradeBrandsNamedOnHome?: string[];
  globalNetworkPage?: string;
  note?: string;
}

export interface DetailedCompanyData {
  contactAndLegal?: ContactInfo;
  companyStructure?: CompanyStructure;
  centralServicesAndProducts?: Product[];
  partnersAndNetwork?: PartnersNetwork;
  targetIndustriesMentioned?: string[];
}

interface DetailedCompanyInfoProps {
  data?: DetailedCompanyData;
  productsWithImages?: {
    items: Array<{
      name: string;
      kind: string;
      allImageUrls: string[];
      pages: Array<{
        pageUrl: string;
        imageUrls: string[];
      }>;
    }>;
  };
}

const DetailedCompanyInfo: React.FC<DetailedCompanyInfoProps> = ({ data, productsWithImages }) => {
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    productName: string;
    imageUrl: string;
  }>({ isOpen: false, productName: '', imageUrl: '' });

  if (!data) {
    return (
      <section className="egdesk-bi-detailed-company egdesk-bi-detailed-company--empty" data-egdesk-bi-detailed-company>
        <div className="egdesk-bi-detailed-company__panel-header">
          <span className="egdesk-bi-detailed-company__icon">
            <FontAwesomeIcon icon={faBuilding} />
          </span>
          <div>
            <h2>Detailed Company Information</h2>
            <p>No detailed company data available yet. Run a deep site audit to extract comprehensive company information.</p>
          </div>
        </div>
      </section>
    );
  }

  const { contactAndLegal, companyStructure, centralServicesAndProducts, partnersAndNetwork, targetIndustriesMentioned } = data;

  // Merge product data with images if available
  const enrichedProducts = centralServicesAndProducts?.map(product => {
    const matchedProduct = productsWithImages?.items?.find(p => p.name === product.name);
    return {
      ...product,
      imageUrls: matchedProduct?.allImageUrls || [],
      pageUrls: matchedProduct?.pages?.map(page => page.pageUrl) || [],
    };
  });

  return (
    <div className="egdesk-bi-detailed-company" data-egdesk-bi-detailed-company>
      {/* Contact & Legal Information */}
      {contactAndLegal && (
        <section className="egdesk-bi-detailed-company__panel">
          <div className="egdesk-bi-detailed-company__panel-header">
            <span className="egdesk-bi-detailed-company__icon">
              <FontAwesomeIcon icon={faBuilding} />
            </span>
            <div>
              <h2>Contact & Legal Information</h2>
              <p>Company contact details and legal entity information</p>
            </div>
          </div>
          <div className="egdesk-bi-detailed-company__grid egdesk-bi-detailed-company__grid--2col">
            {contactAndLegal.companyNameKo && (
              <div className="egdesk-bi-detailed-company__item">
                <h4>Company Name (Korean)</h4>
                <p>{contactAndLegal.companyNameKo}</p>
              </div>
            )}
            {contactAndLegal.companyNameEn && (
              <div className="egdesk-bi-detailed-company__item">
                <h4>Company Name (English)</h4>
                <p>{contactAndLegal.companyNameEn}</p>
              </div>
            )}
            {contactAndLegal.taglineFromAbout && (
              <div className="egdesk-bi-detailed-company__item egdesk-bi-detailed-company__item--full">
                <h4>Tagline</h4>
                <p className="egdesk-bi-detailed-company__tagline">{contactAndLegal.taglineFromAbout}</p>
              </div>
            )}
            {contactAndLegal.email && (
              <div className="egdesk-bi-detailed-company__item">
                <h4><FontAwesomeIcon icon={faEnvelope} /> Email</h4>
                <p><a className="egdesk-bi-detailed-company__inline-link" href={`mailto:${contactAndLegal.email}`}>{contactAndLegal.email}</a></p>
              </div>
            )}
            {contactAndLegal.addressKo && (
              <div className="egdesk-bi-detailed-company__item">
                <h4><FontAwesomeIcon icon={faMapMarkerAlt} /> Address</h4>
                <p>{contactAndLegal.addressKo}</p>
              </div>
            )}
            {contactAndLegal.phones && Object.keys(contactAndLegal.phones).length > 0 && (
              <div className="egdesk-bi-detailed-company__item egdesk-bi-detailed-company__item--full">
                <h4><FontAwesomeIcon icon={faPhone} /> Phone Numbers</h4>
                <div className="egdesk-bi-detailed-company__phones">
                  {Object.entries(contactAndLegal.phones).map(([type, number]) => (
                    number && (
                      <div key={type} className="egdesk-bi-detailed-company__phone-entry">
                        <span className="egdesk-bi-detailed-company__phone-type">{type}:</span>
                        <a className="egdesk-bi-detailed-company__inline-link" href={`tel:${number}`}>{number}</a>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Company Structure */}
      {companyStructure && (
        <section className="egdesk-bi-detailed-company__panel">
          <div className="egdesk-bi-detailed-company__panel-header">
            <span className="egdesk-bi-detailed-company__icon">
              <FontAwesomeIcon icon={faIndustry} />
            </span>
            <div>
              <h2>Company Structure & Positioning</h2>
              <p>Business divisions and strategic positioning</p>
            </div>
          </div>
          {companyStructure.summary && (
            <div className="egdesk-bi-detailed-company__summary">
              <p>{companyStructure.summary}</p>
            </div>
          )}
          {companyStructure.divisionsKo && companyStructure.divisionsKo.length > 0 && (
            <div className="egdesk-bi-detailed-company__divisions">
              <h4>Business Divisions</h4>
              <ul className="egdesk-bi-detailed-company__list">
                {companyStructure.divisionsKo.map((division, index) => (
                  <li key={index}>{division}</li>
                ))}
              </ul>
            </div>
          )}
          {companyStructure.positioning && (
            <div className="egdesk-bi-detailed-company__positioning">
              <h4>Strategic Positioning</h4>
              {Object.entries(companyStructure.positioning).map(([key, value]) => (
                value && (
                  <div key={key} className="egdesk-bi-detailed-company__positioning-item">
                    <span className="egdesk-bi-detailed-company__positioning-label">{key}:</span>
                    <p>{value}</p>
                  </div>
                )
              ))}
            </div>
          )}
        </section>
      )}

      {/* Products & Services */}
      {enrichedProducts && enrichedProducts.length > 0 && (
        <section className="egdesk-bi-detailed-company__panel">
          <div className="egdesk-bi-detailed-company__panel-header">
            <span className="egdesk-bi-detailed-company__icon">
              <FontAwesomeIcon icon={faCube} />
            </span>
            <div>
              <h2>Products & Services Catalog</h2>
              <p>Complete list of company offerings with images and details</p>
            </div>
          </div>
          <div className="egdesk-bi-detailed-company__products-grid">
            {enrichedProducts.map((product, index) => (
              <article key={index} className="egdesk-bi-detailed-company__product-card">
                <div className="egdesk-bi-detailed-company__product-header">
                  <h3>{product.name}</h3>
                  <span className={`egdesk-bi-detailed-company__product-badge egdesk-bi-detailed-company__product-badge--${product.kind}`}>
                    {product.kind}
                  </span>
                </div>
                {product.oneLineSummary && (
                  <p className="egdesk-bi-detailed-company__product-description">{product.oneLineSummary}</p>
                )}
                {product.imageUrls && product.imageUrls.length > 0 && (
                  <div className="egdesk-bi-detailed-company__product-images">
                    <h4>Images ({product.imageUrls.length})</h4>
                    <div className="egdesk-bi-detailed-company__image-grid">
                      {product.imageUrls.slice(0, 6).map((imageUrl, imgIndex) => (
                        <button
                          key={imgIndex}
                          onClick={() => setViewerState({
                            isOpen: true,
                            productName: product.name,
                            imageUrl: imageUrl
                          })}
                          className="egdesk-bi-detailed-company__image-thumbnail"
                          type="button"
                          aria-label={`View ${product.name} image ${imgIndex + 1}`}
                        >
                          <img src={imageUrl} alt={`${product.name} - ${imgIndex + 1}`} loading="lazy" />
                        </button>
                      ))}
                    </div>
                    {product.imageUrls.length > 6 && (
                      <p className="egdesk-bi-detailed-company__image-count">+{product.imageUrls.length - 6} more images</p>
                    )}
                  </div>
                )}
                {(product.canonicalLandingUrl || product.canonicalHubUrl || (product.pageUrls && product.pageUrls.length > 0)) && (
                  <div className="egdesk-bi-detailed-company__product-links">
                    {product.canonicalLandingUrl && (
                      <a href={product.canonicalLandingUrl} target="_blank" rel="noopener noreferrer" className="egdesk-bi-detailed-company__product-link">
                        View Product Page →
                      </a>
                    )}
                    {product.canonicalHubUrl && (
                      <a href={product.canonicalHubUrl} target="_blank" rel="noopener noreferrer" className="egdesk-bi-detailed-company__product-link">
                        View Hub Page →
                      </a>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Partners & Network */}
      {partnersAndNetwork && (
        <section className="egdesk-bi-detailed-company__panel">
          <div className="egdesk-bi-detailed-company__panel-header">
            <span className="egdesk-bi-detailed-company__icon">
              <FontAwesomeIcon icon={faHandshake} />
            </span>
            <div>
              <h2>Partners & Network</h2>
              <p>Global partnerships and trade relationships</p>
            </div>
          </div>
          {partnersAndNetwork.note && (
            <div className="egdesk-bi-detailed-company__summary">
              <p>{partnersAndNetwork.note}</p>
            </div>
          )}
          {partnersAndNetwork.tradeBrandsNamedOnHome && partnersAndNetwork.tradeBrandsNamedOnHome.length > 0 && (
            <div className="egdesk-bi-detailed-company__partners">
              <h4>Trade Partners</h4>
              <ul className="egdesk-bi-detailed-company__partners-list">
                {partnersAndNetwork.tradeBrandsNamedOnHome.map((brand, index) => (
                  <li key={index} className="egdesk-bi-detailed-company__partner-badge">{brand}</li>
                ))}
              </ul>
            </div>
          )}
          {partnersAndNetwork.globalNetworkPage && (
            <a href={partnersAndNetwork.globalNetworkPage} target="_blank" rel="noopener noreferrer" className="egdesk-bi-detailed-company__network-link">
              View Global Network →
            </a>
          )}
        </section>
      )}

      {/* Target Industries */}
      {targetIndustriesMentioned && targetIndustriesMentioned.length > 0 && (
        <section className="egdesk-bi-detailed-company__panel">
          <div className="egdesk-bi-detailed-company__panel-header">
            <span className="egdesk-bi-detailed-company__icon">
              <FontAwesomeIcon icon={faTrophy} />
            </span>
            <div>
              <h2>Target Industries</h2>
              <p>Industries and sectors served by the company</p>
            </div>
          </div>
          <div className="egdesk-bi-detailed-company__industries">
            {targetIndustriesMentioned.map((industry, index) => (
              <span key={index} className="egdesk-bi-detailed-company__industry-tag">{industry}</span>
            ))}
          </div>
        </section>
      )}

      <ImageViewerModal
        isOpen={viewerState.isOpen}
        onClose={() => setViewerState({ ...viewerState, isOpen: false })}
        productName={viewerState.productName}
        imageUrl={viewerState.imageUrl}
      />
    </div>
  );
};

export default DetailedCompanyInfo;
