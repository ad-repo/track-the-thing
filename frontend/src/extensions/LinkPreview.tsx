import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { ExternalLink, X } from 'lucide-react';
import { useState } from 'react';

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// React component for rendering the preview
const LinkPreviewComponent = ({ node, updateAttributes, deleteNode }: { node: any; updateAttributes: (attrs: any) => void; deleteNode: () => void }) => {
  const { url, title, description, image, site_name } = node.attrs;
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [localTitle, setLocalTitle] = useState(title || '');
  const [localDescription, setLocalDescription] = useState(description || '');
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  return (
    <NodeViewWrapper
      className="link-preview relative group"
      style={{
        margin: '0.25rem 0',
      }}
    >
      <button
        onClick={deleteNode}
        className="absolute top-2 right-2 z-10 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          backgroundColor: '#ef4444',
          color: 'white'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#dc2626';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#ef4444';
        }}
        title="Remove link preview"
      >
        <X className="h-4 w-4" />
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block border rounded-lg transition-colors no-underline"
        style={{
          borderColor: 'var(--color-border-primary)',
          padding: '0.35rem 0.65rem',
          backgroundColor: 'var(--color-card-bg)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border-primary)';
        }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              flexShrink: 0,
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '4px',
            }}
          >
            {image ? (
              <img
                src={image}
                alt={title || 'Link preview'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                {hostname.replace(/^www\./, '').slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
              <span className="truncate">{site_name || hostname}</span>
              <ExternalLink className="h-3 w-3" />
            </div>

            {editingTitle ? (
              <input
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={() => {
                  updateAttributes({ title: localTitle });
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateAttributes({ title: localTitle });
                    setEditingTitle(false);
                  }
                }}
                className="font-semibold w-full px-2 py-1 border rounded text-sm"
                style={{
                  color: 'var(--color-text-primary)',
                  backgroundColor: 'var(--color-bg-primary)',
                  borderColor: 'var(--color-border-primary)',
                }}
                autoFocus
              />
            ) : (
              <h3
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingTitle(true);
                }}
                className="font-semibold text-base leading-tight cursor-pointer hover:opacity-70 transition-opacity"
                style={{
                  color: 'var(--color-text-primary)',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                title="Click to edit title"
              >
                {title || 'Click to add title'}
              </h3>
            )}

            {editingDescription ? (
              <textarea
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                onBlur={() => {
                  updateAttributes({ description: localDescription });
                  setEditingDescription(false);
                }}
                className="text-[11px] w-full px-2 py-1 border rounded resize-none mt-1"
                style={{
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-bg-primary)',
                  borderColor: 'var(--color-border-primary)',
                  minHeight: '28px',
                  maxHeight: '40px',
                  overflowY: 'auto',
                }}
                autoFocus
              />
            ) : (
              <p
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingDescription(true);
                }}
                className="text-[11px] leading-snug cursor-pointer hover:opacity-70 transition-opacity mt-1"
                style={{
                  color: 'var(--color-text-secondary)',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                title="Click to edit description"
              >
                {description && description.trim() ? description : 'Link preview not available (access restricted or not found).'}
              </p>
            )}
          </div>
        </div>
      </a>
    </NodeViewWrapper>
  );
};

export const LinkPreviewExtension = Node.create({
  name: 'linkPreview',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      url: {
        default: null,
      },
      title: {
        default: null,
      },
      description: {
        default: null,
      },
      image: {
        default: null,
      },
      site_name: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-link-preview]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false;
          const element = node as HTMLElement;
          
          // Support both old format (url, title) and new format (data-url, data-title)
          return {
            url: element.getAttribute('data-url') || element.getAttribute('url'),
            title: element.getAttribute('data-title') || element.getAttribute('title'),
            description: element.getAttribute('data-description') || element.getAttribute('description'),
            image: element.getAttribute('data-image') || element.getAttribute('image'),
            site_name: element.getAttribute('data-site-name') || element.getAttribute('site_name') || element.getAttribute('site-name'),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-link-preview': '',
        'data-url': node.attrs.url,
        'data-title': node.attrs.title,
        'data-description': node.attrs.description,
        'data-image': node.attrs.image,
        'data-site-name': node.attrs.site_name,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewComponent);
  },
});

// Helper function to fetch link preview
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  try {
    const response = await fetch(`${API_URL}/api/link-preview/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch link preview:', error);
    return null;
  }
}

