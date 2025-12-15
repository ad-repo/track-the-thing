import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { ChevronDown, ChevronUp, X, Play, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { openExternal } from '../utils/openExternal';
import { oembedApi, OEmbedInfo } from '../api';

// React component for rendering the video embed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VideoEmbedComponent = ({ node, updateAttributes, deleteNode }: { node: any; updateAttributes: (attrs: any) => void; deleteNode: () => void }) => {
  const { url, embedUrl, title, thumbnailUrl, providerName, authorName, isExpanded } = node.attrs;
  const [loading, setLoading] = useState(!title && !thumbnailUrl);
  const [error, setError] = useState(false);

  // Fetch metadata if not already present
  useEffect(() => {
    if (!title && !thumbnailUrl && url) {
      setLoading(true);
      oembedApi.getInfo(url)
        .then((info: OEmbedInfo) => {
          updateAttributes({
            title: info.title || undefined,
            thumbnailUrl: info.thumbnail_url || undefined,
            providerName: info.provider_name || providerName,
            authorName: info.author_name || undefined,
            embedUrl: info.embed_url || embedUrl,
          });
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  }, [url, title, thumbnailUrl, updateAttributes, embedUrl, providerName]);

  const handleOpenUrl = () => {
    openExternal(url);
  };

  const toggleExpanded = () => {
    updateAttributes({ isExpanded: !isExpanded });
  };

  // Provider colors
  const providerColors: Record<string, string> = {
    YouTube: '#FF0000',
    Vimeo: '#1AB7EA',
    Dailymotion: '#00D2F3',
    Twitch: '#9146FF',
  };

  const providerColor = providerColors[providerName || ''] || 'var(--color-accent)';

  return (
    <NodeViewWrapper
      className="video-embed relative group"
      style={{
        margin: '0.5rem 0',
      }}
    >
      {/* Delete button */}
      <button
        onClick={deleteNode}
        className="absolute top-2 right-2 z-10 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          backgroundColor: '#ef4444',
          color: 'white',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#dc2626';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#ef4444';
        }}
        title="Remove video"
      >
        <X className="h-4 w-4" />
      </button>

      <div
        className="border rounded-lg overflow-hidden"
        style={{
          borderColor: 'var(--color-border-primary)',
          backgroundColor: 'var(--color-card-bg)',
        }}
      >
        {/* Header - always visible */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          style={{
            padding: '0.5rem 0.75rem',
            borderBottom: isExpanded ? '1px solid var(--color-border-primary)' : 'none',
          }}
          onClick={toggleExpanded}
        >
          {/* Thumbnail or placeholder */}
          <div
            style={{
              width: '80px',
              height: '45px',
              borderRadius: '6px',
              flexShrink: 0,
              backgroundColor: 'var(--color-bg-tertiary)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {loading ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid var(--color-border-primary)',
                    borderTopColor: 'var(--color-accent)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
              </div>
            ) : thumbnailUrl ? (
              <>
                <img
                  src={thumbnailUrl}
                  alt={title || 'Video thumbnail'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                {/* Play overlay when collapsed */}
                {!isExpanded && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: providerColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Play className="h-3.5 w-3.5 text-white" style={{ marginLeft: '2px' }} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: providerColor,
                }}
              >
                <Play className="h-5 w-5 text-white" />
              </div>
            )}
          </div>

          {/* Title and info */}
          <div className="flex-1 min-w-0">
            {/* Provider badge */}
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: providerColor,
                  color: 'white',
                }}
              >
                {providerName || 'Video'}
              </span>
              {authorName && (
                <span
                  className="text-[11px] truncate"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {authorName}
                </span>
              )}
            </div>

            {/* Title */}
            <h4
              className="font-medium text-sm leading-tight truncate"
              style={{ color: 'var(--color-text-primary)' }}
              title={title || url}
            >
              {loading ? 'Loading...' : error ? 'Video' : title || 'Untitled Video'}
            </h4>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenUrl();
              }}
              className="p-1.5 rounded hover:bg-opacity-20"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Open in browser"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              className="p-1.5 rounded"
              style={{ color: 'var(--color-text-secondary)' }}
              title={isExpanded ? 'Collapse video' : 'Expand video'}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Video iframe - shown when expanded */}
        {isExpanded && (
          <div
            style={{
              position: 'relative',
              paddingBottom: '56.25%', // 16:9 aspect ratio
              height: 0,
              overflow: 'hidden',
            }}
          >
            <iframe
              src={embedUrl}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={title || 'Embedded video'}
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

// TipTap extension
export const VideoEmbedExtension = Node.create({
  name: 'videoEmbed',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      url: {
        default: null,
      },
      embedUrl: {
        default: null,
      },
      title: {
        default: null,
      },
      thumbnailUrl: {
        default: null,
      },
      providerName: {
        default: null,
      },
      authorName: {
        default: null,
      },
      isExpanded: {
        default: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-video-embed]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false;
          const element = node as HTMLElement;

          return {
            url: element.getAttribute('data-url'),
            embedUrl: element.getAttribute('data-embed-url'),
            title: element.getAttribute('data-title'),
            thumbnailUrl: element.getAttribute('data-thumbnail-url'),
            providerName: element.getAttribute('data-provider-name'),
            authorName: element.getAttribute('data-author-name'),
            isExpanded: element.getAttribute('data-is-expanded') === 'true',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'div',
      mergeAttributes({
        'data-video-embed': '',
        'data-url': node.attrs.url,
        'data-embed-url': node.attrs.embedUrl,
        'data-title': node.attrs.title,
        'data-thumbnail-url': node.attrs.thumbnailUrl,
        'data-provider-name': node.attrs.providerName,
        'data-author-name': node.attrs.authorName,
        'data-is-expanded': String(node.attrs.isExpanded),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedComponent);
  },
});

export default VideoEmbedExtension;

