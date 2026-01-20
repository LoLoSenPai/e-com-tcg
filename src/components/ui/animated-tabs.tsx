"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";

type Tab = {
  id: string;
  label: string;
};

type AnimatedTabsProps = {
  tabs: Tab[];
  defaultTab?: string;
  activeTabId?: string;
  onChange?: (tabId: string) => void;
};

export function AnimatedTabs({
  tabs,
  defaultTab,
  activeTabId,
  onChange,
}: AnimatedTabsProps) {
  const firstTab = tabs[0]?.id;
  const initial = useMemo(
    () => defaultTab || activeTabId || firstTab,
    [activeTabId, defaultTab, firstTab],
  );
  const [internalActive, setInternalActive] = useState(initial);
  const activeTab = activeTabId || internalActive;

  const handleTabChange = (tabId: string) => {
    setInternalActive(tabId);
    onChange?.(tabId);
  };

  if (!tabs.length) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white p-1 shadow-soft">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={`relative rounded-full px-4 py-2 text-sm font-semibold transition ${
              isActive ? "text-white" : "text-slate-600 hover:text-black"
            }`}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {isActive ? (
              <motion.span
                layoutId="nav-bubble"
                className="absolute inset-0 -z-10 rounded-full bg-black"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            ) : null}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
