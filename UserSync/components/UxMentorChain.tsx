import React, { useEffect, useState } from 'react';
import { ChevronDown, Code2, Eye, Flame, Lightbulb, RefreshCw, ScanSearch } from 'lucide-react';

/**
 * The 3-piece UX chain (spec.md §17.3): screenshot+heatmap -> problem -> solution,
 * one card per piece. Each card carries a switch control flipping between the
 * rendered design and its code representation; a dropdown switches between the
 * three ux-mentor modes (https://leon4gr45-ux-mentor.hf.space).
 */

interface ChainPiece {
  kind: string;
  title: string;
  rendered: string | null;
  code: string | null;
  body: unknown;
  simulated?: boolean;
}

interface ChainMode {
  id: string;
  label: string;
  description: string;
}

const FALLBACK_MODES: ChainMode[] = [
  { id: 'ux_analysis', label: 'UX Analysis', description: 'Heatmaps, drop-off points, UX score, and suggestions.' },
  { id: 'user_journey', label: 'User Journey', description: 'Simulated task walkthrough with step script.' },
  { id: 'design_iteration', label: 'Design Iteration', description: 'AI-improved design frame fixing identified issues.' },
];

const FALLBACK_PIECES: ChainPiece[] = [
  {
    kind: 'screenshot_heatmap',
    title: 'Screenshot with interaction heatmap',
    rendered: 'placeholder://screenshot-with-heatmap',
    code: null,
    body: 'Attention concentrates on the hero area; the primary CTA sits below the fold.',
    simulated: true,
  },
  {
    kind: 'problem',
    title: 'UX/UI problem identified',
    rendered: null,
    code: null,
    body: [{ problem: 'Primary call-to-action below the fold on smartphone viewports', severity: 'high' }],
    simulated: true,
  },
  {
    kind: 'solution',
    title: 'Solution: optimized code, re-rendered',
    rendered: 'placeholder://optimized-render',
    code: '<section class="min-h-[60vh] grid place-items-center">\n  <a class="rounded-xl bg-teal-500 px-8 py-4 text-lg font-bold">Primary CTA — now above the fold</a>\n</section>',
    body: 'Code regenerated from the screenshot, optimized against the identified problem, and re-rendered.',
    simulated: true,
  },
];

const PIECE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  screenshot_heatmap: Flame,
  problem: ScanSearch,
  solution: Lightbulb,
};

const RenderedPreview: React.FC<{ piece: ChainPiece }> = ({ piece }) => {
  if (piece.rendered && !piece.rendered.startsWith('placeholder://')) {
    return <img src={piece.rendered} alt={piece.title} className="h-48 w-full rounded-xl object-cover" />;
  }
  // Placeholder render: a stylized stand-in so the card works pre-integration.
  return (
    <div className="relative flex h-48 w-full items-center justify-center overflow-hidden rounded-xl border border-gray-800 bg-[radial-gradient(circle_at_35%_30%,rgba(244,63,94,0.45),transparent_45%),radial-gradient(circle_at_60%_60%,rgba(251,191,36,0.3),transparent_40%),#0a0a0a]">
      {piece.kind === 'solution' && (
        <a className="rounded-xl bg-teal-500 px-6 py-3 text-sm font-bold text-black">Primary CTA — above the fold</a>
      )}
      {piece.kind === 'screenshot_heatmap' && (
        <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-300">heatmap overlay</span>
      )}
    </div>
  );
};

