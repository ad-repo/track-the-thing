/**
 * Navigation Component Tests
 *
 * Tests for the Navigation component with route links and active states.
 */
import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Navigation from '@/components/Navigation';
import { renderWithRouter } from '../test-utils';

vi.mock('@/hooks/useTexture', () => ({
  useTexture: () => ({}),
}));

vi.mock('@/contexts/TimezoneContext', () => ({
  useTimezone: () => ({ timezone: 'UTC' }),
}));

describe('Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Date to get consistent day name
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-07T12:00:00Z')); // Friday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderNav = (initialRoute = '/') => renderWithRouter(<Navigation />, { route: initialRoute });

  describe('Link Rendering', () => {
    it('renders home link with logo', () => {
      renderNav();

      expect(screen.getByTitle('Track the Thing')).toBeInTheDocument();
    });

    it('renders all navigation links', () => {
      renderNav();

      expect(screen.getByTitle('Friday')).toBeInTheDocument(); // Day name
      expect(screen.getByTitle('Calendar')).toBeInTheDocument();
      expect(screen.getByTitle('Lists')).toBeInTheDocument();
      expect(screen.getByTitle('Kanban')).toBeInTheDocument();
      expect(screen.getByTitle('Search')).toBeInTheDocument();
      expect(screen.getByTitle('Reports')).toBeInTheDocument();
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
    });

    it('displays day name based on current date', () => {
      renderNav();

      // Nov 7, 2025 is a Friday
      expect(screen.getByTitle('Friday')).toBeInTheDocument();
      expect(screen.getByText('Friday')).toBeInTheDocument();
    });

    it('renders navigation icons', () => {
      renderNav();

      // Each link should have an icon (SVG element)
      const links = screen.getAllByRole('link');
      // First link is home, rest are nav items
      expect(links.length).toBeGreaterThanOrEqual(8); // Home + 7 nav items
    });
  });

  describe('Active Link States', () => {
    it('highlights home link when on home page', () => {
      renderNav('/');

      const homeLink = screen.getByTitle('Track the Thing');
      expect(homeLink).toHaveStyle({ color: 'var(--color-accent)' });
    });

    it('highlights calendar link when on calendar page', () => {
      renderNav('/calendar');

      const calendarLink = screen.getByTitle('Calendar');
      expect(calendarLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights day link when on day page', () => {
      renderNav('/day/2025-11-07');

      const dayLink = screen.getByTitle('Friday');
      expect(dayLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights lists link when on lists page', () => {
      renderNav('/lists');

      const listsLink = screen.getByTitle('Lists');
      expect(listsLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights kanban link when on kanban page', () => {
      renderNav('/kanban');

      const kanbanLink = screen.getByTitle('Kanban');
      expect(kanbanLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights search link when on search page', () => {
      renderNav('/search');

      const searchLink = screen.getByTitle('Search');
      expect(searchLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights reports link when on reports page', () => {
      renderNav('/reports');

      const reportsLink = screen.getByTitle('Reports');
      expect(reportsLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('highlights settings link when on settings page', () => {
      renderNav('/settings');

      const settingsLink = screen.getByTitle('Settings');
      expect(settingsLink).toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });

    it('does not highlight inactive links', () => {
      renderNav('/calendar');

      const settingsLink = screen.getByTitle('Settings');
      // Inactive links should NOT have the accent background
      expect(settingsLink).not.toHaveStyle({ backgroundColor: 'var(--color-accent)' });
    });
  });

  describe('Link Destinations', () => {
    it('day link includes today date', () => {
      renderNav();

      const dayLink = screen.getByTitle('Friday');
      expect(dayLink).toHaveAttribute('href', '/day/2025-11-07');
    });

    it('calendar link goes to /calendar', () => {
      renderNav();

      expect(screen.getByTitle('Calendar')).toHaveAttribute('href', '/calendar');
    });

    it('lists link goes to /lists', () => {
      renderNav();

      expect(screen.getByTitle('Lists')).toHaveAttribute('href', '/lists');
    });

    it('kanban link goes to /kanban', () => {
      renderNav();

      expect(screen.getByTitle('Kanban')).toHaveAttribute('href', '/kanban');
    });

    it('search link goes to /search', () => {
      renderNav();

      expect(screen.getByTitle('Search')).toHaveAttribute('href', '/search');
    });

    it('reports link goes to /reports', () => {
      renderNav();

      expect(screen.getByTitle('Reports')).toHaveAttribute('href', '/reports');
    });

    it('settings link goes to /settings', () => {
      renderNav();

      expect(screen.getByTitle('Settings')).toHaveAttribute('href', '/settings');
    });
  });
});
