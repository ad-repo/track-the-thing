import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useState, useCallback, useRef, FormEvent } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import { createLowlight, common } from 'lowlight';
import { Node, getMarkRange } from '@tiptap/core';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link2,
  Image as ImageIcon,
  Code2,
  FileText,
  Paperclip,
  ExternalLink,
  Mic,
  Camera,
  Video,
  Maximize2,
  Minimize2,
  Type,
  CaseSensitive,
  CheckSquare,
  Sparkles,
} from 'lucide-react';
import { LinkPreviewExtension, fetchLinkPreview } from '../extensions/LinkPreview';
import { AiResponseExtension } from '../extensions/AiResponse';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import TurndownService from 'turndown';
import { marked } from 'marked';
import * as yaml from 'js-yaml';
import EmojiPicker from './EmojiPicker';
import { normalizeColorForInput } from '../utils/color';
import { llmApi } from '../api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  entryId?: number; // Needed for LLM conversation context
}

// Custom extension for preformatted text
const PreformattedText = Node.create({
  name: 'preformattedText',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      class: {
        default: 'preformatted whitespace-pre-wrap font-mono text-sm p-3 rounded border border-gray-200',
      },
    };
  },
  parseHTML() {
    return [{ tag: 'pre', preserveWhitespace: 'full' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['pre', HTMLAttributes, 0];
  },
  addKeyboardShortcuts() {
    return {
      // Allow backspace at start to convert to paragraph
      'Backspace': () => {
        const { $from } = this.editor.state.selection;
        if ($from.parentOffset === 0 && this.editor.isActive('preformattedText')) {
          return this.editor.commands.setNode('paragraph');
        }
        return false;
      },
      // Allow arrow up at start to exit to paragraph above
      'ArrowUp': () => {
        const { $from } = this.editor.state.selection;
        if ($from.parentOffset === 0 && this.editor.isActive('preformattedText')) {
          const pos = $from.before();
          if (pos <= 1) {
            // At document start, insert paragraph before
            this.editor.commands.insertContentAt(0, { type: 'paragraph' });
            this.editor.commands.setTextSelection(1);
            return true;
          }
        }
        return false;
      },
    };
  },
});

