import React from 'react';

interface CodeViewerWithLineNumbersProps {
  code: string;
  className?: string;
}

const CodeViewerWithLineNumbers: React.FC<CodeViewerWithLineNumbersProps> = ({ code, className }) => {
  const lines = code.split('\n');

  return (
    <pre className={`code-block-script ${className || ''}`}>
      <code className="code-with-line-numbers">
        {lines.map((line, index) => (
          <div key={index} className="code-line">
            <span className="line-number">{index + 1}</span>
            <span className="line-content">{line}</span>
          </div>
        ))}
      </code>
    </pre>
  );
};

export default CodeViewerWithLineNumbers;
