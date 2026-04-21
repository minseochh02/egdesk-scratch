import React, { useCallback, useMemo } from 'react';
import MDEditor from '@uiw/react-md-editor';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  readOnly = false,
}) => {
  const handleChange = useCallback(
    (val?: string) => {
      onChange(val || '');
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Save on Cmd/Ctrl + S
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        if (onSave) {
          onSave();
        }
      }
    },
    [onSave]
  );

  return (
    <div
      className="markdown-editor-wrapper"
      onKeyDown={handleKeyDown}
      data-color-mode="dark"
    >
      <MDEditor
        value={value}
        onChange={handleChange}
        preview="live"
        height={600}
        hideToolbar={readOnly}
        previewOptions={{
          rehypePlugins: [],
        }}
        textareaProps={{
          readOnly,
          placeholder: 'Write your markdown content here...',
        }}
      />
    </div>
  );
};

export default MarkdownEditor;
