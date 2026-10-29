'use client';

import React from 'react';
import { TabType } from '../types';
import { IconTasksTab, IconCalendarTab, IconNotesTab } from './icons';

interface NavigationProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'tasks' as TabType, label: 'Tasks', icon: IconTasksTab },
    { id: 'calendar' as TabType, label: 'Calendar', icon: IconCalendarTab },
    { id: 'notes' as TabType, label: 'Notes', icon: IconNotesTab },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto grid grid-cols-3 bg-[var(--surface)] border-t border-[var(--line)] z-20 pb-[env(safe-area-inset-bottom,0px)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center py-2.5 text-xs font-semibold tracking-wider transition-colors cursor-pointer ${
              isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Icon className="w-6 h-6 mb-0.5" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
