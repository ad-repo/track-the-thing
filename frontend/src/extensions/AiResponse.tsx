import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
};

// React component for rendering AI responses
const AiResponseComponent = ({ node }: NodeViewProps) => {
  const content = node.attrs.content as string || '';
  const provider = node.attrs.provider as string || 'openai';
  const inputTokens = node.attrs.inputTokens as number || 0;
  const outputTokens = node.attrs.outputTokens as number || 0;
  const displayName = PROVIDER_NAMES[provider] || provider;

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

