import React, { useCallback, useRef } from 'react';
import MDEditor, { commands } from '@uiw/react-md-editor';

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
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

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
        if (onSaveRef.current) {
          onSaveRef.current();
        }
      }
    },
    []
  );

  const saveCommand = useCallback(() => ({
    name: 'save',
    keyCommand: 'save',
    buttonProps: { 'aria-label': 'Save (Cmd/Ctrl+S)', title: 'Save (Cmd/Ctrl+S)' },
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="12" height="12" fill="currentColor">
        <path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32H64zm0 96c0-17.7 14.3-32 32-32H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/>
      </svg>
    ),
    execute: () => {
      if (onSaveRef.current) {
        onSaveRef.current();
      }
    },
  }), []);

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
        height="100%"
        hideToolbar={readOnly}
        extraCommands={[saveCommand(), commands.fullscreen]}
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
