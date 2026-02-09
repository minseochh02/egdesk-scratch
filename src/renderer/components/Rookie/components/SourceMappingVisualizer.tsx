/**
 * Source Mapping Visualizer
 *
 * Visual component that shows how AI maps source files to target report
 * Displays: Source File → Columns → Operations → Target Section
 */

import React, { useState } from 'react';
import './SourceMappingVisualizer.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileExcel,
  faArrowRight,
  faCalculator,
  faFilter,
  faChevronDown,
  faChevronRight,
  faTable
} from '@fortawesome/free-solid-svg-icons';

interface SourceColumn {
  name: string;
  type: string;
  role: string;
  sampleValues?: string[];
}

interface SourceFile {
  file: string;
  origin: string;
  rowCount: number;
  columns: SourceColumn[];
  feedsTargetSections: string[];
}

interface DataMapping {
  mappingId: string;
  sourceFile: string;
  sourceColumn: string;
  operation: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'CONCAT' | 'FIRST' | 'LAST' | 'VLOOKUP' | 'FILTER' | 'DIRECT';
  filters?: Array<{
    column: string;
    operator: string;
    value: string | string[];
  }>;
  groupBy?: string[];
  targetSection: string;
  targetCell?: string;
  targetFieldName: string;
  sampleCalculation?: string;
  confidence: 'verified' | 'probable' | 'needs_validation';
}

interface BuildStep {
  step: number;
  targetSection: string;
  action: string;
  mappings: DataMapping[];
  description: string;
  validation: string;
}

interface ResolverData {
  sourceInventory: SourceFile[];
  buildRecipe?: {
    steps: BuildStep[];
  };
}

interface Props {
  resolverData: ResolverData;
  targetHtml?: string; // Optional: target HTML to highlight sections
}

