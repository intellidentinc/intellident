'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const clinics = [
  {
    name: 'Maria Laura Cruz Dental Clinic',
    location: 'Quezon City',
    initials: 'MLC',
    color: 'bg-blue-600',
    specialty: 'General Dentistry & Orthodontics',
  },
  {
    name: 'KH Dental Aesthetics',
    location: 'Makati City',
    initials: 'KH',
    color: 'bg-indigo-600',
    specialty: 'Cosmetic & Aesthetic Dentistry',
  },
  {
    name: 'Cabasal Dental Clinic',
    location: 'Pasig City',
    initials: 'CD',
    color: 'bg-violet-600',
    specialty: 'Oral Surgery & Periodontics',
  },
];

export default function ClinicsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="clinics" className="py-28 px-6 bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-3">Partner Clinics</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Trusted by our partner clinics
          </h2>
          <p className="mt-4 text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
            Three clinics across Metro Manila rely on Intellident to manage their patients and appointments.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {clinics.map((clinic, i) => (
            <motion.div
              key={clinic.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
              className="group bg-white rounded-2xl border border-slate-100 p-7 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-50/60 transition-all duration-300"
            >
              <div className={`w-12 h-12 ${clinic.color} rounded-xl flex items-center justify-center mb-5`}>
                <span className="text-white font-bold text-sm">{clinic.initials}</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-1 leading-snug">{clinic.name}</h3>
              <p className="text-xs text-blue-500 font-medium mb-3">{clinic.specialty}</p>
              <div className="flex items-center gap-1.5 text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="text-xs">{clinic.location}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