const ChainCard: React.FC<{ piece: ChainPiece; index: number }> = ({ piece, index }) => {
  const [showCode, setShowCode] = useState(false);
  const hasBoth = Boolean(piece.code) && piece.kind !== 'problem';
  const Icon = PIECE_ICONS[piece.kind] || Lightbulb;

  return (
    <div className="flex flex-col rounded-2xl border border-gray-800 bg-[#0c0c0c] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
          <span className="text-teal-500">{String(index + 1).padStart(2, '0')}</span>
          <Icon size={14} className="text-teal-400" />
          {piece.title}
        </div>
        {hasBoth && (
          <button
            aria-label={showCode ? 'Show rendered design' : 'Show code'}
            title={showCode ? 'Switch to rendered design' : 'Switch to code'}
            onClick={() => setShowCode((value) => !value)}
            className="flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-2.5 py-1 text-[10px] font-bold text-gray-300 transition hover:border-teal-500/60 hover:text-teal-300"
          >
            {showCode ? <Eye size={12} /> : <Code2 size={12} />}
            {showCode ? 'Design' : 'Code'}
          </button>
        )}
      </div>

      {piece.kind === 'problem' ? (
        <div className="space-y-2">
          {(Array.isArray(piece.body) ? piece.body : [piece.body]).map((item: any, itemIndex: number) => (
            <div key={itemIndex} className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
              <div className="text-sm font-bold text-rose-300">{item.problem || String(item)}</div>
              {item.evidence && <div className="mt-1 text-xs text-gray-400">{item.evidence}</div>}
              {item.severity && (
                <span className="mt-2 inline-block rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">{item.severity}</span>
              )}
            </div>
          ))}
        </div>
      ) : showCode && piece.code ? (
        <pre className="h-48 overflow-auto rounded-xl border border-gray-800 bg-black p-3 text-[11px] leading-relaxed text-teal-100">{piece.code}</pre>
      ) : (
        <RenderedPreview piece={piece} />
      )}

      <p className="mt-3 text-xs leading-relaxed text-gray-400">{typeof piece.body === 'string' ? piece.body : null}</p>
      {piece.simulated && (
        <span className="mt-2 self-start rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">simulated</span>
      )}
    </div>
  );
};

const UxMentorChain: React.FC = () => {
  const [modes, setModes] = useState<ChainMode[]>(FALLBACK_MODES);
  const [mode, setMode] = useState('ux_analysis');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pieces, setPieces] = useState<ChainPiece[]>(FALLBACK_PIECES);
  const [targetUrl, setTargetUrl] = useState('https://example.com');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/ux-chain/modes')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => body?.data && setModes(body.data))
      .catch(() => undefined);
  }, []);

  const runChain = async (selectedMode: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/ux-chain/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selectedMode, target_url: targetUrl }),
      });
      if (response.ok) {
        const body = await response.json();
        setPieces(body.data.pieces);
      } else {
        setPieces(FALLBACK_PIECES);
      }
    } catch {
      setPieces(FALLBACK_PIECES);
    } finally {
      setLoading(false);
    }
  };

  const activeMode = modes.find((entry) => entry.id === mode) || modes[0];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 text-white">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">UX Chain — screenshot → problem → solution</h2>
          <p className="text-xs text-gray-400">Heatmap evidence, identified UX issue, and a re-rendered fix via ux-mentor + screenshot-to-code.</p>
        </div>

        {/* Mode dropdown (the three ux-mentor modes) */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((value) => !value)}
            className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-gray-200 transition hover:border-teal-500/60"
          >
            {activeMode.label}
            <ChevronDown size={14} className={`transition ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-gray-800 bg-[#0c0c0c] p-1 shadow-2xl">
              {modes.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => {
                    setMode(entry.id);
                    setMenuOpen(false);
                    runChain(entry.id);
                  }}
                  className={`w-full rounded-lg p-3 text-left transition ${
                    entry.id === mode ? 'bg-teal-500/10 text-teal-300' : 'text-gray-300 hover:bg-gray-900'
                  }`}
                >
                  <div className="text-sm font-bold">{entry.label}</div>
                  <div className="text-[11px] text-gray-500">{entry.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        <input
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          placeholder="Target URL, Figma ref, or journey run id"
          className="flex-1 rounded-xl border border-gray-800 bg-black p-3 text-xs text-white outline-none focus:border-teal-500"
        />
        <button
          onClick={() => runChain(mode)}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-teal-500"
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Flame size={14} />}
          Run chain
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {pieces.map((piece, index) => (
          <ChainCard key={`${mode}-${piece.kind}-${index}`} piece={piece} index={index} />
        ))}
      </div>
    </div>
  );
};

export default UxMentorChain;