export const SourceMappingVisualizer: React.FC<Props> = ({ resolverData, targetHtml }) => {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [selectedTargetSection, setSelectedTargetSection] = useState<string | null>(null);

  const toggleFile = (fileName: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileName)) {
      newExpanded.delete(fileName);
    } else {
      newExpanded.add(fileName);
    }
    setExpandedFiles(newExpanded);
  };

  const toggleStep = (stepNum: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepNum)) {
      newExpanded.delete(stepNum);
    } else {
      newExpanded.add(stepNum);
    }
    setExpandedSteps(newExpanded);
  };

  // Get all unique target sections
  const allTargetSections = Array.from(
    new Set(
      resolverData.sourceInventory.flatMap(file => file.feedsTargetSections || [])
    )
  );

  // Group build steps by target section
  const stepsBySection = (resolverData.buildRecipe?.steps || []).reduce((acc, step) => {
    if (!acc[step.targetSection]) {
      acc[step.targetSection] = [];
    }
    acc[step.targetSection].push(step);
    return acc;
  }, {} as Record<string, BuildStep[]>);

  const getOperationIcon = (action: string) => {
    const actionLower = action.toLowerCase();

    // Check for specific operations
    if (actionLower === 'sum' || actionLower === 'avg' || actionLower === 'count' ||
        actionLower === 'min' || actionLower === 'max' ||
        actionLower.includes('sum') || actionLower.includes('aggregate') || actionLower.includes('average')) {
      return faCalculator;
    }
    if (actionLower === 'filter' || actionLower.includes('filter') || actionLower.includes('extract')) {
      return faFilter;
    }
    return faTable;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'metric': return '#2E7D32';
      case 'dimension': return '#1976D2';
      case 'attribute': return '#F57C00';
      default: return '#616161';
    }
  };

  return (
    <div className="source-mapping-visualizer">
      <div className="visualizer-header">
        <h4>📊 Source-to-Target Data Flow</h4>
        <p>How AI transforms source files into the target report</p>
      </div>

      <div className="mapping-flow-container">
        {/* Left: Source Files */}
        <div className="source-files-panel">
          <div className="panel-header">
            <FontAwesomeIcon icon={faFileExcel} />
            <span>Source Files ({resolverData.sourceInventory.length})</span>
          </div>

          <div className="source-files-list">
            {resolverData.sourceInventory.map((file, idx) => (
              <div
                key={idx}
                className={`source-file-card ${expandedFiles.has(file.file) ? 'expanded' : ''}`}
              >
                <div
                  className="source-file-header"
                  onClick={() => toggleFile(file.file)}
                >
                  <FontAwesomeIcon
                    icon={expandedFiles.has(file.file) ? faChevronDown : faChevronRight}
                    className="expand-icon"
                  />
                  <div className="file-info">
                    <div className="file-name">{file.file}</div>
                    <div className="file-meta">
                      {file.rowCount.toLocaleString()} rows · {file.columns.length} columns
                    </div>
                  </div>
                </div>

                {expandedFiles.has(file.file) && (
                  <div className="source-file-details">
                    <div className="columns-section">
                      <div className="section-label">Columns:</div>
                      <div className="columns-list">
                        {file.columns.map((col, colIdx) => (
                          <div key={colIdx} className="column-item">
                            <div className="column-header">
                              <span className="column-name">{col.name}</span>
                              <span
                                className="role-badge"
                                style={{ background: getRoleBadgeColor(col.role) }}
                              >
                                {col.role}
                              </span>
                            </div>
                            {col.sampleValues && col.sampleValues.length > 0 && (
                              <div className="sample-values">
                                {col.sampleValues.slice(0, 3).map((val, valIdx) => (
                                  <span key={valIdx} className="sample-value">{val}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="feeds-section">
                      <div className="section-label">Feeds target sections:</div>
                      <div className="target-sections-tags">
                        {file.feedsTargetSections.map((section, secIdx) => (
                          <span
                            key={secIdx}
                            className={`target-section-tag ${selectedTargetSection === section ? 'active' : ''}`}
                            onClick={() => setSelectedTargetSection(section)}
                          >
                            {section}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Middle: Arrow */}
        <div className="flow-arrow">
          <FontAwesomeIcon icon={faArrowRight} />
          <span className="arrow-label">transforms to</span>
        </div>

        {/* Right: Target Sections & Build Steps */}
        <div className="target-sections-panel">
          <div className="panel-header">
            <FontAwesomeIcon icon={faTable} />
            <span>Target Report Sections ({allTargetSections.length})</span>
          </div>

          <div className="target-sections-list">
            {allTargetSections.map((section, idx) => {
              const steps = stepsBySection[section] || [];
              const sourceFiles = resolverData.sourceInventory
                .filter(f => f.feedsTargetSections.includes(section))
                .map(f => f.file);

              return (
                <div
                  key={idx}
                  className={`target-section-card ${selectedTargetSection === section ? 'highlighted' : ''}`}
                  onClick={() => setSelectedTargetSection(section)}
                >
                  <div className="target-section-header">
                    <div className="section-title">{section}</div>
                    <div className="section-sources">
                      From: {sourceFiles.join(', ')}
                    </div>
                  </div>

                  {steps.length > 0 && (
                    <div className="build-steps">
                      <div className="steps-label">
                        Transformation Steps ({steps.length}):
                      </div>
                      {steps.map((step, stepIdx) => (
                        <div
                          key={stepIdx}
                          className={`build-step ${expandedSteps.has(step.step) ? 'expanded' : ''}`}
                        >
                          <div
                            className="step-header"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStep(step.step);
                            }}
                          >
                            <FontAwesomeIcon
                              icon={expandedSteps.has(step.step) ? faChevronDown : faChevronRight}
                              className="expand-icon"
                            />
                            <FontAwesomeIcon
                              icon={getOperationIcon(step.action)}
                              className="step-icon"
                            />
                            <span className="step-number">Step {step.step}</span>
                            <span className="step-action">{step.action}</span>
                          </div>

                          {expandedSteps.has(step.step) && (
                            <div className="step-details">
                              <div className="detail-row">
                                <strong>Description:</strong> {step.description}
                              </div>

                              {/* Data Mappings */}
                              {step.mappings && step.mappings.length > 0 && (
                                <div className="mappings-section">
                                  <strong className="mappings-title">
                                    Data Mappings ({step.mappings.length}):
                                  </strong>
                                  {step.mappings.map((mapping, mapIdx) => (
                                    <div key={mapIdx} className="mapping-card">
                                      <div className="mapping-flow">
                                        {/* Source */}
                                        <div className="mapping-source">
                                          <div className="mapping-label">Source</div>
                                          <div className="mapping-file">{mapping.sourceFile}</div>
                                          <div className="mapping-column">{mapping.sourceColumn}</div>
                                        </div>

                                        {/* Operation */}
                                        <div className="mapping-operation">
                                          <FontAwesomeIcon
                                            icon={getOperationIcon(mapping.operation)}
                                            className="operation-icon"
                                          />
                                          <div className="operation-name">{mapping.operation}</div>
                                          {mapping.filters && mapping.filters.length > 0 && (
                                            <div className="mapping-filters">
                                              {mapping.filters.map((filter, fIdx) => (
                                                <div key={fIdx} className="filter-tag">
                                                  {filter.column} {filter.operator} {String(filter.value)}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* Arrow */}
                                        <FontAwesomeIcon icon={faArrowRight} className="mapping-arrow" />

                                        {/* Target */}
                                        <div className="mapping-target">
                                          <div className="mapping-label">Target</div>
                                          <div className="mapping-field">{mapping.targetFieldName}</div>
                                          {mapping.targetCell && (
                                            <div className="mapping-cell">Cell: {mapping.targetCell}</div>
                                          )}
                                          <div className={`confidence-badge ${mapping.confidence}`}>
                                            {mapping.confidence}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Sample Calculation */}
                                      {mapping.sampleCalculation && (
                                        <div className="sample-calculation">
                                          <strong>Example:</strong> {mapping.sampleCalculation}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="detail-row">
                                <strong>Validation:</strong> {step.validation}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
