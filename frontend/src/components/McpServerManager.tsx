import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Server,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Globe,
  Container,
  Hammer,
  Terminal,
} from 'lucide-react';
import { mcpApi } from '../api';
import type {
  McpServer,
  McpServerCreate,
  McpSettings,
  McpDockerStatus,
  McpRoutingRule,
  McpRoutingRuleCreate,
  McpServerType,
} from '../types';

interface McpServerManagerProps {
  onMessage?: (type: 'success' | 'error', text: string) => void;
}

const McpServerManager = ({ onMessage }: McpServerManagerProps) => {
  // Use ref to avoid re-renders when onMessage changes
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const [servers, setServers] = useState<McpServer[]>([]);
  const [settings, setSettings] = useState<McpSettings | null>(null);
  const [dockerStatus, setDockerStatus] = useState<McpDockerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedServer, setExpandedServer] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState<number | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);

  // Form state
  // Predefined color palette for MCP servers
  const MCP_COLORS = [
    '#22c55e',  // Green
    '#3b82f6',  // Blue
    '#f59e0b',  // Amber
    '#ef4444',  // Red
    '#8b5cf6',  // Purple
    '#06b6d4',  // Cyan
    '#ec4899',  // Pink
    '#f97316',  // Orange
  ];

  const [newServer, setNewServer] = useState<McpServerCreate>({
    name: '',
    server_type: 'docker',
    transport_type: 'http',
    image: '',
    port: 8011,
    build_source: 'image',
    build_context: '',
    dockerfile_path: '',
    url: '',
    headers: {},
    color: '#22c55e',
    description: '',
    env_vars: [],
    auto_start: false,
  });
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [manifestUrl, setManifestUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Routing rule form
  const [showRuleForm, setShowRuleForm] = useState<number | null>(null);
  const [newRule, setNewRule] = useState<{ pattern: string; priority: number }>({
    pattern: '',
    priority: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [serversData, settingsData, dockerData] = await Promise.all([
        mcpApi.getServers(),
        mcpApi.getSettings(),
        mcpApi.getDockerStatus(),
      ]);
      setServers(serversData);
      setSettings(settingsData);
      setDockerStatus(dockerData);
    } catch (error) {
      console.error('Failed to load MCP data:', error);
      onMessageRef.current?.('error', 'Failed to load MCP server data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleEnabled = async () => {
    if (!settings) return;
    try {
      const updated = await mcpApi.updateSettings({
        mcp_enabled: !settings.mcp_enabled,
      });
      setSettings(updated);
      onMessageRef.current?.('success', `MCP servers ${updated.mcp_enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle MCP:', error);
      onMessageRef.current?.('error', 'Failed to update MCP settings');
    }
  };

  const handleUpdateSettings = async (updates: Partial<McpSettings>) => {
    try {
      const updated = await mcpApi.updateSettings(updates);
      setSettings(updated);
    } catch (error) {
      console.error('Failed to update settings:', error);
      onMessageRef.current?.('error', 'Failed to update MCP settings');
    }
  };

  const handleStartServer = async (serverId: number) => {
    try {
      const updated = await mcpApi.startServer(serverId);
      setServers((prev) => prev.map((s) => (s.id === serverId ? updated : s)));
      onMessageRef.current?.('success', 'Server starting...');
    } catch (error: any) {
      console.error('Failed to start server:', error);
      onMessageRef.current?.('error', error.response?.data?.detail || 'Failed to start server');
    }
  };

  const handleStopServer = async (serverId: number) => {
    try {
      const updated = await mcpApi.stopServer(serverId);
      setServers((prev) => prev.map((s) => (s.id === serverId ? updated : s)));
      onMessageRef.current?.('success', 'Server stopped');
    } catch (error: any) {
      console.error('Failed to stop server:', error);
      onMessageRef.current?.('error', error.response?.data?.detail || 'Failed to stop server');
    }
  };

  const handleRestartServer = async (serverId: number) => {
    try {
      const updated = await mcpApi.restartServer(serverId);
      setServers((prev) => prev.map((s) => (s.id === serverId ? updated : s)));
      onMessageRef.current?.('success', 'Server restarting...');
    } catch (error: any) {
      console.error('Failed to restart server:', error);
      onMessageRef.current?.('error', error.response?.data?.detail || 'Failed to restart server');
    }
  };

  const handleBuildImage = async (serverId: number) => {
    try {
      onMessageRef.current?.('success', 'Building Docker image... This may take a while.');
      const updated = await mcpApi.buildImage(serverId);
      setServers((prev) => prev.map((s) => (s.id === serverId ? updated : s)));
      onMessageRef.current?.('success', 'Docker image built successfully!');
    } catch (error: any) {
      console.error('Failed to build image:', error);
      onMessageRef.current?.('error', error.response?.data?.detail || 'Failed to build image');
    }
  };

  const handleDeleteServer = async (serverId: number) => {
    if (!confirm('Are you sure you want to delete this MCP server?')) return;
    try {
      await mcpApi.deleteServer(serverId);
      setServers((prev) => prev.filter((s) => s.id !== serverId));
      onMessageRef.current?.('success', 'Server deleted');
    } catch (error: any) {
      console.error('Failed to delete server:', error);
      onMessageRef.current?.('error', error.response?.data?.detail || 'Failed to delete server');
    }
  };

  const handleViewLogs = async (serverId: number) => {
    setShowLogsModal(serverId);
    setLogsLoading(true);
    try {
      const logsData = await mcpApi.getLogs(serverId, 200);
      setLogs(logsData.logs);
    } catch (error) {
      setLogs('Error loading logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleCreateServer = async () => {
    if (!newServer.name) {
      onMessageRef.current?.('error', 'Name is required');
      return;
    }

    // STDIO servers - support both pre-built images and Dockerfile builds
    if (newServer.transport_type === 'stdio') {
      if (newServer.build_source === 'dockerfile') {
        if (!newServer.build_context) {
          onMessageRef.current?.('error', 'Build context path is required for Dockerfile builds');
          return;
        }
      } else {
        if (!newServer.image) {
          onMessageRef.current?.('error', 'Docker image is required for STDIO servers');
          return;
        }
      }
      // Port is not required for stdio - will be set to 0
    } else if (newServer.server_type === 'docker') {
      if (newServer.build_source === 'dockerfile') {
        if (!newServer.build_context) {
          onMessageRef.current?.('error', 'Build context path is required for Dockerfile builds');
          return;
        }
      } else {
        if (!newServer.image) {
          onMessageRef.current?.('error', 'Docker image is required for pre-built Docker servers');
          return;
        }
      }
      if (!newServer.port) {
        onMessageRef.current?.('error', 'Port is required for HTTP Docker servers');
        return;
      }
    }
    if (newServer.server_type === 'remote' && !newServer.url) {
      onMessageRef.current?.('error', 'URL is required for remote servers');
      return;
    }
    setSaving(true);
    try {
      const created = await mcpApi.createServer(newServer);
      setServers((prev) => [...prev, created]);
      setShowAddForm(false);
      setNewServer({
        name: '',
        server_type: 'docker',
        transport_type: 'http',
        image: '',
        port: 8011,
        build_source: 'image',
        build_context: '',
        dockerfile_path: '',
        url: '',
        headers: {},
        color: MCP_COLORS[servers.length % MCP_COLORS.length],
        description: '',
        env_vars: [],
        auto_start: false,
      });
      setHeaderKey('');
      setHeaderValue('');
      onMessageRef.current?.('success', 'MCP server created');
    } catch (error: any) {
      console.error('Failed to create server:', error);
      onMessageRef.current?.('error', error.response?.data?.detail || 'Failed to create server');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHeader = () => {
    if (!headerKey.trim()) return;
    setNewServer((prev) => ({
      ...prev,
      headers: { ...prev.headers, [headerKey]: headerValue },
    }));
    setHeaderKey('');
    setHeaderValue('');
  };

  const handleRemoveHeader = (key: string) => {
    setNewServer((prev) => {
      const updated = { ...prev.headers };
      delete updated[key];
      return { ...prev, headers: updated };
    });
  };

  const handleImportManifest = async () => {
    if (!manifestUrl) {
      onMessageRef.current?.('error', 'Manifest URL is required');
      return;
    }
    setSaving(true);
    try {
      const imported = await mcpApi.importFromManifest(manifestUrl);
      setServers((prev) => [...prev, imported]);
      setShowImportForm(false);
      setManifestUrl('');
      onMessageRef.current?.('success', `Imported MCP server: ${imported.name}`);
    } catch (error: any) {
      console.error('Failed to import manifest:', error);
      onMessageRef.current?.('error', error.response?.data?.detail || 'Failed to import manifest');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRule = async (serverId: number) => {
    if (!newRule.pattern) {
      onMessageRef.current?.('error', 'Pattern is required');
      return;
    }
    try {
      const rule = await mcpApi.createRoutingRule({
        mcp_server_id: serverId,
        pattern: newRule.pattern,
        priority: newRule.priority,
        is_enabled: true,
      });
      // Refresh server data to get updated rules
      const updated = await mcpApi.getServer(serverId);
      setServers((prev) => prev.map((s) => (s.id === serverId ? updated : s)));
      setShowRuleForm(null);
      setNewRule({ pattern: '', priority: 0 });
      onMessageRef.current?.('success', 'Routing rule added');
    } catch (error: any) {
      console.error('Failed to create rule:', error);
      onMessageRef.current?.('error', error.response?.data?.detail || 'Failed to create routing rule');
    }
  };

  const handleDeleteRule = async (ruleId: number, serverId: number) => {
    try {
      await mcpApi.deleteRoutingRule(ruleId);
      const updated = await mcpApi.getServer(serverId);
      setServers((prev) => prev.map((s) => (s.id === serverId ? updated : s)));
      onMessageRef.current?.('success', 'Routing rule deleted');
    } catch (error: any) {
      console.error('Failed to delete rule:', error);
      onMessageRef.current?.('error', error.response?.data?.detail || 'Failed to delete routing rule');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'var(--color-success)';
      case 'starting':
      case 'building':
        return 'var(--color-warning)';
      case 'error':
        return 'var(--color-error)';
      default:
        return 'var(--color-text-tertiary)';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-4 h-4" />;
      case 'starting':
        return <Clock className="w-4 h-4 animate-pulse" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Square className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
        Loading MCP servers...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Docker Status Banner */}
      {!dockerStatus?.available && (
        <div
          className="p-3 rounded-lg flex items-center gap-2"
          style={{
            backgroundColor: `${getComputedStyle(document.documentElement).getPropertyValue('--color-warning')}15`,
            border: '1px solid var(--color-warning)',
          }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-warning)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-warning)' }}>
              Docker is not available
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Docker-based MCP servers require Docker. Remote servers still work.
            </p>
          </div>
        </div>
      )}

      {/* Enable Toggle */}
      <div
        className="p-3 rounded-lg flex items-center justify-between"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-primary)',
        }}
      >
        <div>
          <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
            Enable MCP Servers
          </h3>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Route text selections to Docker (HTTP/STDIO) or remote MCP servers
          </p>
        </div>
        <button
          onClick={handleToggleEnabled}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
          style={{
            backgroundColor: settings?.mcp_enabled ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border-primary)',
          }}
        >
          <span
            className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm"
            style={{
              transform: settings?.mcp_enabled ? 'translateX(1.25rem)' : 'translateX(0.25rem)',
            }}
          />
        </button>
      </div>

      {/* Settings */}
      {settings?.mcp_enabled && (
        <div
          className="p-3 rounded-lg space-y-3"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-primary)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Fallback to LLM
              </label>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Use configured LLM when MCP server fails
              </p>
            </div>
            <button
              onClick={() => handleUpdateSettings({ mcp_fallback_to_llm: !settings.mcp_fallback_to_llm })}
              className="relative inline-flex h-5 w-10 items-center rounded-full transition-colors"
              style={{
                backgroundColor: settings.mcp_fallback_to_llm ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border-primary)',
              }}
            >
              <span
                className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm"
                style={{
                  transform: settings.mcp_fallback_to_llm ? 'translateX(1.1rem)' : 'translateX(0.2rem)',
                }}
              />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              Idle Timeout:
            </label>
            <input
              type="number"
              value={settings.mcp_idle_timeout}
              onChange={(e) => handleUpdateSettings({ mcp_idle_timeout: parseInt(e.target.value) || 300 })}
              className="w-20 px-2 py-1 rounded text-sm"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              seconds
            </span>
          </div>
        </div>
      )}

      {/* Server List */}
      {settings?.mcp_enabled && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
              Configured Servers ({servers.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowImportForm(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-primary)',
                }}
              >
                <ExternalLink className="w-3 h-3" />
                Import
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-accent-text)',
                }}
              >
                <Plus className="w-3 h-3" />
                Add Server
              </button>
            </div>
          </div>

          {servers.length === 0 ? (
            <div
              className="text-center py-8 border-2 border-dashed rounded-lg"
              style={{ borderColor: 'var(--color-border-primary)' }}
            >
              <Server className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No MCP servers configured
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Add a server or import from a GitHub manifest
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-primary)',
                  }}
                >
                  {/* Server Header */}
                  <div className="p-3 flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getStatusColor(server.status) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {/* Server color indicator */}
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: server.color || '#22c55e',
                            boxShadow: `0 0 4px ${server.color || '#22c55e'}`,
                          }}
                          title={`Indicator color: ${server.color || '#22c55e'}`}
                        />
                        {server.server_type === 'remote' ? (
                          <Globe className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                        ) : server.transport_type === 'stdio' ? (
                          <Terminal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                        ) : (
                          <Container className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                        )}
                        <span className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {server.name}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${getStatusColor(server.status)}20`,
                            color: getStatusColor(server.status),
                          }}
                        >
                          {server.status}
                        </span>
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {server.server_type === 'remote'
                          ? server.url
                          : server.transport_type === 'stdio'
                            ? server.build_source === 'dockerfile'
                              ? `🔌 📁 ${server.build_context} (STDIO)`
                              : `🔌 ${server.image} (STDIO)`
                            : server.build_source === 'dockerfile'
                              ? `📁 ${server.build_context} • Port ${server.port}`
                              : `${server.image} • Port ${server.port}`}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1">
                      {server.status === 'running' || server.status === 'starting' ? (
                        <>
                          <button
                            onClick={() => handleStopServer(server.id)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--color-text-secondary)' }}
                            title="Stop"
                          >
                            <Square className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRestartServer(server.id)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--color-text-secondary)' }}
                            title="Restart"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleStartServer(server.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--color-success)' }}
                          title="Start"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {/* Build button for Dockerfile servers */}
                      {server.build_source === 'dockerfile' && server.status !== 'building' && (
                        <button
                          onClick={() => handleBuildImage(server.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--color-warning)' }}
                          title="Build/Rebuild Image"
                        >
                          <Hammer className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (showLogsModal === server.id) {
                            setShowLogsModal(null);
                          } else {
                            handleViewLogs(server.id);
                          }
                        }}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ 
                          color: showLogsModal === server.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                          backgroundColor: showLogsModal === server.id ? 'var(--color-accent-bg)' : 'transparent',
                        }}
                        title={showLogsModal === server.id ? "Hide Logs" : "View Logs"}
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteServer(server.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--color-error)' }}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setExpandedServer(expandedServer === server.id ? null : server.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {expandedServer === server.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedServer === server.id && (
                    <div
                      className="px-3 pb-3 pt-0 border-t space-y-3"
                      style={{ borderColor: 'var(--color-border-primary)' }}
                    >
                      {server.description && (
                        <p className="text-xs pt-2" style={{ color: 'var(--color-text-secondary)' }}>
                          {server.description}
                        </p>
                      )}

                      {/* Routing Rules */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            Routing Rules
                          </h4>
                          <button
                            onClick={() => setShowRuleForm(server.id)}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ color: 'var(--color-accent)' }}
                          >
                            + Add Rule
                          </button>
                        </div>

                        {showRuleForm === server.id && (
                          <div
                            className="mb-2 p-2 rounded-lg space-y-2"
                            style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                          >
                            <input
                              type="text"
                              placeholder="Regex pattern (e.g. summarize|summary)"
                              value={newRule.pattern}
                              onChange={(e) => setNewRule((prev) => ({ ...prev, pattern: e.target.value }))}
                              className="w-full px-2 py-1 text-xs rounded"
                              style={{
                                backgroundColor: 'var(--color-bg-primary)',
                                border: '1px solid var(--color-border-primary)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="Priority"
                                value={newRule.priority}
                                onChange={(e) =>
                                  setNewRule((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))
                                }
                                className="w-20 px-2 py-1 text-xs rounded"
                                style={{
                                  backgroundColor: 'var(--color-bg-primary)',
                                  border: '1px solid var(--color-border-primary)',
                                  color: 'var(--color-text-primary)',
                                }}
                              />
                              <button
                                onClick={() => handleCreateRule(server.id)}
                                className="px-2 py-1 text-xs rounded"
                                style={{
                                  backgroundColor: 'var(--color-accent)',
                                  color: 'var(--color-accent-text)',
                                }}
                              >
                                Add
                              </button>
                              <button
                                onClick={() => setShowRuleForm(null)}
                                className="px-2 py-1 text-xs rounded"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {server.routing_rules && server.routing_rules.length > 0 ? (
                          <div className="space-y-1">
                            {server.routing_rules.map((rule) => (
                              <div
                                key={rule.id}
                                className="flex items-center justify-between px-2 py-1 rounded text-xs"
                                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                              >
                                <code style={{ color: 'var(--color-text-primary)' }}>{rule.pattern}</code>
                                <div className="flex items-center gap-2">
                                  <span style={{ color: 'var(--color-text-tertiary)' }}>p:{rule.priority}</span>
                                  <button
                                    onClick={() => handleDeleteRule(rule.id, server.id)}
                                    style={{ color: 'var(--color-error)' }}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            No routing rules. Add patterns to route text to this server.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inline Logs Section */}
                  {showLogsModal === server.id && (
                    <div
                      className="border-t"
                      style={{ borderColor: 'var(--color-border-primary)' }}
                    >
                      <div
                        className="flex items-center justify-between px-3 py-2"
                        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            Server Logs
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowLogsModal(null)}
                          className="p-1 rounded-lg transition-colors"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="p-3 max-h-64 overflow-auto">
                        {logsLoading ? (
                          <div className="text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
                            Loading logs...
                          </div>
                        ) : (
                          <pre
                            className="text-xs whitespace-pre-wrap font-mono"
                            style={{
                              color: 'var(--color-text-primary)',
                              backgroundColor: 'var(--color-bg-secondary)',
                              padding: '0.75rem',
                              borderRadius: '0.5rem',
                            }}
                          >
                            {logs || 'No logs available'}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inline Add Server Form */}
      {showAddForm && (
        <div
          className="rounded-xl shadow-lg"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-primary)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 border-b rounded-t-xl"
            style={{
              borderColor: 'var(--color-border-primary)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}
          >
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Add MCP Server
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content */}
          <div className="p-4 space-y-4">
            {/* Server Type Toggle */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Server Type
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setNewServer((prev) => ({ ...prev, server_type: 'docker', transport_type: 'http' }))}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: newServer.server_type === 'docker' && newServer.transport_type === 'http' ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                    color: newServer.server_type === 'docker' && newServer.transport_type === 'http' ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-primary)',
                  }}
                >
                  <Container className="w-4 h-4" />
                  Docker (HTTP)
                </button>
                <button
                  onClick={() => setNewServer((prev) => ({ ...prev, server_type: 'docker', transport_type: 'stdio' }))}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: newServer.transport_type === 'stdio' ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                    color: newServer.transport_type === 'stdio' ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-primary)',
                  }}
                >
                  <Terminal className="w-4 h-4" />
                  Docker (STDIO)
                </button>
                <button
                  onClick={() => setNewServer((prev) => ({ ...prev, server_type: 'remote', transport_type: 'http' }))}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: newServer.server_type === 'remote' ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                    color: newServer.server_type === 'remote' ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-primary)',
                  }}
                >
                  <Globe className="w-4 h-4" />
                  Remote
                </button>
              </div>
              {newServer.transport_type === 'stdio' && (
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                  STDIO mode is for MCP servers like Brave Search that communicate via stdin/stdout instead of HTTP.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Name
              </label>
              <input
                type="text"
                value={newServer.name}
                onChange={(e) => setNewServer((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={newServer.server_type === 'remote' ? 'e.g. github-copilot' : 'e.g. summarizer'}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-primary)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Indicator Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {MCP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewServer((prev) => ({ ...prev, color }))}
                    className="w-8 h-8 rounded-full transition-all"
                    style={{
                      backgroundColor: color,
                      border: newServer.color === color ? '3px solid var(--color-text-primary)' : '2px solid transparent',
                      boxShadow: newServer.color === color ? `0 0 8px ${color}` : 'none',
                      transform: newServer.color === color ? 'scale(1.1)' : 'scale(1)',
                    }}
                    title={color}
                  />
                ))}
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                This color shows on the AI button when this server matches selected text
              </p>
            </div>

            {/* Docker-specific fields (for both HTTP and STDIO) */}
            {(newServer.server_type === 'docker' || newServer.transport_type === 'stdio') && (
              <>
                {/* Build source toggle for Docker servers (HTTP and STDIO) */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                    Image Source
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewServer((prev) => ({ ...prev, build_source: 'image' }))}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: newServer.build_source === 'image' ? 'var(--color-accent-primary)' : 'var(--color-bg-secondary)',
                        color: newServer.build_source === 'image' ? 'var(--color-bg-primary)' : 'var(--color-text-primary)',
                        border: '1px solid var(--color-border-primary)',
                        fontWeight: newServer.build_source === 'image' ? 600 : 500,
                      }}
                    >
                      Pre-built Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewServer((prev) => ({ ...prev, build_source: 'dockerfile' }))}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: newServer.build_source === 'dockerfile' ? 'var(--color-accent-primary)' : 'var(--color-bg-secondary)',
                        color: newServer.build_source === 'dockerfile' ? 'var(--color-bg-primary)' : 'var(--color-text-primary)',
                        border: '1px solid var(--color-border-primary)',
                        fontWeight: newServer.build_source === 'dockerfile' ? 600 : 500,
                      }}
                    >
                      Build from Dockerfile
                    </button>
                  </div>
                </div>

                {/* Image field - for pre-built images */}
                {newServer.build_source === 'image' && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                      Docker Image
                    </label>
                    <input
                      type="text"
                      value={newServer.image}
                      onChange={(e) => setNewServer((prev) => ({ ...prev, image: e.target.value }))}
                      placeholder={newServer.transport_type === 'stdio'
                        ? "e.g. mcp/brave-search"
                        : "e.g. ghcr.io/user/mcp-summarizer:latest"}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-primary)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                      {newServer.transport_type === 'stdio'
                        ? 'Example: mcp/brave-search, mcp/filesystem, etc.'
                        : 'Example: ghcr.io/user/mcp-server:latest'}
                    </p>
                  </div>
                )}

                {/* Dockerfile build fields - for both HTTP and STDIO when build_source is dockerfile */}
                {newServer.build_source === 'dockerfile' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        Build Context Path
                      </label>
                      <input
                        type="text"
                        value={newServer.build_context}
                        onChange={(e) => setNewServer((prev) => ({ ...prev, build_context: e.target.value }))}
                        placeholder="https://github.com/user/repo/blob/main/Dockerfile"
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={{
                          backgroundColor: 'var(--color-bg-secondary)',
                          border: '1px solid var(--color-border-primary)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        GitHub URL to Dockerfile, or local path (e.g., /path/to/repo)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        Dockerfile Path (optional)
                      </label>
                      <input
                        type="text"
                        value={newServer.dockerfile_path}
                        onChange={(e) => setNewServer((prev) => ({ ...prev, dockerfile_path: e.target.value }))}
                        placeholder="Dockerfile (default)"
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={{
                          backgroundColor: 'var(--color-bg-secondary)',
                          border: '1px solid var(--color-border-primary)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        Relative to build context, e.g. "docker/Dockerfile.mcp"
                      </p>
                    </div>
                  </>
                )}

                {/* Port - only for HTTP transport */}
                {newServer.transport_type === 'http' && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                      Port
                    </label>
                    <input
                      type="number"
                      value={newServer.port}
                      onChange={(e) => setNewServer((prev) => ({ ...prev, port: parseInt(e.target.value) || 8011 }))}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-primary)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </div>
                )}
              </>
            )}

            {/* Remote-specific fields */}
            {newServer.server_type === 'remote' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Endpoint URL
                  </label>
                  <input
                    type="url"
                    value={newServer.url}
                    onChange={(e) => setNewServer((prev) => ({ ...prev, url: e.target.value }))}
                    placeholder="e.g. https://api.githubcopilot.com/mcp/"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border-primary)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    HTTP Headers
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                    Add authentication headers (e.g., Authorization: Bearer TOKEN)
                  </p>
                  <div className="space-y-2">
                    {Object.entries(newServer.headers || {}).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                      >
                        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {key}:
                        </span>
                        <span className="flex-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                          {key.toLowerCase().includes('auth') || key.toLowerCase().includes('key')
                            ? '••••••••'
                            : value}
                        </span>
                        <button
                          onClick={() => handleRemoveHeader(key)}
                          className="p-1 rounded hover:bg-red-500/10"
                          style={{ color: 'var(--color-error)' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={headerKey}
                        onChange={(e) => setHeaderKey(e.target.value)}
                        placeholder="Header name"
                        className="flex-1 px-3 py-2 rounded-lg text-sm"
                        style={{
                          backgroundColor: 'var(--color-bg-secondary)',
                          border: '1px solid var(--color-border-primary)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                      <input
                        type="text"
                        value={headerValue}
                        onChange={(e) => setHeaderValue(e.target.value)}
                        placeholder="Value"
                        className="flex-1 px-3 py-2 rounded-lg text-sm"
                        style={{
                          backgroundColor: 'var(--color-bg-secondary)',
                          border: '1px solid var(--color-border-primary)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                      <button
                        onClick={handleAddHeader}
                        className="px-3 py-2 rounded-lg text-sm font-medium"
                        style={{
                          backgroundColor: 'var(--color-accent)',
                          color: 'var(--color-accent-text)',
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Description
              </label>
              <input
                type="text"
                value={newServer.description}
                onChange={(e) => setNewServer((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-primary)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border-primary)' }}>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-primary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateServer}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-accent-text)',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Import Form */}
      {showImportForm && (
        <div
          className="rounded-xl shadow-lg"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-primary)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 border-b rounded-t-xl"
            style={{
              borderColor: 'var(--color-border-primary)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Import from GitHub
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowImportForm(false)}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Manifest URL
              </label>
              <input
                type="url"
                value={manifestUrl}
                onChange={(e) => setManifestUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/.../mcp-manifest.json"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-primary)',
                  color: 'var(--color-text-primary)',
                }}
              />
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
                Enter the raw URL to an MCP manifest JSON file
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border-primary)' }}>
              <button
                onClick={() => setShowImportForm(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-primary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleImportManifest}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-accent-text)',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default McpServerManager;

