
import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const RichTextEditor = ({ value, onChange, placeholder, className }: RichTextEditorProps) => {
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      [{ 'align': [] }],
      [{ 'color': [] }, { 'background': [] }],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'blockquote', 'code-block',
    'link', 'image',
    'align',
    'color', 'background'
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .ql-editor {
            min-height: 200px;
            font-size: 16px;
            line-height: 1.6;
          }
          .ql-toolbar.ql-snow {
            border-top: 1px solid #ccc;
            border-left: 1px solid #ccc;
            border-right: 1px solid #ccc;
            border-radius: 6px 6px 0 0;
          }
          .ql-container.ql-snow {
            border-bottom: 1px solid #ccc;
            border-left: 1px solid #ccc;
            border-right: 1px solid #ccc;
            border-radius: 0 0 6px 6px;
          }
          .ql-editor p {
            margin-bottom: 12px;
          }
          .ql-editor h1, .ql-editor h2, .ql-editor h3 {
            margin-bottom: 16px;
            margin-top: 24px;
          }
        `
      }} />
      <div className={cn("rich-text-editor", className)}>
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          style={{
            minHeight: '200px',
          }}
        />
      </div>
    </>
  );
};

export default RichTextEditor;
