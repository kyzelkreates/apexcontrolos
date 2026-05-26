'use client';
import React from 'react';
import { Sidebar } from '@/components/shared/Sidebar';
import { TopBar } from '@/components/shared/TopBar';
import { DataModeDebug } from '@/components/shared/DataModeDebug';
import { useApexData } from '@/hooks/useApexData';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  useApexData(); // bootstraps data loading

  return (
    <div className="flex h-screen overflow-hidden bg-apex-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
      {/* Admin debug overlay — only visible when DATA_DEBUG = true in core/dataMode.ts */}
      <DataModeDebug />
    </div>
  );
}
