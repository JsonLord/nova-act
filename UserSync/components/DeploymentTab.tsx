import React from 'react';
import { ShieldCheck, HardDrive, Key, CloudLightning, FileCheck } from 'lucide-react';

export default function DeploymentTab() {
  return (
    <div className="bg-black text-white min-h-screen p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <CloudLightning className="text-orange-400 w-8 h-8" />
            <h1 className="text-3xl font-bold tracking-tight">Deployment & Integrations Hub</h1>
          </div>
          <p className="text-gray-400 max-w-3xl">
            Configure secure AWS IAM credentials, connect model control protocols (MCP), provision Kiro Power deployment packages, and review critical health telemetry check documents.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* IAM Configuration */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key className="text-orange-400 w-5 h-5" /> AWS IAM Security Setup
            </h3>
            <p className="text-xs text-gray-400">
              Set credentials to authorize automated tests to provision resources or execute inside secure AWS accounts.
            </p>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">AWS Access Key ID</label>
                <input
                  type="password"
                  value="AKIAIOSFODNN7EXAMPLE"
                  readOnly
                  className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-xs text-gray-400 font-mono outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">AWS Default Region</label>
                <input
                  type="text"
                  value="us-east-1"
                  readOnly
                  className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-xs text-gray-400 font-mono outline-none"
                />
              </div>
            </div>
            <span className="inline-block text-[10px] bg-green-950/20 text-green-400 border border-green-900/40 px-3 py-1 rounded-full font-bold">
              IAM Profile Locked & Active
            </span>
          </div>

          {/* MCP Integrations */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <HardDrive className="text-orange-400 w-5 h-5" /> MCP Configuration
            </h3>
            <p className="text-xs text-gray-400">
              Configure parameters to connect this interface with local execution skills, tools, and visual verify commands.
            </p>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">MCP Host Address</label>
                <input
                  type="text"
                  value="mcp://localhost:8501"
                  readOnly
                  className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-xs text-gray-400 font-mono outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">Available MCP Skills</label>
                <div className="bg-black border border-gray-800 rounded-lg p-2.5 text-xs text-teal-400 font-mono space-y-1">
                  <div>- verify_element_layout</div>
                  <div>- verify_color_contrast</div>
                  <div>- act_sequence_runner</div>
                </div>
              </div>
            </div>
          </div>

          {/* Kiro Power Packaging */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="text-orange-400 w-5 h-5" /> Kiro Power Bundle Packaging
            </h3>
            <p className="text-xs text-gray-400">
              Pack skills, automated flows, and deterministic QA tests into an immutable, self-contained, offline-compatible container.
            </p>
            <button className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl transition-colors">
              Compile & Export Kiro Bundle (.kiropwr)
            </button>
          </div>

          {/* Telemetry / Deployment Docs */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileCheck className="text-orange-400 w-5 h-5" /> Health & Telemetry Status
            </h3>
            <p className="text-xs text-gray-400">
              Monitor standard endpoints specified in compliance schemas.
            </p>
            <div className="bg-black border border-gray-800 rounded-lg p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">GET /health</span>
                <span className="text-green-400 font-bold">200 OK</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">GET /api-docs</span>
                <span className="text-green-400 font-bold">200 Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">OAuth State</span>
                <span className="text-green-400 font-bold">Configured (Huggingface)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
