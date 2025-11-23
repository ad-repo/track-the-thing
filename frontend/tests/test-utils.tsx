import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, RenderOptions } from '@testing-library/react';

type RouterOptions = {
  route?: string;
} & Omit<RenderOptions, 'wrapper'>;

export function renderWithRouter(
  ui: ReactElement,
  { route = '/', ...renderOptions }: RouterOptions = {},
) {
  return render(
    <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>,
    renderOptions,
  );
}

