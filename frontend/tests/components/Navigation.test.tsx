/**
 * Navigation Component Tests
 *
 * Tests for navigation bar including:
 * - Renders all navigation links
 * - Active link styling based on route
 * - Logo link to home
 * - Day link includes today's date
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Navigation from '@/components/Navigation';

vi.mock('@/contexts/TimezoneContext', () => ({
  useTimezone: () => ({ timezone: 'UTC' }),
}));

vi.mock('@/hooks/useTexture', () => ({
  useTexture: () => ({}),
}));

// Mock date-fns-tz to return predictable values
vi.mock('date-fns-tz', () => ({
  formatInTimeZone: (date: Date, timezone: string, format: string) => {
    if (format === 'yyyy-MM-dd') return '2025-01-07';
    if (format === 'EEEE') return 'Tuesday';
    return '2025-01-07';
  },
}));

describe('Navigation', () => {
  const renderNavigation = (initialPath: string = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Navigation />
      </MemoryRouter>
    );
  };

  describe('Basic Rendering', () => {
    it('renders logo link', () => {
      renderNavigation();

      const logoLink = screen.getByTitle('Track the Thing');
      expect(logoLink).toBeInTheDocument();
      expect(logoLink).toHaveAttribute('href', '/');
    });

    it('renders all navigation links', () => {
      renderNavigation();

      expect(screen.getByTitle('Tuesday')).toBeInTheDocument();
      expect(screen.getByTitle('Calendar')).toBeInTheDocument();
      expect(screen.getByTitle('Lists')).toBeInTheDocument();
      expect(screen.getByTitle('Kanban')).toBeInTheDocument();
      expect(screen.getByTitle('Search')).toBeInTheDocument();
      expect(screen.getByTitle('Reports')).toBeInTheDocument();
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    it('day link includes current date', () => {
      renderNavigation();

      const dayLink = screen.getByTitle('Tuesday');
      expect(dayLink).toHaveAttribute('href', '/day/2025-01-07');
    });

    it('calendar link goes to /calendar', () => {
      renderNavigation();

      expect(screen.getByTitle('Calendar')).toHaveAttribute('href', '/calendar');
    });

    it('lists link goes to /lists', () => {
      renderNavigation();

      expect(screen.getByTitle('Lists')).toHaveAttribute('href', '/lists');
    });

    it('kanban link goes to /kanban', () => {
      renderNavigation();

      expect(screen.getByTitle('Kanban')).toHaveAttribute('href', '/kanban');
    });

    it('search link goes to /search', () => {
      renderNavigation();

      expect(screen.getByTitle('Search')).toHaveAttribute('href', '/search');
    });

    it('reports link goes to /reports', () => {
      renderNavigation();

      expect(screen.getByTitle('Reports')).toHaveAttribute('href', '/reports');
    });

    it('settings link goes to /settings', () => {
      renderNavigation();

      expect(screen.getByTitle('Settings')).toHaveAttribute('href', '/settings');
    });
  });

  describe('Active Link Styling', () => {
    it('highlights home link when on root path', () => {
      renderNavigation('/');

      const logoLink = screen.getByTitle('Track the Thing');
      expect(logoLink).toHaveStyle({ color: 'var(--color-accent)' });
    });

    it('highlights day link when on day path', () => {
      renderNavigation('/day/2025-01-07');

      const dayLink = screen.getByTitle('Tuesday');
      expect(dayLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights calendar link when on calendar path', () => {
      renderNavigation('/calendar');

      const calendarLink = screen.getByTitle('Calendar');
      expect(calendarLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights lists link when on lists path', () => {
      renderNavigation('/lists');

      const listsLink = screen.getByTitle('Lists');
      expect(listsLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights kanban link when on kanban path', () => {
      renderNavigation('/kanban');

      const kanbanLink = screen.getByTitle('Kanban');
      expect(kanbanLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights search link when on search path', () => {
      renderNavigation('/search');

      const searchLink = screen.getByTitle('Search');
      expect(searchLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights reports link when on reports path', () => {
      renderNavigation('/reports');

      const reportsLink = screen.getByTitle('Reports');
      expect(reportsLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights settings link when on settings path', () => {
      renderNavigation('/settings');

      const settingsLink = screen.getByTitle('Settings');
      expect(settingsLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('does not highlight other links when one is active', () => {
      renderNavigation('/calendar');

      // Calendar should be highlighted, but Search should not have the accent background
      const calendarLink = screen.getByTitle('Calendar');
      const searchLink = screen.getByTitle('Search');

      expect(calendarLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
      // Search should have different color (not accent text color)
      expect(searchLink).toHaveStyle({ color: 'var(--color-text-secondary)' });
    });
  });

  describe('Link Labels', () => {
    it('shows day name as label for day link', () => {
      renderNavigation();

      expect(screen.getByText('Tuesday')).toBeInTheDocument();
    });

    it('shows "Calendar" label', () => {
      renderNavigation();

      expect(screen.getByText('Calendar')).toBeInTheDocument();
    });

    it('shows "Lists" label', () => {
      renderNavigation();

      expect(screen.getByText('Lists')).toBeInTheDocument();
    });

    it('shows "Kanban" label', () => {
      renderNavigation();

      expect(screen.getByText('Kanban')).toBeInTheDocument();
    });

    it('shows "Search" label', () => {
      renderNavigation();

      expect(screen.getByText('Search')).toBeInTheDocument();
    });

    it('shows "Reports" label', () => {
      renderNavigation();

      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    it('shows "Settings" label', () => {
      renderNavigation();

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });
});

