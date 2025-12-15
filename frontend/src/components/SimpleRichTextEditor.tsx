import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link2,
  Heading2,
  Heading3,
  Quote,
  Code,
  Code2,
  Minus,
  CheckSquare,
} from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import { VideoEmbedExtension } from '../extensions/VideoEmbed';
import { detectVideoProvider } from '../utils/videoProviders';
import { oembedApi } from '../api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface SimpleRichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const SimpleRichTextEditor = ({ content, onChange, placeholder = 'Start writing...' }: SimpleRichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer hover:text-blue-800',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            'data-emoji': {
              default: null,
            },
          };
        },
        renderHTML({ HTMLAttributes }) {
          // Convert relative API URLs to absolute URLs for src
          let src = HTMLAttributes.src;
          if (src && src.startsWith('/api/')) {
            src = `${API_BASE_URL}${src}`;
          }

          // If it's a custom emoji, use inline emoji styles
          if (HTMLAttributes['data-emoji']) {
            return ['img', {
              ...HTMLAttributes,
              src,
              class: 'inline-emoji',
            }];
          }
          // Otherwise use default image styles
          return ['img', {
            ...HTMLAttributes,
            src,
            class: 'w-full h-auto rounded-lg',
          }];
        },
      }),
      Underline,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      VideoEmbedExtension,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
        style: 'min-height: 80px; max-height: 400px; color: var(--color-text-primary);',
      },
      handlePaste: (_view, event) => {
        // Check for URLs in text
        const text = event.clipboardData?.getData('text/plain');
        if (text) {
          // Simple URL detection - matches http(s) URLs
          const urlRegex = /^https?:\/\/[^\s]+$/;
          if (urlRegex.test(text.trim())) {
            const trimmedUrl = text.trim();
            
            // Check if it's a video URL
            const videoMatch = detectVideoProvider(trimmedUrl);
            if (videoMatch) {
              event.preventDefault();
              
              // Insert video embed
              oembedApi.getInfo(trimmedUrl)
                .then(info => {
                  if (editor) {
                    editor.chain().focus().insertContent({
                      type: 'videoEmbed',
                      attrs: {
                        url: trimmedUrl,
                        embedUrl: info.embed_url || videoMatch.embedUrl,
                        title: info.title || undefined,
                        thumbnailUrl: info.thumbnail_url || videoMatch.thumbnailUrl,
                        providerName: info.provider_name || videoMatch.provider.name,
                        authorName: info.author_name || undefined,
                        isExpanded: false,
                      },
                    }).run();
                  }
                })
                .catch(() => {
                  // Fallback to basic video embed
                  editor?.chain().focus().insertContent({
                    type: 'videoEmbed',
                    attrs: {
                      url: trimmedUrl,
                      embedUrl: videoMatch.embedUrl,
                      thumbnailUrl: videoMatch.thumbnailUrl,
                      providerName: videoMatch.provider.name,
                      isExpanded: false,
                    },
                  }).run();
                });
              
              return true;
            }
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleEmojiSelect = (emoji: string, isCustom?: boolean, imageUrl?: string) => {
    if (!editor) return;

    if (isCustom && imageUrl) {
      // Convert relative URL to absolute URL for the editor
      const absoluteUrl = imageUrl.startsWith('http') ? imageUrl : `${API_BASE_URL}${imageUrl}`;
      
      // Insert custom emoji as raw HTML with data-emoji attribute
      const imgHtml = `<img src="${absoluteUrl}" alt="${emoji}" data-emoji="true" class="inline-emoji" /> `;
      editor.chain().focus().insertContent(imgHtml).run();
    } else {
      // Insert Unicode emoji as text
      editor.chain().focus().insertContent(emoji + ' ').run();
    }
  };

  return (
    <div
      className="border rounded-lg overflow-auto resize-both"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-accent)',
        boxShadow: `0 0 0 3px ${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}20`,
        minHeight: '80px',
        maxHeight: '400px',
        minWidth: '200px',
        resize: 'both',
      }}
    >
      {/* Toolbar */}
      <div
        className="flex flex-wrap gap-1 p-2 border-b"
        style={{
          borderColor: 'var(--color-border-primary)',
          backgroundColor: 'var(--color-bg-primary)',
        }}
      >
        {/* Text Formatting */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('bold') ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('bold')
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('bold')
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Bold (Ctrl+B)"
          type="button"
        >
          <Bold size={16} />
        </button>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('italic') ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('italic')
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('italic')
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Italic (Ctrl+I)"
          type="button"
        >
          <Italic size={16} />
        </button>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('underline') ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('underline')
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('underline')
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Underline (Ctrl+U)"
          type="button"
        >
          <UnderlineIcon size={16} />
        </button>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('strike') ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('strike')
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('strike')
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Strikethrough"
          type="button"
        >
          <Strikethrough size={16} />
        </button>

        {/* Separator */}
        <div
          style={{
            width: '1px',
            backgroundColor: 'var(--color-border-primary)',
            margin: '0 4px',
          }}
        />

        {/* Headings */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('heading', { level: 2 })
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('heading', { level: 2 })
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Heading 2"
          type="button"
        >
          <Heading2 size={16} />
        </button>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('heading', { level: 3 }) ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('heading', { level: 3 })
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('heading', { level: 3 })
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Heading 3"
          type="button"
        >
          <Heading3 size={16} />
        </button>

        {/* Separator */}
        <div
          style={{
            width: '1px',
            backgroundColor: 'var(--color-border-primary)',
            margin: '0 4px',
          }}
        />

        {/* Lists */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('bulletList') ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('bulletList')
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('bulletList')
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Bullet List"
          type="button"
        >
          <List size={16} />
        </button>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('orderedList') ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('orderedList')
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('orderedList')
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Numbered List"
          type="button"
        >
          <ListOrdered size={16} />
        </button>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('taskList') ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('taskList')
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('taskList')
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Task List"
          type="button"
        >
          <CheckSquare size={16} />
        </button>

        {/* Separator */}
        <div
          style={{
            width: '1px',
            backgroundColor: 'var(--color-border-primary)',
            margin: '0 4px',
          }}
        />

        {/* Block Elements */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('blockquote') ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('blockquote')
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('blockquote')
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Blockquote"
          type="button"
        >
          <Quote size={16} />
        </button>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('code') ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('code')
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('code')
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Inline Code"
          type="button"
        >
          <Code size={16} />
        </button>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('codeBlock') ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('codeBlock')
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('codeBlock')
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Code Block"
          type="button"
        >
          <Code2 size={16} />
        </button>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-2 rounded hover:bg-opacity-80 transition-colors"
          style={{
            color: 'var(--color-text-secondary)',
          }}
          title="Horizontal Rule"
          type="button"
        >
          <Minus size={16} />
        </button>

        {/* Separator */}
        <div
          style={{
            width: '1px',
            backgroundColor: 'var(--color-border-primary)',
            margin: '0 4px',
          }}
        />

        {/* Emoji Picker */}
        <EmojiPicker onEmojiSelect={handleEmojiSelect} />

        {/* Link */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={addLink}
          className={`p-2 rounded hover:bg-opacity-80 transition-colors ${
            editor.isActive('link') ? 'bg-opacity-100' : 'bg-opacity-0'
          }`}
          style={{
            backgroundColor: editor.isActive('link')
              ? 'var(--color-accent)'
              : 'transparent',
            color: editor.isActive('link')
              ? 'white'
              : 'var(--color-text-secondary)',
          }}
          title="Add Link"
          type="button"
        >
          <Link2 size={16} />
        </button>
      </div>

      {/* Editor */}
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default SimpleRichTextEditor;

