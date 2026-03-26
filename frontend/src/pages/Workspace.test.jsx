// Feature: premium-dark-theme-ui
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Workspace from './Workspace';

vi.mock('../utils/api', () => ({
  getProblemDetails: vi.fn().mockResolvedValue(null),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '1' }) };
});

vi.mock('@monaco-editor/react', () => ({
  default: (props) => <div data-testid="monaco-editor" data-theme={props.theme} />,
}));

vi.mock('../components/EditorPanel', () => ({
  default: () => <div data-testid="editor-panel" />,
}));

vi.mock('../components/ExecutionPanel', () => ({
  default: () => <div data-testid="execution-panel" />,
}));

const renderWorkspace = () =>
  render(
    <MemoryRouter>
      <Workspace />
    </MemoryRouter>
  );

describe('Workspace unit tests', () => {
  it('workspace root has bg-[#0f172a] class', () => {
    const { container } = renderWorkspace();
    const root = container.firstChild;
    expect(root.className).toContain('bg-[#0f172a]');
  });

  it('renders three panels with w-[30%], w-[40%], w-[30%] classes', () => {
    const { container } = renderWorkspace();
    const panel30Left = container.querySelector('.w-\\[30\\%\\]');
    const panel40 = container.querySelector('.w-\\[40\\%\\]');
    // There should be two w-[30%] panels and one w-[40%]
    const all30 = container.querySelectorAll('.w-\\[30\\%\\]');
    expect(all30.length).toBe(2);
    expect(panel40).toBeInTheDocument();
  });

  it('back-link to "/" is present', () => {
    renderWorkspace();
    const backLink = screen.getByRole('link', { name: /Problem List/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink.getAttribute('href')).toBe('/');
  });
});
