'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const steps = [
  {
    number: '01',
    title: 'Register your clinic',
    description: 'Create your clinic profile and invite your staff. Each clinic gets its own isolated workspace with role-based permissions.',
  },
  {
    number: '02',
    title: 'Patients book online',
    description: 'Patients book through the portal. AI suggests the best available slots based on procedure type and dentist availability.',
  },
  {
    number: '03',
    title: 'Records stay encrypted',
    description: 'All patient data is encrypted client-side before it leaves the browser. Only the patient and authorized staff can decrypt it.',
  },
  {
    number: '04',
    title: 'Manage everything in one place',
    description: 'View appointments, billing, and audit logs across all your clinics from a single unified dashboard.',
  },
];

export default function HowItWorksSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="how-it-works" className="py-28 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-20"
        >
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-3">How It Works</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Up and running in minutes
          </h2>
        </motion.div>

        <div className="relative">
          {/* Connecting line — desktop */}
          <div className="hidden lg:block absolute top-8 left-[calc(12.5%+16px)] right-[calc(12.5%+16px)] h-px bg-slate-100" />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 lg:gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
                className="flex flex-col items-center text-center lg:items-center"
              >
                {/* Step number bubble */}
                <div className="relative z-10 w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/20">
                  <span className="text-white font-bold text-sm font-mono">{step.number}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-[200px]">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
