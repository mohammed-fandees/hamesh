// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Menu, MenuItem } from '@/ui/kit/Menu';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('a menu drawn inside a shadow root, as on a web page', () => {
  it('lets its item take the click instead of closing on the press', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const scope = document.createElement('div');
    scope.className = 'hm-scope';
    shadow.append(scope);
    const onSelect = vi.fn();

    render(
      <Menu label="Note actions">
        {(close) => (
          <MenuItem
            onSelect={() => {
              close();
              onSelect();
            }}
          >
            Copy
          </MenuItem>
        )}
      </Menu>,
      { container: scope },
    );

    const inShadow = within(scope as unknown as HTMLElement);
    fireEvent.click(inShadow.getByRole('button', { name: 'Note actions' }));
    const item = inShadow.getByRole('menuitem', { name: 'Copy' });
    // A press first — which a document listener sees as a press on the host.
    fireEvent.pointerDown(item, { bubbles: true, composed: true });
    fireEvent.click(inShadow.getByRole('menuitem', { name: 'Copy' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('still closes on a press outside it', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const scope = document.createElement('div');
    scope.className = 'hm-scope';
    shadow.append(scope);
    render(
      <Menu label="Note actions">{() => <MenuItem onSelect={() => {}}>Copy</MenuItem>}</Menu>,
      {
        container: scope,
      },
    );
    const inShadow = within(scope as unknown as HTMLElement);
    fireEvent.click(inShadow.getByRole('button', { name: 'Note actions' }));
    expect(inShadow.getByRole('menuitem', { name: 'Copy' })).toBeInTheDocument();
    fireEvent.pointerDown(document.body, { bubbles: true, composed: true });
    expect(inShadow.queryByRole('menuitem', { name: 'Copy' })).toBeNull();
  });
});
