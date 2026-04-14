"use client";

import React from "react";

/**
 * Placeholder for SDK-driven interactive cards.
 * In a full implementation, this would parse the SDK's Card element
 * and render buttons, inputs, etc.
 */
export default function ChatCard({ data }: { data: any }) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 my-2">
      {data.title && <h3 className="text-white font-semibold mb-2">{data.title}</h3>}
      {data.text && <p className="text-zinc-300 text-sm">{data.text}</p>}
      <div className="flex flex-wrap gap-2 mt-4">
        {data.actions?.map((action: any, i: number) => (
          <button 
            key={i}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
