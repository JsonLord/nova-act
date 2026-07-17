import { useCallback, useEffect, useState } from 'react';

/** Hash-based routing (`#/<tab>/<view>`) — works with static file serving on
 * a Space (no server rewrites needed), gives real back/forward + deep links.
 * Returns the current tab/view and a navigate() that updates the hash. */

export interface Route {
  tab: string;
  view: string;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [tab = '', view = ''] = raw.split('/');
  return { tab, view };
}

export function useHashRoute(defaultTab: string): [Route, (tab: string, view?: string) => void] {
  const [route, setRoute] = useState<Route>(() => {
    const r = parse();
    return { tab: r.tab || defaultTab, view: r.view };
  });

  useEffect(() => {
    const onChange = () => {
      const r = parse();
      setRoute({ tab: r.tab || defaultTab, view: r.view });
    };
    window.addEventListener('hashchange', onChange);
    // Normalize an empty hash on first load.
    if (!window.location.hash) window.location.hash = `#/${route.tab}`;
    return () => window.removeEventListener('hashchange', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useCallback((tab: string, view?: string) => {
    window.location.hash = view ? `#/${tab}/${view}` : `#/${tab}`;
  }, []);

  return [route, navigate];
}
