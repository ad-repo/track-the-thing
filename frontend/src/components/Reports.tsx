import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Copy, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { useTimezone } from '../contexts/TimezoneContext';
import { useTransparentLabels } from '../contexts/TransparentLabelsContext';
import { formatTimestamp } from '../utils/timezone';
import { useTexture } from '../hooks/useTexture';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Fix all absolute API URLs in HTML content to use the actual API_URL
const fixImageUrls = (html: string): string => {
  // Replace localhost:8000
  let fixed = html.replace(/http:\/\/localhost:8000/g, API_URL);
  // Replace any IP:8000 patterns (like 192.168.0.186:8000)
  fixed = fixed.replace(/http:\/\/[\d.]+:8000/g, API_URL);
  return fixed;
};

interface ReportEntry {
  date: string;
  entry_id: number;
  content: string;
  content_type: string;
  labels: Array<{ name: string; color: string }>;
  created_at: string;
  is_completed: boolean;
}

interface ReportData {
  week_start: string;
  week_end: string;
  generated_at: string;
  entries: ReportEntry[];
}

interface Week {
  start: string;
  end: string;
  label: string;
}

const Reports = () => {
  const textureStyles = useTexture('reports');
  const { timezone } = useTimezone();
  const { transparentLabels } = useTransparentLabels();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportData | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  // All entries report states
  const [allEntriesReport, setAllEntriesReport] = useState<any | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [copiedAllReport, setCopiedAllReport] = useState(false);
  const [copiedEntryId, setCopiedEntryId] = useState<number | null>(null);
  const [clearingFlags, setClearingFlags] = useState(false);
  const [clearedFlags, setClearedFlags] = useState(false);

  useEffect(() => {
    loadAvailableWeeks();
  }, []);

  const loadAvailableWeeks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reports/weeks`);
      setWeeks(response.data.weeks);
    } catch (error) {
      console.error('Failed to load weeks:', error);
    }
  };

  const generateReport = async (date?: string) => {
    setLoading(true);
    try {
      const url = date 
        ? `${API_URL}/api/reports/generate?date=${date}`
        : `${API_URL}/api/reports/generate`;
      
      const response = await axios.get(url);
      setReport(response.data);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const generateAllEntriesReport = async () => {
    setLoadingAll(true);
    try {
      const response = await axios.get(`${API_URL}/api/reports/all-entries`);
      setAllEntriesReport(response.data);
    } catch (error) {
      console.error('Failed to generate all entries report:', error);
      alert('Failed to generate report');
    } finally {
      setLoadingAll(false);
    }
  };

  const clearAllReportFlags = async () => {
    setClearingFlags(true);
    setClearedFlags(false);
    try {
      // Get all entries with report flag
      const response = await axios.get(`${API_URL}/api/reports/all-entries`);
      const entries = response.data.entries;
      
      if (entries.length === 0) {
        return;
      }

      // Clear report flag from all entries
      await Promise.all(
        entries.map((entry: ReportEntry) =>
          axios.patch(`${API_URL}/api/entries/${entry.entry_id}`, {
            include_in_report: false
          })
        )
      );
      
      // Refresh the report if it was loaded
      if (allEntriesReport) {
        await generateAllEntriesReport();
      }

      // Show success state
      setClearedFlags(true);
      setTimeout(() => setClearedFlags(false), 2000);
    } catch (error) {
      console.error('Failed to clear report flags:', error);
    } finally {
      setClearingFlags(false);
    }
  };

  const exportAllEntriesReport = () => {
    if (!allEntriesReport) return;

    let markdown = `# Selected Entries Report\n\n`;
    markdown += `**Generated:** ${new Date(allEntriesReport.generated_at).toLocaleString()}\n\n`;
    markdown += `**Total Entries:** ${allEntriesReport.entries.length}\n\n`;
    markdown += `---\n\n`;

    if (allEntriesReport.entries.length === 0) {
      markdown += `No entries found.\n`;
    } else {
      let currentDate = '';
      allEntriesReport.entries.forEach((entry: any) => {
        if (entry.date !== currentDate) {
          currentDate = entry.date;
          markdown += `\n## ${currentDate}\n\n`;
        }

        const time = new Date(entry.created_at).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });

        markdown += `### ${time}`;
        if (entry.is_important) markdown += ` ⭐`;
        if (entry.is_completed) markdown += ` ✓`;
        markdown += `\n\n`;

        if (entry.labels.length > 0) {
          markdown += `*Labels: ${entry.labels.map((l: any) => l.name).join(', ')}*\n\n`;
        }

        const content = entry.content_type === 'code'
          ? `\`\`\`\n${entry.content}\n\`\`\`\n`
          : entry.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        markdown += `${content}\n\n`;
        markdown += `---\n\n`;
      });
    }

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-entries-${format(new Date(), 'yyyy-MM-dd')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportReport = () => {
    if (!report) return;

    const completedEntries = report.entries.filter(e => e.is_completed);
    const inProgressEntries = report.entries.filter(e => !e.is_completed);

    let markdown = `# Weekly Report\n\n`;
    markdown += `**Week:** ${report.week_start} to ${report.week_end}\n\n`;
    markdown += `**Generated:** ${new Date(report.generated_at).toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    if (report.entries.length === 0) {
      markdown += `No entries marked for report this week.\n`;
    } else {
      // Completed section
      markdown += `## ✓ Completed\n\n`;
      if (completedEntries.length === 0) {
        markdown += `*No completed items*\n\n`;
      } else {
        let currentDate = '';
        completedEntries.forEach(entry => {
          if (entry.date !== currentDate) {
            currentDate = entry.date;
            markdown += `\n### ${currentDate}\n\n`;
          }

          const content = entry.content_type === 'code'
            ? `\`\`\`\n${entry.content}\n\`\`\`\n`
            : entry.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

          markdown += `${content}\n\n`;

          if (entry.labels.length > 0) {
            markdown += `*Labels: ${entry.labels.map(l => l.name).join(', ')}*\n\n`;
          }
        });
      }

      // In Progress section
      markdown += `\n## ⚙ In Progress\n\n`;
      if (inProgressEntries.length === 0) {
        markdown += `*No items in progress*\n\n`;
      } else {
        let currentDate = '';
        inProgressEntries.forEach(entry => {
          if (entry.date !== currentDate) {
            currentDate = entry.date;
            markdown += `\n### ${currentDate}\n\n`;
          }

          const content = entry.content_type === 'code'
            ? `\`\`\`\n${entry.content}\n\`\`\`\n`
            : entry.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

          markdown += `${content}\n\n`;

          if (entry.labels.length > 0) {
            markdown += `*Labels: ${entry.labels.map(l => l.name).join(', ')}*\n\n`;
          }
        });
      }
    }

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `weekly-report-${report.week_start}-to-${report.week_end}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const processLinkPreviews = (html: string) => {
    // Parse HTML and find all link preview divs
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    
    const linkPreviews = tmp.querySelectorAll('[data-link-preview]');
    
    linkPreviews.forEach((preview) => {
      const element = preview as HTMLElement;
      // Check both data-url and url (for backward compatibility with old saves)
      const url = element.getAttribute('data-url') || element.getAttribute('url') || '';
      const title = element.getAttribute('data-title') || element.getAttribute('title') || '';
      const description = element.getAttribute('data-description') || element.getAttribute('description') || '';
      const image = element.getAttribute('data-image') || element.getAttribute('image') || '';
      const siteName = element.getAttribute('data-site-name') || element.getAttribute('site_name') || element.getAttribute('site-name') || '';
      
      // Skip if no valid URL
      if (!url || url === 'null' || url === 'undefined') {
        return;
      }
      
      // Create a visible link preview card
      const card = document.createElement('a');
      card.href = url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.className = 'block border border-gray-200 rounded-lg overflow-hidden hover:border-blue-400 transition-colors my-4 no-underline';
      
      let cardHTML = '<div class="flex gap-4 p-4">';
      
      if (image && image !== 'null' && image !== 'undefined') {
        cardHTML += `<div class="flex-shrink-0"><img src="${image}" alt="${title || 'Link preview'}" class="w-32 h-32 object-cover rounded" /></div>`;
      }
      
      cardHTML += '<div class="flex-1 min-w-0">';
      if (siteName && siteName !== 'null' && siteName !== 'undefined') {
        cardHTML += `<p class="text-xs text-gray-500 mb-1">${siteName}</p>`;
      }
      if (title && title !== 'null' && title !== 'undefined') {
        cardHTML += `<h3 class="font-semibold text-gray-900 mb-2 line-clamp-2">${title}</h3>`;
      }
      if (description && description !== 'null' && description !== 'undefined') {
        cardHTML += `<p class="text-sm text-gray-600 line-clamp-2 mb-2">${description}</p>`;
      }
      
      // Try to extract hostname, fallback to full URL if parsing fails
      let displayUrl = url;
      try {
        displayUrl = new URL(url).hostname;
      } catch (e) {
        console.warn('Invalid URL for link preview:', url);
      }
      
      cardHTML += `<div class="flex items-center gap-1 text-xs text-blue-600"><span class="truncate">${displayUrl}</span></div>`;
      cardHTML += '</div></div>';
      
      card.innerHTML = cardHTML;
      element.replaceWith(card);
    });
    
    return tmp.innerHTML;
  };

  const extractContentWithLinks = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    
    let result = '';
    
    // Process all nodes
    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) result += text + ' ';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        
        // Handle link preview divs (data-link-preview attribute)
        if (element.hasAttribute('data-link-preview')) {
          // Try to get attributes directly (supports both old and new format)
          const url = element.getAttribute('data-url') || element.getAttribute('url') || '';
          const title = element.getAttribute('data-title') || element.getAttribute('title') || '';
          const description = element.getAttribute('data-description') || element.getAttribute('description') || '';
          
          if (url) {
            result += '\n[Link Preview]\n';
            if (title) result += `Title: ${title}\n`;
            if (description) result += `Description: ${description}\n`;
            result += `URL: ${url}\n`;
            result += '\n';
          }
          return; // Don't process children since we've extracted what we need
        }
        // Handle links
        else if (element.tagName === 'A') {
          const href = element.getAttribute('href');
          const text = element.textContent?.trim();
          if (href) {
            result += `${text || href} (${href}) `;
          }
        }
        // Handle images
        else if (element.tagName === 'IMG') {
          const src = element.getAttribute('src');
          const alt = element.getAttribute('alt');
          if (src) {
            result += `[Image: ${alt || src}] `;
          }
        }
        // Handle line breaks
        else if (element.tagName === 'BR') {
          result += '\n';
        }
        // Handle paragraphs and divs
        else if (element.tagName === 'P' || element.tagName === 'DIV') {
          Array.from(node.childNodes).forEach(processNode);
          result += '\n';
        }
        // Recursively process other elements
        else {
          Array.from(node.childNodes).forEach(processNode);
        }
      }
    };
    
    Array.from(tmp.childNodes).forEach(processNode);
    
    // Clean up multiple spaces and newlines
    return result.replace(/\s+/g, ' ').replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const copySection = async (section: 'completed' | 'in-progress') => {
    if (!report) return;

    const entries = section === 'completed' 
      ? report.entries.filter(e => e.is_completed)
      : report.entries.filter(e => !e.is_completed);

    let text = section === 'completed' ? '✓ Completed\n\n' : '⚙ In Progress\n\n';
    
    if (entries.length === 0) {
      text += `No ${section === 'completed' ? 'completed' : 'in progress'} items\n`;
    } else {
      let currentDate = '';
      entries.forEach(entry => {
        if (entry.date !== currentDate) {
          currentDate = entry.date;
          text += `\n${currentDate}\n\n`;
        }

        const content = entry.content_type === 'code'
          ? entry.content
          : extractContentWithLinks(entry.content);

        text += `${content}\n\n`;

        if (entry.labels.length > 0) {
          text += `Labels: ${entry.labels.map(l => l.name).join(', ')}\n\n`;
        }
      });
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const copyAllEntriesReport = async () => {
    if (!allEntriesReport) return;

    let text = '';

    if (allEntriesReport.entries.length === 0) {
      text = `No entries found.\n`;
    } else {
      allEntriesReport.entries.forEach((entry: any, index: number) => {
        const content = entry.content_type === 'code'
          ? entry.content
          : extractContentWithLinks(entry.content);

        text += content;
        
        // Add double newline between entries, but not after the last one
        if (index < allEntriesReport.entries.length - 1) {
          text += `\n\n`;
        }
      });
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedAllReport(true);
      setTimeout(() => setCopiedAllReport(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const copyEntry = async (entry: any) => {
    const content = entry.content_type === 'code'
      ? entry.content
      : extractContentWithLinks(entry.content);

    let text = `${entry.date}\n`;
    text += `${new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    
    if (entry.is_important) text += ` ⭐`;
    if (entry.is_completed) text += ` ✓`;
    text += `\n\n`;

    if (entry.labels.length > 0) {
      text += `Labels: ${entry.labels.map((l: any) => l.name).join(', ')}\n\n`;
    }

    text += `${content}\n`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedEntryId(entry.entry_id);
      setTimeout(() => setCopiedEntryId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const goToEntry = (date: string, entryId: number) => {
    navigate(`/day/${date}#entry-${entryId}`);
  };

  return (
    <div className="max-w-5xl mx-auto page-fade-in" style={{ position: 'relative', zIndex: 1 }}>
      {/* Clear All Button - Outside any report section */}
      <div className="flex justify-start mb-4">
        <button
          onClick={clearAllReportFlags}
          disabled={clearingFlags || clearedFlags}
          className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-accent-text)',
            opacity: clearingFlags ? 0.6 : clearedFlags ? 1 : 1,
            boxShadow: 'var(--color-card-shadow)'
          }}
        >
          {clearingFlags && <Loader2 className="h-5 w-5 animate-spin" />}
          {clearedFlags && <Check className="h-5 w-5" />}
          {clearingFlags ? 'Clearing...' : clearedFlags ? 'Cleared!' : 'Clear All Report Flags'}
        </button>
      </div>

      <div 
        className="rounded-lg shadow-lg p-6 mb-6"
        style={{ backgroundColor: 'var(--color-bg-primary)', ...textureStyles }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8" style={{ color: 'var(--color-accent)' }} />
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Weekly Report</h1>
          </div>
        </div>

        <div className="mb-6">
          <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Generate reports from entries marked with "Add to Report". Reports run from Wednesday to Wednesday.
          </p>

          <div className="flex gap-4 mb-4">
            <button
              onClick={() => generateReport()}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
              style={{
                backgroundColor: loading ? 'var(--color-bg-tertiary)' : 'var(--color-accent)',
                color: loading ? 'var(--color-text-tertiary)' : 'var(--color-accent-text)'
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = 'var(--color-accent)';
              }}
            >
              <Calendar className="h-5 w-5" />
              {loading ? 'Generating...' : 'Generate'}
            </button>

            {weeks.length > 0 && (
              <select
                value={selectedWeek}
                onChange={(e) => {
                  setSelectedWeek(e.target.value);
                  if (e.target.value) {
                    generateReport(e.target.value);
                  }
                }}
                className="px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-primary)'
                }}
              >
                <option value="">Select a past week...</option>
                {weeks.map((week) => (
                  <option key={week.start} value={week.start}>
                    {week.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {report && (
          <div className="pt-6" style={{ borderTop: '1px solid var(--color-border-primary)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Report: {report.week_start} to {report.week_end}
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {report.entries.length} {report.entries.length === 1 ? 'entry' : 'entries'}
                </p>
              </div>
              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-6 py-3 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-accent-text)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <Download className="h-5 w-5" />
                Export as Markdown
              </button>
            </div>

            <div className="space-y-8 mt-6">
              {report.entries.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
                  No entries marked for report this week.
                  <br />
                  Check the "Add to Report" box on entries you want to include.
                </div>
              ) : (
                <>
                  {/* Completed Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-success)' }}>
                        <span className="text-2xl">✓</span> Completed
                      </h3>
                      <button
                        onClick={() => copySection('completed')}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
                        style={{
                          backgroundColor: `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}20`,
                          color: 'var(--color-accent)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}30`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}20`;
                        }}
                        title="Copy completed section"
                      >
                        {copiedSection === 'completed' ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy Section
                          </>
                        )}
                      </button>
                    </div>
                    <div className="space-y-4">
                      {report.entries.filter(e => e.is_completed).length === 0 ? (
                        <div className="italic pl-4" style={{ color: 'var(--color-text-secondary)' }}>No completed items</div>
                      ) : (
                        report.entries.filter(e => e.is_completed).map((entry, index, arr) => (
                          <div 
                            key={`${entry.date}-${entry.entry_id}`} 
                            className="border-l-4 pl-4"
                            style={{ borderColor: 'var(--color-success)' }}
                          >
                            {(index === 0 || entry.date !== arr[index - 1].date) && (
                              <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                {entry.date}
                              </h4>
                            )}
                            
                            <div 
                              className="rounded-lg p-4 mb-2"
                              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                            >
                              {entry.content_type === 'code' ? (
                                <pre className="text-sm bg-gray-900 text-white p-3 rounded overflow-x-auto">
                                  <code>{entry.content}</code>
                                </pre>
                              ) : (
                                <div 
                                  className="prose max-w-none 
                                    [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2 
                                    [&_a]:text-blue-600 [&_a]:underline 
                                    [&_p]:mb-2 
                                    [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 
                                    [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 
                                    [&_ul]:list-disc [&_ul]:ml-6 
                                    [&_ol]:list-decimal [&_ol]:ml-6
                                    [&_[data-link-preview]]:my-4 [&_[data-link-preview]]:block
                                    [&_.link-preview]:my-4"
                                  dangerouslySetInnerHTML={{ __html: processLinkPreviews(fixImageUrls(entry.content)) }}
                                />
                              )}
                            </div>

                            {entry.labels.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {entry.labels.map((label) => (
                                  <span
                                    key={label.name}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                    style={{ 
                                      backgroundColor: transparentLabels ? 'transparent' : label.color,
                                      color: transparentLabels ? label.color : 'white',
                                      border: transparentLabels ? `1px solid ${label.color}` : 'none'
                                    }}
                                  >
                                    {label.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* In Progress Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-accent)' }}>
                        <span className="text-2xl">⚙</span> In Progress
                      </h3>
                      <button
                        onClick={() => copySection('in-progress')}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
                        style={{
                          backgroundColor: `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}20`,
                          color: 'var(--color-accent)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}30`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = `${getComputedStyle(document.documentElement).getPropertyValue('--color-accent')}20`;
                        }}
                        title="Copy in progress section"
                      >
                        {copiedSection === 'in-progress' ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy Section
                          </>
                        )}
                      </button>
                    </div>
                    <div className="space-y-4">
                      {report.entries.filter(e => !e.is_completed).length === 0 ? (
                        <div className="italic pl-4" style={{ color: 'var(--color-text-secondary)' }}>No items in progress</div>
                      ) : (
                        report.entries.filter(e => !e.is_completed).map((entry, index, arr) => (
                          <div 
                            key={`${entry.date}-${entry.entry_id}`} 
                            className="border-l-4 pl-4"
                            style={{ borderColor: 'var(--color-accent)' }}
                          >
                            {(index === 0 || entry.date !== arr[index - 1].date) && (
                              <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                {entry.date}
                              </h4>
                            )}
                            
                            <div 
                              className="rounded-lg p-4 mb-2"
                              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                            >
                              {entry.content_type === 'code' ? (
                                <pre className="text-sm bg-gray-900 text-white p-3 rounded overflow-x-auto">
                                  <code>{entry.content}</code>
                                </pre>
                              ) : (
                                <div 
                                  className="prose max-w-none 
                                    [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2 
                                    [&_a]:text-blue-600 [&_a]:underline 
                                    [&_p]:mb-2 
                                    [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 
                                    [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 
                                    [&_ul]:list-disc [&_ul]:ml-6 
                                    [&_ol]:list-decimal [&_ol]:ml-6
                                    [&_[data-link-preview]]:my-4 [&_[data-link-preview]]:block
                                    [&_.link-preview]:my-4"
                                  dangerouslySetInnerHTML={{ __html: processLinkPreviews(fixImageUrls(entry.content)) }}
                                />
                              )}
                            </div>

                            {entry.labels.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {entry.labels.map((label) => (
                                  <span
                                    key={label.name}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                    style={{ 
                                      backgroundColor: transparentLabels ? 'transparent' : label.color,
                                      color: transparentLabels ? label.color : 'white',
                                      border: transparentLabels ? `1px solid ${label.color}` : 'none'
                                    }}
                                  >
                                    {label.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected Entries Report Section */}
      <div 
        className="rounded-lg shadow-lg p-6 mt-6"
        style={{ backgroundColor: 'var(--color-bg-primary)', ...textureStyles }}
      >
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-8 w-8" style={{ color: 'var(--color-text-secondary)' }} />
            <h2 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Selected Entries Report</h2>
          </div>
          <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Generate a report of all entries marked with "Add to Report" (not filtered by date or week).
          </p>

          <div className="flex gap-4 items-end mb-4">
            <button
              onClick={generateAllEntriesReport}
              disabled={loadingAll}
              className="px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: loadingAll ? 'var(--color-bg-tertiary)' : 'var(--color-accent)',
                color: loadingAll ? 'var(--color-text-tertiary)' : 'var(--color-accent-text)'
              }}
              onMouseEnter={(e) => {
                if (!loadingAll) e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                if (!loadingAll) e.currentTarget.style.opacity = '1';
              }}
            >
              {loadingAll ? 'Generating...' : 'Generate'}
            </button>

            {allEntriesReport && (
              <>
                <button
                  onClick={copyAllEntriesReport}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg transition-colors"
                  style={{
                    backgroundColor: copiedAllReport ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    color: 'var(--color-accent-text)'
                  }}
                  onMouseEnter={(e) => {
                    if (!copiedAllReport) e.currentTarget.style.backgroundColor = 'var(--color-text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!copiedAllReport) e.currentTarget.style.backgroundColor = 'var(--color-text-secondary)';
                  }}
                >
                  {copiedAllReport ? (
                    <>
                      <Check className="h-5 w-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-5 w-5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={clearAllReportFlags}
                  disabled={allEntriesReport.entries.length === 0}
                  className="px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--color-danger, #ef4444)',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (allEntriesReport.entries.length > 0) e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    if (allEntriesReport.entries.length > 0) e.currentTarget.style.opacity = '1';
                  }}
                >
                  Clear All
                </button>
                <button
                  onClick={exportAllEntriesReport}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg transition-colors"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-text)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-accent)';
                  }}
                >
                  <Download className="h-5 w-5" />
                  Export to Markdown
                </button>
              </>
            )}
          </div>
        </div>

        {allEntriesReport && (
          <div className="pt-6" style={{ borderTop: '1px solid var(--color-border-primary)' }}>
            <div className="mb-4">
              <h3 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                All Entries
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {allEntriesReport.entries.length} {allEntriesReport.entries.length === 1 ? 'entry' : 'entries'}
              </p>
            </div>

            {allEntriesReport.entries.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
                No entries found.
              </div>
            ) : (
              <div className="space-y-4">
                {allEntriesReport.entries.map((entry: any) => (
                  <div 
                    key={entry.entry_id} 
                    onClick={() => goToEntry(entry.date, entry.entry_id)}
                    className="rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                    style={{
                      border: '1px solid var(--color-border-primary)',
                      backgroundColor: 'var(--color-bg-primary)'
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{entry.date}</span>
                          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {formatTimestamp(entry.created_at, timezone, 'h:mm a')}
                          </span>
                          {entry.content_type === 'code' && (
                            <span className="px-2 py-0.5 bg-gray-800 text-white text-xs rounded">Code</span>
                          )}
                          {entry.is_important && <span title="Important">⭐</span>}
                          {entry.is_completed && <span title="Completed">✓</span>}
                        </div>

                        {entry.labels.length > 0 && (
                          <div className="flex gap-2 flex-wrap mb-2">
                            {entry.labels.map((label: any) => (
                              <span
                                key={label.name}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: label.color }}
                              >
                                {label.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyEntry(entry);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
                        style={{
                          backgroundColor: copiedEntryId === entry.entry_id 
                            ? `${getComputedStyle(document.documentElement).getPropertyValue('--color-success')}20`
                            : 'var(--color-bg-tertiary)',
                          color: copiedEntryId === entry.entry_id 
                            ? 'var(--color-success)'
                            : 'var(--color-text-primary)'
                        }}
                        onMouseEnter={(e) => {
                          if (copiedEntryId !== entry.entry_id) {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (copiedEntryId !== entry.entry_id) {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                          }
                        }}
                        title="Copy entry"
                      >
                        {copiedEntryId === entry.entry_id ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>

                    {entry.content_type === 'code' ? (
                      <pre className="text-sm bg-gray-900 text-white p-3 rounded overflow-x-auto">
                        <code>{entry.content}</code>
                      </pre>
                    ) : (
                      <div 
                        className="text-gray-800 leading-relaxed 
                          [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2 
                          [&_a]:text-blue-600 [&_a]:underline 
                          [&_p]:mb-2 
                          [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 
                          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 
                          [&_ul]:list-disc [&_ul]:ml-6 
                          [&_ol]:list-decimal [&_ol]:ml-6
                          [&_[data-link-preview]]:my-4 [&_[data-link-preview]]:block
                          [&_.link-preview]:my-4"
                        dangerouslySetInnerHTML={{ __html: processLinkPreviews(entry.content) }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;

