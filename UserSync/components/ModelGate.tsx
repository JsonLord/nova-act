import React from 'react';
import { KeyRound } from 'lucide-react';

/** Inline notice shown when an LLM-backed action needs a BYOK model that
 * isn't configured. Links to the Dev → BYOK settings. */
const ModelGate: React.FC<{ modality?: 'text' | 'vision'; loggedIn: boolean; what: string }> = ({
  modality = 'text', loggedIn, what,
}) => (
  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-300">
    <KeyRound size={12} />
    {loggedIn ? (
      <span>
        {what} needs a {modality} model.{' '}
        <a href="#/dev/account" className="underline hover:text-amber-200">Add a BYOK key</a> in Dev → settings.
      </span>
    ) : (
      <span>Sign in with Hugging Face and add a {modality} key to use {what}.</span>
    )}
  </div>
);

export default ModelGate;
