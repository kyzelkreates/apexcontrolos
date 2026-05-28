'use client';
import React from 'react';
import { AP3XSidebar } from '@/components/shared/AP3XSidebar';
import { AP3XTopBar } from '@/components/shared/AP3XTopBar';
import { useAP3XData } from '@/hooks/useAP3XData';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  useAP3XData(); // bootstraps all Supabase data + realtime

  return (
    <div className="flex h-screen overflow-hidden bg-apex-bg">
      <AP3XSidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <AP3XTopBar />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
