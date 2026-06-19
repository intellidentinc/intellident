'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1], delay },
});

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-20 overflow-hidden bg-[#F8FAFC]">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Blue glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Badge */}
        <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold tracking-wide uppercase mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          AI-Powered Dental Care
        </motion.div>

        {/* Headline */}
        <motion.h1 {...fadeUp(0.1)} className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.08] tracking-tight mb-6">
          Smarter scheduling
          <br />
          <span className="text-blue-600">for dental clinics.</span>
        </motion.h1>

        {/* Sub */}
        <motion.p {...fadeUp(0.2)} className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Intellident combines AI-assisted appointment scheduling, end-to-end encrypted patient records, and multi-clinic management — built for the modern dental practice.
        </motion.p>

        {/* CTAs */}
        <motion.div {...fadeUp(0.3)} className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/sign-up"
            className="px-7 py-3.5 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Get Started — it&apos;s free
          </Link>
          <Link
            href="/sign-in"
            className="px-7 py-3.5 bg-white text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-all duration-200 border border-slate-200 shadow-sm"
          >
            Sign In
          </Link>
        </motion.div>

        {/* Social proof line */}
        <motion.p {...fadeUp(0.4)} className="mt-8 text-xs text-slate-400">
          Serving{' '}
          <span className="text-slate-600 font-medium">3 dental clinics</span>{' '}
          across Metro Manila
        </motion.p>
      </div>

      {/* Hero visual — floating card mockup */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
        className="relative z-10 mt-20 w-full max-w-3xl mx-auto"
      >
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 overflow-hidden">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="w-3 h-3 rounded-full bg-red-300" />
            <div className="w-3 h-3 rounded-full bg-yellow-300" />
            <div className="w-3 h-3 rounded-full bg-green-300" />
            <div className="flex-1 mx-3 h-6 rounded-md bg-slate-200/70 flex items-center px-3">
              <span className="text-[10px] text-slate-400 font-mono">intellident-ai.org/dashboard</span>
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="p-6 bg-[#F8FAFC]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="h-3 w-32 bg-slate-200 rounded-full mb-1.5" />
                <div className="h-2 w-20 bg-slate-100 rounded-full" />
              </div>
              <div className="h-8 w-24 bg-blue-600 rounded-lg" />
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Today', value: '12', color: 'bg-blue-50 border-blue-100' },
                { label: 'This Week', value: '47', color: 'bg-slate-50 border-slate-100' },
                { label: 'Pending', value: '5', color: 'bg-slate-50 border-slate-100' },
              ].map((stat) => (
                <div key={stat.label} className={`${stat.color} border rounded-xl p-3.5`}>
                  <div className="text-[10px] text-slate-400 mb-1">{stat.label}</div>
                  <div className="text-xl font-bold text-slate-700">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {[
                { time: '09:00', name: 'Maria Santos', type: 'Check-up', status: 'confirmed' },
                { time: '10:30', name: 'Juan Dela Cruz', type: 'Cleaning', status: 'confirmed' },
                { time: '11:00', name: 'Ana Reyes', type: 'Braces Adjust', status: 'pending' },
                { time: '02:00', name: 'Carlo Bautista', type: 'Extraction', status: 'confirmed' },
              ].map((appt) => (
                <div key={appt.time} className="flex items-center gap-3 bg-white rounded-lg px-3.5 py-2.5 border border-slate-100">
                  <span className="text-[10px] font-mono text-slate-400 w-10">{appt.time}</span>
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-700">{appt.name}</div>
                    <div className="text-[10px] text-slate-400">{appt.type}</div>
                  </div>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    appt.status === 'confirmed'
                      ? 'bg-green-50 text-green-600'
                      : 'bg-yellow-50 text-yellow-600'
                  }`}>
                    {appt.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
