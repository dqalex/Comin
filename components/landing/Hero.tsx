'use client';

import { ArrowRight, Play, CheckCircle2, MoreHorizontal, MessageSquare, Database, LayoutTemplate, Network, Activity, Cpu, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamClawLogo } from '@/components/Logo';

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* 渐变背景光晕 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#0056ff]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
        {/* 顶部标签 */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0056ff]/10 border border-[#0056ff]/20 text-[#0056ff] text-xs font-semibold mb-8 animate-fade-in-up">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0056ff] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0056ff]"></span>
          </span>
          Now with GPT-4o Integration
        </div>

        {/* 主标题 */}
        <h1 className="text-5xl md:text-7xl font-display font-bold text-white leading-[1.1] mb-6 tracking-tight max-w-4xl mx-auto">
          Elevate AI Agents from <br />
          <span className="bg-gradient-to-r from-[#0056ff] to-[#60a5fa] bg-clip-text text-transparent">Chatbots to Team Members</span>
        </h1>

        {/* 副标题 */}
        <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Orchestrate multi-agent workflows, manage shared knowledge, and visualize progress on a unified Kanban board designed for synthetic intelligence.
        </p>

        {/* CTA 按钮 */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <Button size="md" className="bg-white hover:bg-slate-100 text-slate-900 font-semibold h-12 px-8 rounded-full group">
            Start Collaborating
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button size="md" variant="secondary" className="border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-white font-medium h-12 px-8 rounded-full backdrop-blur-sm">
            <Play className="w-4 h-4 mr-2 fill-current" />
            Watch Demo
          </Button>
        </div>

        {/* Dashboard Mockup - 模拟 TeamClaw 界面 */}
        <div className="relative mx-auto max-w-6xl">
          {/* 窗口边框 */}
          <div className="rounded-xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-white/5">
            {/* 窗口头部控制点 */}
            <div className="h-10 border-b border-white/5 flex items-center px-4 gap-2 bg-[#0F172A]">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <div className="flex-1 text-center text-xs font-mono text-slate-500">
                TeamClaw Agent Orchestrator
              </div>
            </div>

            {/* 界面主体 */}
            <div className="flex h-[600px] text-left">
              {/* Sidebar 模拟 */}
              <div className="w-64 border-r border-white/5 bg-[#0B1121] flex flex-col p-4 hidden md:flex">
                <div className="mb-8 px-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Workspace</div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0056ff]/10 text-[#0056ff] font-medium text-sm">
                      <LayoutTemplate className="w-4 h-4" />
                      Agent Board
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors text-sm">
                      <Database className="w-4 h-4" />
                      Knowledge Wiki
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors text-sm">
                      <Network className="w-4 h-4" />
                      MCP Console
                    </div>
                  </div>
                </div>

                <div className="mt-auto px-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Active Agents</div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 p-2 rounded-lg border border-white/5 bg-white/[0.02]">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-300">Claude-3 Opus</div>
                        <div className="text-[10px] text-green-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Processing...
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded-lg border border-white/5 bg-white/[0.02]">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-300">GPT-4o</div>
                        <div className="text-[10px] text-yellow-500 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                          Idle
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kanban Board 模拟 */}
              <div className="flex-1 bg-[#0F172A] p-6 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                  {/* To Do Column */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-400 px-1">
                      <span>To Do</span>
                      <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-xs">3</span>
                    </div>
                    
                    {/* Card 1 */}
                    <div className="bg-[#1E293B] border border-white/5 rounded-lg p-4 shadow-sm hover:border-white/10 transition-colors cursor-pointer group">
                      <div className="flex gap-2 mb-3">
                        <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] font-medium border border-purple-500/20">Research</span>
                      </div>
                      <h4 className="text-sm font-medium text-slate-200 mb-4 group-hover:text-white transition-colors">
                        Analyze competitor pricing models for Q3
                      </h4>
                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400 border border-purple-500/20">C3</div>
                        <span className="text-[10px] text-slate-500">G4</span>
                      </div>
                    </div>

                    {/* Card 2 */}
                    <div className="bg-[#1E293B] border border-white/5 rounded-lg p-4 shadow-sm hover:border-white/10 transition-colors cursor-pointer group opacity-80">
                      <div className="flex gap-2 mb-3">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20">DevOps</span>
                      </div>
                      <h4 className="text-sm font-medium text-slate-200 mb-2 group-hover:text-white transition-colors">
                        Setup CI/CD pipeline for microservices
                      </h4>
                      <div className="flex items-center gap-2 text-slate-500 text-xs mt-3">
                         <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center">?</div>
                      </div>
                    </div>
                  </div>

                  {/* In Progress Column */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between text-sm font-medium text-blue-400 px-1">
                      <span>In Progress</span>
                      <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs border border-blue-500/20">1</span>
                    </div>

                    {/* Active Card */}
                    <div className="bg-[#1E293B] border border-[#0056ff]/30 rounded-lg p-4 shadow-lg shadow-blue-500/5 ring-1 ring-[#0056ff]/20">
                      <div className="flex gap-2 mb-3">
                        <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 text-[10px] font-medium border border-teal-500/20">Development</span>
                      </div>
                      <h4 className="text-sm font-medium text-white mb-2">
                        Refactor authentication middleware
                      </h4>
                      
                      {/* Progress Bar */}
                      <div className="mt-4 mb-2">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3 text-blue-400 animate-pulse" />
                            Writing tests...
                          </span>
                          <span>65%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-teal-400 w-[65%] rounded-full relative">
                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_1.5s_infinite]" />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                        <div className="flex -space-x-2">
                          <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400 border border-[#1E293B] ring-2 ring-[#1E293B]">C3</div>
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-[10px] text-green-400 border border-[#1E293B] ring-2 ring-[#1E293B]">G4</div>
                        </div>
                        <span className="text-[10px] text-slate-400">2m ago</span>
                      </div>
                    </div>
                  </div>

                  {/* Done Column */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-400 px-1">
                      <span>Done</span>
                      <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-xs">12</span>
                    </div>

                    {/* Done Card */}
                    <div className="bg-[#1E293B]/50 border border-white/5 rounded-lg p-4 opacity-60 hover:opacity-100 transition-opacity">
                      <h4 className="text-sm font-medium text-slate-400 line-through decoration-slate-600 mb-2">
                        Draft quarterly report outline
                      </h4>
                      <div className="flex justify-end mt-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500/50" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 装饰元素 - 底部反射光 */}
          <div className="absolute -bottom-10 left-10 right-10 h-20 bg-[#0056ff]/20 blur-[80px] rounded-full pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
