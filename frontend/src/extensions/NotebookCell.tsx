import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useCallback } from 'react';
import { Play, Square, Trash2, RotateCcw, Plus } from 'lucide-react';
import { jupyterApi } from '../api';

// Component for rendering notebook cells
const NotebookCellComponent = ({ node, updateAttributes, deleteNode, editor, getPos }: NodeViewProps) => {
  const code = node.attrs.code as string || '';
  const outputs = node.attrs.outputs as string || '[]';
  const status = node.attrs.status as string || 'idle';
  const executionCount = node.attrs.executionCount as number | null;
  const errorName = node.attrs.errorName as string | null;
  const errorValue = node.attrs.errorValue as string | null;
  const traceback = node.attrs.traceback as string | null;

  const [isExecuting, setIsExecuting] = useState(false);
  const [localCode, setLocalCode] = useState(code);

  // Add a new cell below this one
  const addCellBelow = useCallback(() => {
    if (!editor || typeof getPos !== 'function') return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    
    // Insert after this node
    const endPos = pos + node.nodeSize;
    editor.chain()
      .focus()
      .insertContentAt(endPos, {
        type: 'notebookCell',
        attrs: {
          code: '',
          outputs: '[]',
          status: 'idle',
          executionCount: null,
        },
      })
      .run();
  }, [editor, getPos, node.nodeSize]);

  const parsedOutputs = outputs ? JSON.parse(outputs) : [];
  const parsedTraceback = traceback ? JSON.parse(traceback) : null;

  const executeCode = useCallback(async () => {
    if (!localCode.trim()) return;

    setIsExecuting(true);
    updateAttributes({ status: 'running' });

    try {
      const result = await jupyterApi.execute(localCode);
      updateAttributes({
        code: localCode,
        outputs: JSON.stringify(result.outputs),
        executionCount: result.execution_count,
        status: result.status,
        errorName: result.error_name || null,
        errorValue: result.error_value || null,
        traceback: result.traceback ? JSON.stringify(result.traceback) : null,
      });
    } catch (error) {
      updateAttributes({
        status: 'error',
        errorValue: error instanceof Error ? error.message : 'Execution failed',
      });
    } finally {
      setIsExecuting(false);
    }
  }, [localCode, updateAttributes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter to run cell
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      executeCode();
    }
  }, [executeCode]);

  const handleInterrupt = useCallback(async () => {
    try {
      await jupyterApi.interrupt();
      updateAttributes({ status: 'idle' });
      setIsExecuting(false);
    } catch (error) {
      console.error('Failed to interrupt:', error);
    }
  }, [updateAttributes]);

  return (
    <NodeViewWrapper>
      <div
        className="notebook-cell group"
        style={{
          border: '1px solid var(--color-border-primary)',
          borderRadius: '0.5rem',
          margin: '0.5rem 0',
          marginBottom: '1.5rem', // Extra space for add button
          backgroundColor: 'var(--color-bg-secondary)',
          overflow: 'visible', // Allow add button to overflow
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget.querySelector('.add-cell-button') as HTMLElement;
          if (btn) btn.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget.querySelector('.add-cell-button') as HTMLElement;
          if (btn) btn.style.opacity = '0';
        }}
      >
        {/* Cell Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            borderBottom: '1px solid var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)',
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              minWidth: '60px',
            }}
          >
            In [{executionCount ?? ' '}]:
          </span>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={isExecuting ? handleInterrupt : executeCode}
              title={isExecuting ? 'Stop execution' : 'Run cell (Shift+Enter)'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '0.25rem',
                color: isExecuting ? 'var(--color-error)' : 'var(--color-text-secondary)',
              }}
            >
              {isExecuting ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={() => updateAttributes({ outputs: '[]', status: 'idle', executionCount: null })}
              title="Clear output"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '0.25rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={addCellBelow}
              title="Add cell below"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '0.25rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={deleteNode}
              title="Delete cell"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '0.25rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Add Cell Below indicator - shown between cells */}
        <div
          onClick={addCellBelow}
          title="Add cell below (click)"
          style={{
            position: 'absolute',
            bottom: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            opacity: 0,
            transition: 'opacity 0.2s',
            cursor: 'pointer',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-accent-text)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          className="add-cell-button"
        >
          <Plus className="h-3 w-3" />
          Add Cell
        </div>

        {/* Code Input */}
        <textarea
          value={localCode}
          onChange={(e) => setLocalCode(e.target.value)}
          onBlur={() => updateAttributes({ code: localCode })}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            minHeight: '60px',
            padding: '0.75rem',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.875rem',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--color-text-primary)',
            resize: 'vertical',
            outline: 'none',
            lineHeight: '1.5',
          }}
          placeholder="# Enter Python code... (Shift+Enter to run)"
        />

        {/* Output Area */}
        {(parsedOutputs.length > 0 || status === 'error') && (
          <div
            style={{
              borderTop: '1px solid var(--color-border-primary)',
              padding: '0.75rem',
              backgroundColor: 'var(--color-bg-primary)',
            }}
          >
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              Out [{executionCount ?? ' '}]:
            </span>
            <div style={{ marginTop: '0.5rem' }}>
              {parsedOutputs.map((output: { type: string; text?: string; data?: Record<string, string> }, idx: number) => (
                <div
                  key={idx}
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                    color: output.type === 'stderr' ? 'var(--color-error)' : 'var(--color-text-primary)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {output.text}
                  {output.data?.['image/png'] && (
                    <img
                      src={`data:image/png;base64,${output.data['image/png']}`}
                      alt="Output"
                      style={{ maxWidth: '100%', marginTop: '0.5rem' }}
                    />
                  )}
                  {output.data?.['text/html'] && (
                    <div
                      dangerouslySetInnerHTML={{ __html: output.data['text/html'] }}
                      style={{ marginTop: '0.5rem' }}
                    />
                  )}
                </div>
              ))}
              {status === 'error' && (
                <div
                  style={{
                    color: 'var(--color-error)',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  }}
                >
                  <strong>{errorName}: </strong>
                  {errorValue}
                  {parsedTraceback && (
                    <pre
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap',
                        opacity: 0.8,
                      }}
                    >
                      {parsedTraceback.join('\n')}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Running indicator */}
        {isExecuting && (
          <div
            style={{
              borderTop: '1px solid var(--color-border-primary)',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--color-bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-text-secondary)',
              fontSize: '0.75rem',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#f59e0b',
                animation: 'pulse 1s ease-in-out infinite',
              }}
            />
            Running...
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

// TipTap Extension
export const NotebookCellExtension = Node.create({
  name: 'notebookCell',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      cellNumber: { default: 1 },
      code: { default: '' },
      outputs: { default: '[]' },  // JSON string of JupyterOutput[]
      status: { default: 'idle' },  // 'idle', 'running', 'ok', 'error'
      executionCount: { default: null },
      errorName: { default: null },
      errorValue: { default: null },
      traceback: { default: null },  // JSON string
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-notebook-cell]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false;
          const element = node as HTMLElement;
          return {
            cellNumber: parseInt(element.getAttribute('data-cell-number') || '1', 10),
            code: element.getAttribute('data-code') || '',
            outputs: element.getAttribute('data-outputs') || '[]',
            status: element.getAttribute('data-status') || 'idle',
            executionCount: element.getAttribute('data-execution-count')
              ? parseInt(element.getAttribute('data-execution-count')!, 10)
              : null,
            errorName: element.getAttribute('data-error-name'),
            errorValue: element.getAttribute('data-error-value'),
            traceback: element.getAttribute('data-traceback'),
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-notebook-cell': '',
        'data-cell-number': node.attrs.cellNumber,
        'data-code': node.attrs.code,
        'data-outputs': node.attrs.outputs,
        'data-status': node.attrs.status,
        'data-execution-count': node.attrs.executionCount,
        'data-error-name': node.attrs.errorName,
        'data-error-value': node.attrs.errorValue,
        'data-traceback': node.attrs.traceback,
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NotebookCellComponent);
  },
});

export default NotebookCellExtension;

