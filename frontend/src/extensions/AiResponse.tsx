import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
};

// React component for rendering AI responses
const AiResponseComponent = ({ node, deleteNode }: NodeViewProps) => {
  const content = node.attrs.content as string || '';
  const provider = node.attrs.provider as string || 'openai';
  const inputTokens = node.attrs.inputTokens as number || 0;
  const outputTokens = node.attrs.outputTokens as number || 0;
  const displayName = PROVIDER_NAMES[provider] || provider;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Strip HTML tags to get plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDelete = () => {
    deleteNode();
  };

  return (
    <NodeViewWrapper>
      <div
        className="ai-response-block"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderLeft: '4px solid var(--color-accent)',
          borderRadius: '0.5rem',
          padding: '1rem',
          margin: '0.5rem 0',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-accent)',
            }}
          >
            <span>🤖</span>
            <span>{displayName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {(inputTokens > 0 || outputTokens > 0) && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {inputTokens.toLocaleString()} in → {outputTokens.toLocaleString()} out
              </div>
            )}
            <button
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy response'}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px',
                cursor: 'pointer',
                color: copied ? 'var(--color-success, #22c55e)' : 'var(--color-text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
                transition: 'color 0.2s, background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!copied) {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, rgba(0,0,0,0.1))';
                }
              }}
              onMouseLeave={(e) => {
                if (!copied) e.currentTarget.style.color = 'var(--color-text-tertiary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              onClick={handleDelete}
              title="Delete response"
              style={{
                background: 'none',
                border: 'none',
                padding: '6px',
                cursor: 'pointer',
                color: 'var(--color-text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
                transition: 'color 0.2s, background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-error, #ef4444)';
                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, rgba(0,0,0,0.1))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-tertiary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div
          style={{
            color: 'var(--color-text-primary)',
            whiteSpace: 'pre-wrap',
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </NodeViewWrapper>
  );
};

// TipTap extension
export const AiResponseExtension = Node.create({
  name: 'aiResponse',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      content: {
        default: '',
      },
      provider: {
        default: 'openai',
      },
      inputTokens: {
        default: 0,
      },
      outputTokens: {
        default: 0,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-ai-response]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false;
          return {
            content: node.innerHTML,
            provider: node.getAttribute('data-provider') || 'openai',
            inputTokens: parseInt(node.getAttribute('data-input-tokens') || '0', 10),
            outputTokens: parseInt(node.getAttribute('data-output-tokens') || '0', 10),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-ai-response': '', 
      'data-provider': HTMLAttributes.provider || 'openai',
      'data-input-tokens': String(HTMLAttributes.inputTokens || 0),
      'data-output-tokens': String(HTMLAttributes.outputTokens || 0),
    }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AiResponseComponent);
  },
});

export default AiResponseExtension;

