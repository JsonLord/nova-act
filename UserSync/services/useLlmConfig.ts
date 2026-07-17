import { useCallback, useEffect, useState } from 'react';
import { apiData } from './api';

/** BYOK awareness: does the logged-in user have a text / vision model
 * configured this session? Gates the LLM-backed actions (enrich, auto-fill,
 * vision journeys, graph Q&A) so the UI can prompt to configure when not. */

export interface LlmConfigState {
  textConfigured: boolean;
  visionConfigured: boolean;
  loggedIn: boolean;
  refresh: () => void;
}

export function useLlmConfig(): LlmConfigState {
  const [state, setState] = useState({ textConfigured: false, visionConfigured: false, loggedIn: true });

  const refresh = useCallback(() => {
    apiData('/api/account/llm-config')
      .then((cfg: any) =>
        setState({ textConfigured: Boolean(cfg?.text?.api_key_set), visionConfigured: Boolean(cfg?.vision?.api_key_set), loggedIn: true }),
      )
      .catch((err: any) => {
        // 401 = not logged in (keys are login-gated).
        if (err?.status === 401) setState({ textConfigured: false, visionConfigured: false, loggedIn: false });
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
