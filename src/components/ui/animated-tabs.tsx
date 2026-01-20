"use client";

import { motion } from "framer-motion";
import { useState } from "react";

interface Tab {
  id: string;
  label: string;
}

interface AnimatedTabsProps {
  tabs: Tab[];
  defaultTab?: string;
  activeTabId?: string;
  onChange?: (tabId: string) => void;
}

export function AnimatedTabs({
  tabs,
  defaultTab,
  activeTabId,
  onChange,
}: AnimatedTabsProps) {
  const isControlled = activeTabId !== undefined;
  const [internalActive, setInternalActive] = useState(
    defaultTab || tabs[0].id,
  );
  const activeTab = isControlled ? activeTabId : internalActive;

  const handleTabChange = (tabId: string) => {
    if (!isControlled) {
      setInternalActive(tabId);
    }
    onChange?.(tabId);
  };

  return (
    <div className="flex space-x-1 rounded-full border border-black/10 bg-white p-1 shadow-soft">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={`
            relative rounded-full px-4 py-2 text-sm font-semibold
            text-slate-700 transition
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40
            ${activeTab === tab.id ? "text-white" : "hover:text-black"}
          `}
          style={{
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {activeTab === tab.id && (
            <motion.span
              layoutId="bubble"
              className="absolute inset-0 z-0 rounded-full bg-black"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
