'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

const AVATAR_COLORS = ['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-sky-600', 'bg-cyan-600'];

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function ClinicsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/clinics')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) setClinics(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setClinics([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
            Use <span className="font-medium text-slate-700">Find a clinic</span> in the menu to search by treatment or location.
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-7 animate-pulse">
                <div className="w-12 h-12 bg-slate-100 rounded-xl mb-5" />
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-3" />
                <div className="flex gap-2 mb-4">
                  <div className="h-5 bg-slate-100 rounded-full w-16" />
                  <div className="h-5 bg-slate-100 rounded-full w-20" />
                </div>
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {clinics.map((clinic, i) => {
              const extraServices = (clinic.services || []).length - 3;
              return (
                <motion.div
                  key={clinic.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
                  className="group bg-white rounded-2xl border border-slate-100 p-7 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-50/60 transition-all duration-300"
                >
                  <div
                    className={`w-12 h-12 ${AVATAR_COLORS[i % AVATAR_COLORS.length]} rounded-xl flex items-center justify-center mb-5 overflow-hidden`}
                  >
                    {clinic.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={clinic.logoUrl} alt={clinic.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-sm">{getInitials(clinic.name)}</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-3 leading-snug">{clinic.name}</h3>

                  {(clinic.services || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {clinic.services.slice(0, 3).map((svc) => (
                        <span key={svc} className="px-2 py-0.5 text-[11px] font-medium text-blue-600 bg-blue-50 rounded-md">
                          {svc}
                        </span>
                      ))}
                      {extraServices > 0 && (
                        <span className="px-2 py-0.5 text-[11px] font-medium text-slate-500 bg-slate-50 rounded-md">
                          +{extraServices}
                        </span>
                      )}
                    </div>
                  )}

                  {clinic.city && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      <span className="text-xs">{clinic.city}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