const RichTextEditor = ({ content, onChange, placeholder = 'Start writing...', entryId }: RichTextEditorProps) => {
  const lowlight = createLowlight(common);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);
  // Use refs for interim text tracking to avoid stale closure issues
  const interimTextRef = useRef<string>('');
  const interimRangeRef = useRef<{ from: number; to: number } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedPhotoBlob, setCapturedPhotoBlob] = useState<Blob | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFontFamilyMenu, setShowFontFamilyMenu] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showJsonFormatted, setShowJsonFormatted] = useState(false);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [linkModalError, setLinkModalError] = useState<string | null>(null);
  const [editingExistingLink, setEditingExistingLink] = useState(false);
  const [linkModalMode, setLinkModalMode] = useState<'link' | 'preview'>('link');
  const linkSelectionRef = useRef<{ from: number; to: number } | null>(null);
  
  // LLM state
  const [isSendingToLlm, setIsSendingToLlm] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  
  // Camera/video/mic support detection
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isMobile = typeof navigator !== 'undefined' ? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) : false;
  const isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : false;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
  const supportsMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
  // In Tauri, we always support media capture via native APIs
  const canUseMediaCapture = isTauri || (supportsMediaDevices && (isSecureContext || isLocalhost || !isMobile));
  const showMediaButtons = isTauri || supportsMediaDevices;
  
  const isPreviewMode = linkModalMode === 'preview';
  const linkModalTitle = isPreviewMode ? 'Add Link Preview' : editingExistingLink ? 'Edit Link' : 'Add Link';
  const linkModalSubmitLabel = isPreviewMode ? 'Insert Preview' : editingExistingLink ? 'Update Link' : 'Add Link';
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      PreformattedText,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer hover:text-blue-800',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
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
      // Add custom node for video tags
      Node.create({
        name: 'video',
        group: 'block',
        atom: true,
        selectable: false, // Prevent selection/focus jump when clicking video
        draggable: false,
        addAttributes() {
          return {
            src: {
              default: null,
            },
            controls: {
              default: true,
            },
            style: {
              default: 'width: 100%; height: auto; border-radius: 0.5rem;',
            },
          };
        },
        parseHTML() {
          return [
            {
              tag: 'video',
            },
          ];
        },
        renderHTML({ HTMLAttributes }) {
          // Convert relative API URLs to absolute URLs for videos
          const attrs = { ...HTMLAttributes };
          if (attrs.src && attrs.src.startsWith('/api/')) {
            attrs.src = `${API_BASE_URL}${attrs.src}`;
          }
          return ['video', attrs];
        },
      }),
      CodeBlockLowlight.extend({
        isolating: true,
        addKeyboardShortcuts() {
          return {
            // Allow backspace at start to convert to paragraph
            'Backspace': () => {
              const { $from } = this.editor.state.selection;
              if ($from.parentOffset === 0 && this.editor.isActive('codeBlock')) {
                return this.editor.commands.setNode('paragraph');
              }
              return false;
            },
            // Allow arrow up at start to exit to paragraph above
            'ArrowUp': () => {
              const { $from } = this.editor.state.selection;
              if ($from.parentOffset === 0 && this.editor.isActive('codeBlock')) {
                const pos = $from.before();
                if (pos <= 1) {
                  // At document start, insert paragraph before
                  this.editor.commands.insertContentAt(0, { type: 'paragraph' });
                  this.editor.commands.setTextSelection(1);
                  return true;
                }
              }
              return false;
            },
          };
        },
      }).configure({
        lowlight,
        HTMLAttributes: {
          class: 'bg-gray-900 text-white p-4 rounded-lg',
        },
      }),
      LinkPreviewExtension,
      AiResponseExtension,
      Placeholder.configure({
        placeholder,
      }),
      TextStyle.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            fontSize: {
              default: null,
              parseHTML: element => element.style.fontSize,
              renderHTML: attributes => {
                if (!attributes.fontSize) {
                  return {};
                }
                return {
                  style: `font-size: ${attributes.fontSize}`,
                };
              },
            },
          };
        },
      }),
      Color,
      FontFamily.configure({
        types: ['textStyle'],
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none',
      },
        handleClick: (_view, _pos, event) => {
          const target = event.target as HTMLElement | null;
          if (target && target.tagName === 'IMG') {
            event.preventDefault();
            const src = (target as HTMLImageElement).src;
            if (src) setLightboxSrc(src);
            return true;
          }
          // Prevent focus jump when clicking on video elements (play button, controls, etc)
          if (target && (target.tagName === 'VIDEO' || target.closest('video'))) {
            return true; // Don't let editor handle video clicks
          }
          return false;
        },
      handleDrop: (_view, event, _slice, _moved) => {
        event.preventDefault();
        
        // Handle file drops
        if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
          const files = Array.from(event.dataTransfer.files);
          
          files.forEach(async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            
            try {
              if (file.type.startsWith('image/')) {
                const response = await fetch(`${API_BASE_URL}/api/uploads/image`, {
                  method: 'POST',
                  body: formData,
                });
                
                if (response.ok) {
                  const data = await response.json();
                  const imageUrl = `${API_BASE_URL}${data.url}`;
                  const pos = _view.posAtCoords({ left: event.clientX, top: event.clientY });
                  if (pos && editor) {
                    editor.chain().focus().insertContentAt(pos.pos, {
                      type: 'image',
                      attrs: { src: imageUrl }
                    }).run();
                  }
                }
              } else {
                const response = await fetch(`${API_BASE_URL}/api/uploads/file`, {
                  method: 'POST',
                  body: formData,
                });
                
                if (response.ok) {
                  const data = await response.json();
                  const fileUrl = `${API_BASE_URL}${data.url}`;
                  const pos = _view.posAtCoords({ left: event.clientX, top: event.clientY });
                  if (pos && editor) {
                    editor.chain().focus().insertContentAt(pos.pos, `<a href="${fileUrl}" download="${data.filename}" class="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 border border-gray-300">📎 ${data.filename}</a> `).run();
                  }
                }
              }
            } catch (error) {
              console.error('Failed to upload dropped file:', error);
            }
          });
          
          return true;
        }
        
        return false;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          // Check for images first
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              event.preventDefault();
              const file = items[i].getAsFile();
              if (file) {
                const formData = new FormData();
                formData.append('file', file);
                
                fetch(`${API_BASE_URL}/api/uploads/image`, {
                  method: 'POST',
                  body: formData,
                })
                  .then(response => response.json())
                  .then(data => {
                    const imageUrl = `${API_BASE_URL}${data.url}`;
                    editor?.chain().focus().setImage({ src: imageUrl }).run();
                  })
                  .catch(error => {
                    console.error('Failed to upload pasted image:', error);
                  });
              }
              return true;
            }
          }
        }
        
        // Check for URLs in text
        const text = event.clipboardData?.getData('text/plain');
        if (text) {
          // Simple URL detection - matches http(s) URLs
          const urlRegex = /^https?:\/\/[^\s]+$/;
          if (urlRegex.test(text.trim())) {
            event.preventDefault();
            
            // Try to fetch link preview
            fetchLinkPreview(text.trim())
              .then(preview => {
                if (preview && editor) {
                  // Insert link preview card (user can click to edit title/description)
                  editor.chain().focus().insertContent({
                    type: 'linkPreview',
                    attrs: preview,
                  }).run();
                } else {
                  // Insert a basic preview that can be edited
                  editor?.chain().focus().insertContent({
                    type: 'linkPreview',
                    attrs: {
                      url: text.trim(),
                      title: 'Click to add title',
                      description: 'Click to add description',
                      image: null,
                      site_name: new URL(text.trim()).hostname,
                    },
                  }).run();
                }
              })
              .catch(() => {
                // Insert a basic preview that can be edited
                editor?.chain().focus().insertContent({
                  type: 'linkPreview',
                  attrs: {
                    url: text.trim(),
                    title: 'Click to add title',
                    description: 'Click to add description',
                    image: null,
                    site_name: new URL(text.trim()).hostname,
                  },
                }).run();
              });
            
            return true;
          }
        }
        
        return false;
      },
    },
  });

  // Speech recognition callback - uses refs to avoid stale closure issues
  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    if (!editor || !text.trim()) return;
    
    // Delete any existing interim text first (using tracked range)
    if (interimRangeRef.current) {
      const { from, to } = interimRangeRef.current;
      editor.chain()
        .focus()
        .deleteRange({ from, to })
        .run();
      interimRangeRef.current = null;
      interimTextRef.current = '';
    }
    
    if (isFinal) {
      // Final result: insert as plain text permanently
      editor.chain().focus().insertContent(text + ' ').run();
      setDictationError(null);
    } else {
      // Interim result: insert styled text and track the range
      const { from } = editor.state.selection;
      editor.chain()
        .focus()
        .insertContent(text)
        .run();
      
      // Track the range we just inserted (from original position to new position)
      const { to } = editor.state.selection;
      interimRangeRef.current = { from, to };
      interimTextRef.current = text;
      
      // Apply interim styling by selecting and setting color
      editor.chain()
        .setTextSelection({ from, to })
        .setColor('#9ca3af')
        .run();
    }
  }, [editor]);

  // Initialize speech recognition
  const {
    isRecording,
    isSupported,
    error: speechError,
    toggleRecording,
  } = useSpeechRecognition({
    onTranscript: handleTranscript,
    continuous: true,
  });
  
  // When recording stops, convert any remaining interim text to permanent
  useEffect(() => {
    if (!isRecording && interimRangeRef.current && editor) {
      const { from, to } = interimRangeRef.current;
      const savedText = interimTextRef.current;
      
      if (savedText) {
        // Remove the styled interim text and insert plain text
        editor.chain()
          .focus()
          .deleteRange({ from, to })
          .insertContentAt(from, savedText + ' ')
          .run();
      }
      
      // Clear refs
      interimRangeRef.current = null;
      interimTextRef.current = '';
    }
  }, [isRecording, editor]);


  // Show dictation errors
  useEffect(() => {
    if (speechError) {
      setDictationError(speechError);
      
      // Don't auto-clear permission errors - user needs to take action
      if (speechError.includes('permission') || speechError.includes('denied') || speechError.includes('allow')) {
        return; // Keep error visible until user takes action
      }
      
      // Clear other errors after 8 seconds
      const timeout = setTimeout(() => setDictationError(null), 8000);
      return () => clearTimeout(timeout);
    }
  }, [speechError]);

  // Close lightbox on Escape key (must be before conditional return)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxSrc(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close font menus when clicking outside (must be before conditional return)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.font-menu-container')) {
        setShowFontFamilyMenu(false);
        setShowFontSizeMenu(false);
        setShowHeadingMenu(false);
      }
    };
    if (showFontFamilyMenu || showFontSizeMenu || showHeadingMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFontFamilyMenu, showFontSizeMenu, showHeadingMenu]);

  // Add click handler for copy button on pre elements
  useEffect(() => {
    const handlePreClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'PRE') {
        const rect = target.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Check if click is in the top-right area where the copy button is (2rem + padding)
        if (clickX > rect.width - 48 && clickY < 48) {
          e.preventDefault();
          e.stopPropagation();
          
          const code = target.querySelector('code');
          const text = code?.textContent || target.textContent || '';
          
          try {
            await navigator.clipboard.writeText(text);
            // Temporarily change the icon to show success
            target.style.setProperty('--copy-text', '"✓"');
            
            setTimeout(() => {
              target.style.removeProperty('--copy-text');
            }, 2000);
          } catch (err) {
            console.error('Failed to copy:', err);
          }
        }
      }
    };
    
    document.addEventListener('click', handlePreClick);
    return () => document.removeEventListener('click', handlePreClick);
  }, []);

  if (!editor) {
    return null;
  }

  const handlePreformattedClick = () => {
    const { empty } = editor.state.selection;
    // If inside preformatted, unwrap to paragraph
    if (editor.isActive('preformattedText')) {
      editor.chain().focus().setParagraph().run();
      return;
    }
    // If selection exists, convert selected block(s) to preformatted
    if (!empty) {
      editor
        .chain()
        .focus()
        .command(({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to, '\n');
          const preNode = state.schema.nodes.preformattedText.create({}, state.schema.text(text));
          tr.replaceRangeWith(from, to, preNode);
          // If inserted at the very start, ensure a paragraph exists above to allow cursor before the box
          if (from <= 2) {
            tr.insert(1, state.schema.nodes.paragraph.create());
          }
          if (dispatch) dispatch(tr);
          return true;
        })
        .run();
      return;
    }
    // If no selection and current node is empty paragraph, convert to preformatted
    const { $from } = editor.state.selection;
    const currentNode = $from.parent;
    
    if (currentNode.type.name === 'paragraph' && currentNode.content.size === 0) {
      editor.chain().focus().setNode('preformattedText').run();
    } else {
      // Otherwise insert a new preformatted block after current position
      editor.chain().focus().insertContent({ type: 'preformattedText' }).run();
    }
  };

  const handleCodeBlockClick = () => {
    const { empty } = editor.state.selection;
    // If inside a code block, unwrap by converting the block to a paragraph
    if (editor.isActive('codeBlock')) {
      const unwrapped = editor
        .chain()
        .focus()
        .command(({ state, tr }) => {
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === 'codeBlock') {
              const pos = $from.before(depth);
              tr.setNodeMarkup(pos, state.schema.nodes.paragraph);
              return true;
            }
          }
          return false;
        })
        .run();
      if (!unwrapped) {
        // Fallback to default toggle if direct unwrap failed
        editor.chain().focus().toggleCodeBlock().run();
      }
      return;
    }
    // If selection exists, convert selected block(s) to code block
    if (!empty) {
      editor.chain().focus().setCodeBlock().run();
      return;
    }
    // Otherwise, toggle code block on current block
    editor.chain().focus().toggleCodeBlock().run();
  };

  const normalizeLinkUrl = (value: string) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const tryUrl = (candidate: string) => {
      try {
        const url = new URL(candidate);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return url.toString();
        }
        return null;
      } catch {
        return null;
      }
    };

    return tryUrl(trimmed) ?? tryUrl(`https://${trimmed}`);
  };

  const addLink = () => {
    if (!editor) return;

    setLinkModalMode('link');

    const { from, to, $from } = editor.state.selection;
    let selectionRange = { from, to };

    if (editor.isActive('link')) {
      const linkType = editor.state.schema.marks.link;
      const range = linkType ? getMarkRange($from, linkType) : null;
      if (range) {
        selectionRange = range;
      }
    }

    linkSelectionRef.current = selectionRange;

    const currentLink = editor.isActive('link') ? editor.getAttributes('link') : null;
    setLinkInputValue(currentLink?.href || '');
    setEditingExistingLink(Boolean(currentLink?.href));
    setLinkModalError(null);
    setShowLinkModal(true);
  };

  const closeLinkModal = () => {
    setShowLinkModal(false);
    setLinkModalError(null);
    setLinkInputValue('');
    setEditingExistingLink(false);
    setLinkModalMode('link');
    linkSelectionRef.current = null;
  };

  const handleLinkModalSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!editor) return;

    const trimmed = linkInputValue.trim();
    if (!trimmed) {
      if (linkModalMode === 'link' && editingExistingLink) {
        handleRemoveLink();
        return;
      }
      setLinkModalError('Enter a URL to insert.');
      return;
    }

    const normalizedUrl = normalizeLinkUrl(trimmed);
    if (!normalizedUrl) {
      setLinkModalError('Enter a valid http(s) URL.');
      return;
    }

    if (linkModalMode === 'preview') {
      await insertLinkPreview(normalizedUrl);
      closeLinkModal();
      return;
    }

    const selection = linkSelectionRef.current;
    if (selection && selection.from !== selection.to) {
      editor.chain().focus().setTextSelection(selection).setLink({ href: normalizedUrl }).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${normalizedUrl}" target="_blank" rel="noopener noreferrer">${normalizedUrl}</a> `)
        .run();
    }

    closeLinkModal();
  };

  const handleRemoveLink = () => {
    if (!editor) return;

    const selection = linkSelectionRef.current;
    if (selection && selection.from !== selection.to) {
      editor.chain().focus().setTextSelection(selection).unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }

    closeLinkModal();
  };

  const addImage = () => {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      // Upload image
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/uploads/image`, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) throw new Error('Upload failed');
        
        const data = await response.json();
        const imageUrl = `${API_BASE_URL}${data.url}`;
        
        editor.chain().focus().setImage({ src: imageUrl }).run();
      } catch (error) {
        console.error('Failed to upload image:', error);
        alert('Failed to upload image. Please try again.');
      }
    };
    
    input.click();
  };

  const addFile = () => {
    const input = document.createElement('input');
    input.type = 'file';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${API_BASE_URL}/api/uploads/file`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();
        const fileUrl = `${API_BASE_URL}${data.url}`;

        // Insert as a download link
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${fileUrl}" download="${data.filename}" class="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 border border-gray-300">📎 ${data.filename}</a> `)
          .run();
      } catch (error) {
        console.error('Failed to upload file:', error);
        alert('Failed to upload file. Please try again.');
      }
    };

    input.click();
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

  const insertLinkPreview = async (url: string) => {
    if (!editor) return;

    const buildFallback = () => {
      let hostname = url;
      try {
        hostname = new URL(url).hostname;
      } catch {
        // ignore parsing errors, keep original string
      }
      return {
        url,
        title: 'Click to add title',
        description: 'Click to add description',
        image: null,
        site_name: hostname,
      };
    };

    try {
      const preview = await fetchLinkPreview(url);
      const attrs = preview ?? buildFallback();
      editor
        ?.chain()
        .focus()
        .insertContent({
          type: 'linkPreview',
          attrs,
        })
        .run();
    } catch (error) {
      console.error('Failed to add link preview:', error);
      editor
        ?.chain()
        .focus()
        .insertContent({
          type: 'linkPreview',
          attrs: buildFallback(),
        })
        .run();
    }
  };

  const addLinkPreview = () => {
    if (!editor) return;
    setLinkModalMode('preview');
    setLinkInputValue('');
    setEditingExistingLink(false);
    setLinkModalError(null);
    linkSelectionRef.current = null;
    setShowLinkModal(true);
  };

  const sendToLlm = async () => {
    if (!editor || !entryId) return;

    const { from, to } = editor.state.selection;
    if (from === to) {
      // No selection
      setLlmError('Please select some text to send to the AI.');
      setTimeout(() => setLlmError(null), 3000);
      return;
    }

    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) {
      setLlmError('Please select some text to send to the AI.');
      setTimeout(() => setLlmError(null), 3000);
      return;
    }

    setIsSendingToLlm(true);
    setLlmError(null);

    try {
      const response = await llmApi.send({
        entry_id: entryId,
        prompt: selectedText,
        continue_conversation: true,
      });

      // Insert AI response as a styled block after the selection
      editor
        .chain()
        .focus()
        .setTextSelection(to)
        .insertContent([
          { type: 'paragraph' },
          {
            type: 'aiResponse',
            attrs: {
              content: response.response,
              provider: response.provider,
              inputTokens: response.input_tokens,
              outputTokens: response.output_tokens,
            },
          },
          { type: 'paragraph' },
        ])
        .run();
    } catch (error: any) {
      console.error('Failed to send to LLM:', error);
      const errorMessage =
        error.response?.data?.detail || 'Failed to get AI response. Check your API key in Settings.';
      setLlmError(errorMessage);
      setTimeout(() => setLlmError(null), 8000);
    } finally {
      setIsSendingToLlm(false);
    }
  };

  const openCamera = async () => {
    try {
      console.log('[Camera] Opening camera with web API');
      
      // Use web camera API for both browser and Tauri (it works in the webview!)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setShowCamera(true);
      
      // Wait for video element to be available
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Failed to access camera:', error);
      alert('Failed to access camera. Please check your camera permissions.');
    }
  };

  const capturePhoto = async () => {
    if (!editor) return;
    
    // Capture from video canvas (works in both browser and Tauri webview)
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      
      // Create preview URL and store blob for later upload
      const previewUrl = URL.createObjectURL(blob);
      setCapturedPhotoUrl(previewUrl);
      setCapturedPhotoBlob(blob);
      
      // Stop the camera stream after capture (to release the camera)
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }, 'image/jpeg', 1.0);
  };

  const usePhoto = async () => {
    if (!editor || !capturedPhotoBlob) return;
    
    setIsCapturingPhoto(true); // Reuse for "saving" state
    try {
      const formData = new FormData();
      formData.append('file', capturedPhotoBlob, 'camera-photo.jpg');
      
      const response = await fetch(`${API_BASE_URL}/api/uploads/image`, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        const imageUrl = `${API_BASE_URL}${data.url}`;
        editor.chain().focus().setImage({ src: imageUrl }).run();
        closeCamera();
      } else {
        throw new Error('Failed to upload photo');
      }
    } catch (error) {
      console.error('Failed to upload photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const retakePhoto = async () => {
    // Clear the captured photo
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    setCapturedPhotoUrl(null);
    setCapturedPhotoBlob(null);
    
    // Restart the camera stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Failed to restart camera:', error);
    }
  };

  const closeCamera = () => {
    // Stop any camera stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    // Clean up captured photo preview
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    setCapturedPhotoUrl(null);
    setCapturedPhotoBlob(null);
    setShowCamera(false);
    setIsCapturingPhoto(false);
  };

  const openVideoRecorder = async () => {
    try {
      // Use web camera/mic API for preview (works in both browser and Tauri webview)
      console.log('[Video] Opening video recorder');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setShowVideoRecorder(true);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Failed to access camera/microphone:', error);
      alert('Failed to access camera and microphone. Please check your permissions.');
    }
  };

  const startVideoRecording = () => {
    // Use web MediaRecorder for both browser and Tauri
    if (!videoRef.current || !videoRef.current.srcObject) return;
    
    const stream = videoRef.current.srcObject as MediaStream;
    recordedChunksRef.current = [];
    
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm',
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('file', blob, 'recorded-video.webm');
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/uploads/file`, {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const data = await response.json();
          const videoUrl = `${API_BASE_URL}${data.url}`;
          
          // Insert video using the custom video node
          editor?.chain().focus().insertContent({
            type: 'video',
            attrs: {
              src: videoUrl,
              controls: true,
              style: 'width: 100%; height: auto; border-radius: 0.5rem;',
            },
          }).run();
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        console.error('Failed to upload video:', error);
        alert('Failed to upload video. Please try again.');
      } finally {
        // Always close the recorder modal, even on failure
        closeVideoRecorder();
      }
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecordingVideo(true);
  };

  const stopVideoRecording = async () => {
    // Stop MediaRecorder (works in both browser and Tauri webview)
    if (mediaRecorderRef.current && isRecordingVideo) {
      mediaRecorderRef.current.stop();
      setIsRecordingVideo(false);
    }
  };

  const closeVideoRecorder = () => {
    // Stop MediaRecorder first
    if (mediaRecorderRef.current && isRecordingVideo) {
      mediaRecorderRef.current.stop();
    }
    
    // Stop camera stream before closing modal for smoother transition
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // Small delay for smoother visual transition
    setIsRecordingVideo(false);
    requestAnimationFrame(() => {
      setShowVideoRecorder(false);
    });
  };

  const toggleJsonFormat = () => {
    if (showJsonFormatted) {
      // Restore original content
      editor?.commands.setContent(originalContent);
      setShowJsonFormatted(false);
      setJsonError(null);
    } else {
      try {
        // Save original content
        setOriginalContent(editor?.getHTML() || '');
        
        // Get the current content as text
        const text = editor?.getText() || '';
        
        // Try to parse it as JSON
        const parsed = JSON.parse(text);
        
        // Format it with 2-space indentation
        const formatted = JSON.stringify(parsed, null, 2);
        
        // Replace the content with formatted JSON in a code block
        editor?.commands.setContent(`<pre><code>${formatted}</code></pre>`);
        
        setShowJsonFormatted(true);
        setJsonError(null);
      } catch (error) {
        // Show error message
        const errorMessage = error instanceof Error ? error.message : 'Invalid JSON';
        setJsonError(errorMessage);
        
        // Clear error after 5 seconds
        setTimeout(() => setJsonError(null), 5000);
      }
    }
  };

  const validateYaml = () => {
    try {
      // Get the current content as text
      const text = editor?.getText() || '';
      
      // Try to parse it as YAML
      yaml.load(text);
      
      // If successful, show success message briefly
      setYamlError('✓ Valid YAML');
      
      // Clear success message after 3 seconds
      setTimeout(() => setYamlError(null), 3000);
    } catch (error) {
      // Show error message
      const errorMessage = error instanceof Error ? error.message : 'Invalid YAML';
      setYamlError(errorMessage);
      
      // Clear error after 5 seconds
      setTimeout(() => setYamlError(null), 5000);
    }
  };

  const ToolbarButton = ({
    onClick,
    active,
    children,
    title,
    disabled = false,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
  }) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        if (disabled) return;
        onClick();
      }}
      className="p-2 rounded transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-accent)' : 'transparent',
        color: active ? 'var(--color-accent-text)' : disabled ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
      title={title}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  );

  return (
    <div 
      className="rounded-lg overflow-hidden"
      style={{
        border: '1px solid var(--color-border-primary)',
        backgroundColor: 'var(--color-bg-primary)'
      }}
    >
      {/* Toolbar */}
      <div 
        className="editor-toolbar flex flex-wrap gap-1 items-center p-2"
        style={{
          borderBottom: '1px solid var(--color-border-primary)',
          backgroundColor: 'var(--color-bg-tertiary)'
        }}
      >
        {/* History Group */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border-primary)', margin: '0 4px' }} />

        {!canUseMediaCapture && showMediaButtons && (
          <span className="text-xs text-[var(--color-text-tertiary)] px-2">
            Camera, video, and mic capture require HTTPS or running Track the Thing locally.
          </span>
        )}

        {/* Text Formatting Group */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        {/* Text Color */}
        <div className="relative">
          <input
            type="color"
            onChange={(e) => {
              const color = e.target.value;
              editor.chain().focus().setColor(color).run();
            }}
            value={normalizeColorForInput(editor.getAttributes('textStyle').color, '#000000')}
            className="h-8 w-8 rounded cursor-pointer"
            style={{ 
              border: '1px solid var(--color-border-primary)',
              backgroundColor: 'transparent',
              padding: '2px'
            }}
            title="Text Color"
          />
        </div>

        {/* Font Family */}
        <div className="relative font-menu-container">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowFontFamilyMenu(!showFontFamilyMenu);
            }}
            className="p-2 rounded transition-colors"
            style={{
              backgroundColor: showFontFamilyMenu ? 'var(--color-accent)' : 'transparent',
              color: showFontFamilyMenu ? 'var(--color-accent-text)' : 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              if (!showFontFamilyMenu) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showFontFamilyMenu) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            title="Font Family"
            type="button"
          >
            <Type className="h-4 w-4" />
          </button>
          {showFontFamilyMenu && (
            <div
              className="absolute top-full left-0 mt-1 rounded shadow-lg z-50 border font-menu-container"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border-primary)',
                minWidth: '150px'
              }}
            >
              {[
                { label: 'Default', value: '' },
                { label: 'Arial', value: 'Arial, sans-serif' },
                { label: 'Times New Roman', value: "'Times New Roman', serif" },
                { label: 'Courier New', value: "'Courier New', monospace" },
                { label: 'Georgia', value: 'Georgia, serif' },
                { label: 'Verdana', value: 'Verdana, sans-serif' },
                { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
                { label: 'Comic Sans MS', value: "'Comic Sans MS', cursive" },
                { label: 'Impact', value: 'Impact, fantasy' },
                { label: 'Lucida Console', value: "'Lucida Console', monospace" },
                { label: 'Palatino', value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
                { label: 'Tahoma', value: 'Tahoma, sans-serif' },
                { label: 'Century Gothic', value: "'Century Gothic', sans-serif" },
                { label: 'Brush Script MT', value: "'Brush Script MT', cursive" },
              ].map((font) => (
                <button
                  key={font.value || 'default'}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (font.value === '') {
                      editor.chain().focus().unsetFontFamily().run();
                    } else {
                      editor.chain().focus().setFontFamily(font.value).run();
                    }
                    setShowFontFamilyMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-colors"
                  style={{
                    color: 'var(--color-text-primary)',
                    backgroundColor: (font.value === '' && !editor.getAttributes('textStyle').fontFamily) || editor.getAttributes('textStyle').fontFamily === font.value
                      ? 'var(--color-bg-hover)'
                      : 'transparent',
                    fontFamily: font.value || 'inherit'
                  }}
                >
                  {font.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font Size */}
        <div className="relative font-menu-container">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowFontSizeMenu(!showFontSizeMenu);
            }}
            className="p-2 rounded transition-colors"
            style={{
              backgroundColor: showFontSizeMenu ? 'var(--color-accent)' : 'transparent',
              color: showFontSizeMenu ? 'var(--color-accent-text)' : 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              if (!showFontSizeMenu) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showFontSizeMenu) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            title="Font Size"
            type="button"
          >
            <CaseSensitive className="h-4 w-4" />
          </button>
          {showFontSizeMenu && (
            <div
              className="absolute top-full left-0 mt-1 rounded shadow-lg z-50 border font-menu-container"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border-primary)',
                minWidth: '100px'
              }}
            >
              {['10px', '12px', '14px', '16px', '18px', '20px', '22px', '24px', '28px', '32px', '36px', '42px', '48px', '56px', '64px', '72px'].map((size) => (
                <button
                  key={size}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
                    setShowFontSizeMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-colors"
                  style={{
                    color: 'var(--color-text-primary)',
                    backgroundColor: editor.getAttributes('textStyle').fontSize === size
                      ? 'var(--color-bg-hover)'
                      : 'transparent',
                    fontSize: size
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border-primary)', margin: '0 4px' }} />

        {/* Block Formatting Group */}
        {/* Heading Picker */}
        <div className="relative font-menu-container">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowHeadingMenu(!showHeadingMenu);
            }}
            className="p-2 rounded transition-colors"
            style={{
              backgroundColor: (showHeadingMenu || editor.isActive('heading')) ? 'var(--color-accent)' : 'transparent',
              color: (showHeadingMenu || editor.isActive('heading')) ? 'var(--color-accent-text)' : 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              if (!showHeadingMenu && !editor.isActive('heading')) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showHeadingMenu && !editor.isActive('heading')) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            title="Headings"
            type="button"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          {showHeadingMenu && (
            <div
              className="absolute top-full left-0 mt-1 rounded shadow-lg z-50 border font-menu-container"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border-primary)',
                minWidth: '150px'
              }}
            >
              {[
                { label: 'Normal', level: 0 },
                { label: 'Heading 1', level: 1 },
                { label: 'Heading 2', level: 2 },
                { label: 'Heading 3', level: 3 },
                { label: 'Heading 4', level: 4 },
                { label: 'Heading 5', level: 5 },
                { label: 'Heading 6', level: 6 },
              ].map((heading) => (
                <button
                  key={heading.level}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (heading.level === 0) {
                      editor.chain().focus().setParagraph().run();
                    } else {
                      editor.chain().focus().toggleHeading({ level: heading.level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
                    }
                    setShowHeadingMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-colors"
                  style={{
                    color: 'var(--color-text-primary)',
                    backgroundColor: (heading.level === 0 && !editor.isActive('heading')) || editor.isActive('heading', { level: heading.level })
                      ? 'var(--color-bg-hover)'
                      : 'transparent',
                    fontSize: heading.level === 0 ? '14px' : `${20 - heading.level * 2}px`,
                    fontWeight: heading.level === 0 ? 'normal' : 'bold'
                  }}
                >
                  {heading.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border-primary)', margin: '0 4px' }} />

        {/* Lists Group */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')}
          title="Task List"
        >
          <CheckSquare className="h-4 w-4" />
        </ToolbarButton>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border-primary)', margin: '0 4px' }} />

        {/* Code Group */}
        <ToolbarButton
          onClick={() => {
            // Check if selection spans multiple lines
            const { from, to } = editor.state.selection;
            const text = editor.state.doc.textBetween(from, to, '\n');
            const hasMultipleLines = text.includes('\n');
            
            if (hasMultipleLines) {
              // If multiline, convert to code block instead
              editor.chain().focus().setCodeBlock().run();
            } else {
              // If single line, toggle inline code
              editor.chain().focus().toggleCode().run();
            }
          }}
          active={editor.isActive('code')}
          title="Inline Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={handleCodeBlockClick}
          active={editor.isActive('codeBlock')}
          title="Code Block"
        >
          <Code2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={handlePreformattedClick}
          active={editor.isActive('preformattedText')}
          title="Preformatted Text"
        >
          <FileText className="h-4 w-4" />
        </ToolbarButton>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border-primary)', margin: '0 4px' }} />

        {/* Insert/Embed Group */}
        <ToolbarButton onClick={addLink} active={editor.isActive('link')} title="Add Link">
          <Link2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton onClick={addLinkPreview} title="Add Link Preview">
          <ExternalLink className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton onClick={addImage} title="Add Image">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton onClick={addFile} title="Attach File">
          <Paperclip className="h-4 w-4" />
        </ToolbarButton>

        {/* Emoji Picker */}
        <EmojiPicker onEmojiSelect={handleEmojiSelect} />

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border-primary)', margin: '0 4px' }} />

        {/* Media Capture Group */}
        {/* Voice Dictation Button */}
        {isSupported && canUseMediaCapture && (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              toggleRecording();
            }}
            className={`p-2 rounded transition-colors ${isRecording ? 'recording-pulse' : ''}`}
            style={{
              backgroundColor: isRecording ? '#ef4444' : 'transparent',
              color: isRecording ? 'white' : 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              if (!isRecording) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRecording) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            title={
              isRecording 
                ? 'Stop Recording' 
                : !isSecureContext && !isLocalhost && isMobile
                  ? 'Voice Dictation (may require HTTPS on mobile)'
                  : 'Start Voice Dictation'
            }
            type="button"
          >
            <Mic className="h-4 w-4" />
          </button>
        )}

        {/* Camera Button - Only show on desktop or HTTPS mobile */}
        {showMediaButtons && (
          <ToolbarButton
            onClick={openCamera}
            title={
              canUseMediaCapture
                ? 'Take Photo'
                : 'Camera access requires HTTPS or running on localhost'
            }
            disabled={!canUseMediaCapture}
          >
            <Camera className="h-4 w-4" />
          </ToolbarButton>
        )}

        {/* Video Button - Only show on desktop or HTTPS mobile */}
        {showMediaButtons && (
          <ToolbarButton
            onClick={openVideoRecorder}
            title={
              canUseMediaCapture
                ? 'Record Video'
                : 'Video recording requires HTTPS or running on localhost'
            }
            disabled={!canUseMediaCapture}
          >
            <Video className="h-4 w-4" />
          </ToolbarButton>
        )}

        {/* Send to LLM Button */}
        <ToolbarButton
          onClick={sendToLlm}
          disabled={isSendingToLlm || !entryId}
          title={
            !entryId
              ? 'Save entry first to use AI'
              : isSendingToLlm
              ? 'Sending to AI...'
              : 'Send selected text to AI'
          }
        >
          {isSendingToLlm ? (
            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </ToolbarButton>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border-primary)', margin: '0 4px' }} />

        {/* Tools Group */}
        <ToolbarButton
          onClick={() => {
            // Only toggle if there's content, or if already showing preview (to allow hiding)
            if (showMarkdownPreview) {
              setShowMarkdownPreview(false);
              return;
            }
            const editorHtml = editor?.getHTML() || '';
            const hasContent = editorHtml && 
              editorHtml !== '<p></p>' && 
              editorHtml.replace(/<[^>]*>/g, '').trim().length > 0;
            if (hasContent) {
              setShowMarkdownPreview(true);
            }
          }}
          active={showMarkdownPreview}
          title={showMarkdownPreview ? "Hide Markdown Preview" : "Show Markdown Preview"}
        >
          <span className="font-bold text-sm">M</span>
        </ToolbarButton>

        <ToolbarButton
          onClick={toggleJsonFormat}
          active={showJsonFormatted}
          title={showJsonFormatted ? "Restore Original Content" : "Format JSON (prettify and validate)"}
        >
          <span className="font-bold text-sm">J</span>
        </ToolbarButton>

        <ToolbarButton
          onClick={validateYaml}
          title="Validate YAML"
        >
          <span className="font-bold text-sm">Y</span>
        </ToolbarButton>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border-primary)', margin: '0 4px' }} />

        {/* View Group */}
        <ToolbarButton
          onClick={() => setIsExpanded(!isExpanded)}
          active={isExpanded}
          title={isExpanded ? "Collapse editor" : "Expand editor"}
        >
          {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </ToolbarButton>
      </div>

      {/* Editor and Markdown Preview - both share same container to prevent size changes */}
      <div className={isExpanded ? 'editor-expanded' : ''} style={{ position: 'relative' }}>
        {/* Editor always rendered to maintain consistent sizing */}
        <div style={{ visibility: showMarkdownPreview ? 'hidden' : 'visible' }}>
          <EditorContent editor={editor} className="prose max-w-none" />
        </div>
        
        {/* Markdown preview overlays when active */}
        {showMarkdownPreview && (
          <div 
            className="prose max-w-none p-4 rounded border"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)',
              overflowY: 'auto'
            }}
            dangerouslySetInnerHTML={{
              __html: (() => {
                // Get plain text from editor to render pasted markdown directly
                const plainText = editor?.getText() || '';
                return marked.parse(plainText) as string;
              })()
            }}
          />
        )}
      </div>

      {/* Dictation Error Alert */}
      {dictationError && (
        <div 
          className="m-4 p-4 rounded-lg text-sm shadow-lg relative"
          style={{
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            border: '2px solid #ef4444'
          }}
        >
          <button
            onClick={() => setDictationError(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xl leading-none"
            title="Dismiss"
          >
            ×
          </button>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-lg">🎤</div>
            <div className="pr-6">
              <strong className="block mb-1">Voice Dictation Issue</strong>
              <p className="text-sm whitespace-pre-line">{dictationError}</p>
            </div>
          </div>
        </div>
      )}

      {/* JSON Error Alert */}
      {jsonError && (
        <div 
          className="m-4 p-4 rounded-lg text-sm shadow-lg relative"
          style={{
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            border: '2px solid #ef4444'
          }}
        >
          <button
            onClick={() => setJsonError(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xl leading-none"
            title="Dismiss"
          >
            ×
          </button>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-lg">⚠️</div>
            <div className="pr-6">
              <strong className="block mb-1">JSON Format Error</strong>
              <p className="text-sm whitespace-pre-line">{jsonError}</p>
            </div>
          </div>
        </div>
      )}

      {/* YAML Validation Alert */}
      {yamlError && (
        <div 
          className="m-4 p-4 rounded-lg text-sm shadow-lg relative"
          style={{
            backgroundColor: yamlError.startsWith('✓') ? '#f0fdf4' : '#fef2f2',
            color: yamlError.startsWith('✓') ? '#166534' : '#991b1b',
            border: yamlError.startsWith('✓') ? '2px solid #22c55e' : '2px solid #ef4444'
          }}
        >
          <button
            onClick={() => setYamlError(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xl leading-none"
            title="Dismiss"
          >
            ×
          </button>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-lg">{yamlError.startsWith('✓') ? '✓' : '⚠️'}</div>
            <div className="pr-6">
              <strong className="block mb-1">{yamlError.startsWith('✓') ? 'YAML Validation' : 'YAML Validation Error'}</strong>
              <p className="text-sm whitespace-pre-line">{yamlError}</p>
            </div>
          </div>
        </div>
      )}

      {/* LLM Error Alert */}
      {llmError && (
        <div
          className="m-4 p-4 rounded-lg text-sm shadow-lg relative"
          style={{
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            border: '2px solid #ef4444',
          }}
        >
          <button
            onClick={() => setLlmError(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xl leading-none"
            title="Dismiss"
          >
            ×
          </button>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-lg">🤖</div>
            <div className="pr-6">
              <strong className="block mb-1">AI Error</strong>
              <p className="text-sm whitespace-pre-line">{llmError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div
            className="rounded-lg shadow-2xl w-full max-w-md p-6"
            style={{
              backgroundColor: 'var(--color-card-bg)',
              border: '1px solid var(--color-border-primary)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{linkModalTitle}</h3>
              <button
                onClick={closeLinkModal}
                className="text-2xl leading-none text-gray-500 hover:text-gray-700"
                type="button"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleLinkModalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">URL</label>
                <input
                  type="text"
                  value={linkInputValue}
                  onChange={(e) => {
                    setLinkInputValue(e.target.value);
                    if (linkModalError) {
                      setLinkModalError(null);
                    }
                  }}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    border: '1px solid var(--color-border-primary)',
                    backgroundColor: 'var(--color-bg-secondary)',
                  }}
                  autoFocus
                />
                {linkModalError && (
                  <p className="text-sm text-red-600 mt-2">{linkModalError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                {!isPreviewMode && editingExistingLink && (
                  <button
                    type="button"
                    onClick={handleRemoveLink}
                    className="px-4 py-2 rounded-lg border text-sm font-medium"
                    style={{
                      borderColor: 'var(--color-border-primary)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Remove Link
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeLinkModal}
                  className="px-4 py-2 rounded-lg border text-sm font-medium"
                  style={{
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-text)',
                  }}
                >
                  {linkModalSubmitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            alt="Preview"
          />
        </div>
      )}

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {capturedPhotoUrl ? 'Review Photo' : 'Take Photo'}
              </h3>
              <button
                onClick={closeCamera}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            {/* Photo Preview - shown after capture */}
            {capturedPhotoUrl ? (
              <>
                <div className="relative">
                  <img 
                    src={capturedPhotoUrl} 
                    alt="Captured photo" 
                    className="w-full rounded-lg"
                  />
                </div>
                <div className="mt-4 flex gap-3 justify-center">
                  {isCapturingPhoto ? (
                    <div className="flex items-center gap-2 px-6 py-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600"></div>
                      <span className="text-gray-600">Saving...</span>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={usePhoto}
                        className="px-6 py-3 rounded-lg transition-colors font-medium"
                        style={{
                          backgroundColor: 'var(--color-accent)',
                          color: 'var(--color-accent-text)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent)'}
                      >
                        Use Photo
                      </button>
                      <button
                        onClick={retakePhoto}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Retake
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              /* Live camera preview (works in both browser and Tauri) */
              <>
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <div className="mt-4 flex gap-3 justify-center">
                  <button
                    onClick={capturePhoto}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    <Camera className="h-5 w-5 inline mr-2" />
                    Take Photo
                  </button>
                  <button
                    onClick={closeCamera}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Video Recorder Modal */}
      {showVideoRecorder && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Record Video</h3>
              <button
                onClick={closeVideoRecorder}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={!isRecordingVideo}
                className="w-full rounded-lg"
              />
              {isRecordingVideo && (
                <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                  Recording...
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-3 justify-center">
              {!isRecordingVideo ? (
                <>
                  <button
                    onClick={startVideoRecording}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    <Video className="h-5 w-5 inline mr-2" />
                    Start Recording
                  </button>
                  <button
                    onClick={closeVideoRecorder}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={stopVideoRecording}
                  className="px-6 py-3 rounded-lg transition-colors font-medium"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-text)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent)'}
                >
                  Stop & Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;

