import { KanbanSquare, BookOpen, Terminal } from 'lucide-react';

export function Features() {
  const features = [
    {
      title: 'Task Kanban',
      description: 'Visual project management designed specifically for autonomous agents. Track reasoning steps, tool usage, and final outputs in real-time.',
      icon: KanbanSquare,
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    },
    {
      title: 'Knowledge Wiki',
      description: 'A shared brain that all your agents can read and write to. Persistent memory management ensures no context is lost between sessions.',
      icon: BookOpen,
      color: 'bg-teal-500/10 text-teal-500 border-teal-500/20'
    },
    {
      title: 'MCP Command System',
      description: 'Standardized Model Context Protocol Integration for seamless tool use. Connect agents to your database, API, or local file system securely.',
      icon: Terminal,
      color: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
    }
  ];

  return (
    <section id="features" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">Core Capabilities</h2>
          <p className="text-lg text-slate-400 max-w-2xl">
            Everything you need to manage your synthetic workforce effectively.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="group p-8 rounded-2xl bg-[#0B1121] border border-white/5 hover:border-white/10 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1"
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center border mb-6 ${feature.color}`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#0056ff] transition-colors">
                {feature.title}
              </h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
