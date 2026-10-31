import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export function safeMarkdownUrl(value: string) {
  if (!value || /[\u0000-\u0020\u007f]/.test(value) || value.includes('\\')) return '';
  if (value.startsWith('#') || (value.startsWith('/') && !value.startsWith('//'))) return value;
  try { const url = new URL(value); return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : ''; } catch { return ''; }
}
export default function AiMarkdown({ text }: { text: string }) {
  return <div className="ai-markdown text-sm leading-relaxed break-words">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={safeMarkdownUrl} components={{
      a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer" className="underline">{children}</a> : <span>{children}</span>,
      img: () => null,
      table: ({ children }) => <div className="overflow-x-auto"><table className="w-full border-collapse">{children}</table></div>,
      th: ({ children }) => <th className="border p-2 text-left">{children}</th>,
      td: ({ children }) => <td className="border p-2">{children}</td>,
      h1: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2">{children}</h2>,
      h2: ({ children }) => <h3 className="text-base font-bold mt-4 mb-2">{children}</h3>,
      h3: ({ children }) => <h4 className="font-bold mt-3 mb-1">{children}</h4>,
      p: ({ children }) => <p className="my-2">{children}</p>,
      ul: ({ children }) => <ul className="list-disc pl-5 my-2">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-5 my-2">{children}</ol>,
      pre: ({ children }) => <pre className="overflow-x-auto rounded border p-3 my-2">{children}</pre>,
      code: ({ children, className }) => <code className={className}>{children}</code>,
    }}>{text}</ReactMarkdown>
  </div>;
}
