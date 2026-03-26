// Feature: premium-dark-theme-ui
import React from 'react';
import { render } from '@testing-library/react';

let capturedProps = null;

vi.mock('@monaco-editor/react', () => ({
  default: (props) => {
    capturedProps = props;
    return <div data-testid="monaco-editor" data-theme={props.theme} />;
  },
}));

import EditorPanel from './EditorPanel';

describe('EditorPanel unit tests', () => {
  beforeEach(() => {
    capturedProps = null;
    // Provide a minimal localStorage stub
    localStorage.clear();
  });

  it('passes theme="vs-dark" to Monaco Editor', () => {
    render(
      <EditorPanel
        language="cpp"
        setLanguage={() => {}}
        code="// hello"
        setCode={() => {}}
      />
    );
    expect(capturedProps).not.toBeNull();
    expect(capturedProps.theme).toBe('vs-dark');
  });

  it('toolbar div has sticky and top-0 classes', () => {
    const { container } = render(
      <EditorPanel
        language="cpp"
        setLanguage={() => {}}
        code="// hello"
        setCode={() => {}}
      />
    );
    // The sticky toolbar is the first child div of the root
    const toolbar = container.querySelector('.sticky.top-0');
    expect(toolbar).toBeInTheDocument();
  });
});
