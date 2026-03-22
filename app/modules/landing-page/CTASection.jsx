'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export default function CTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section className="py-28 px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl bg-blue-600 px-10 py-16 text-center overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-white" />
          </div>

          <div className="relative z-10">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-4">Get Started Today</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
              Ready to modernize
              <br />your dental practice?
            </h2>
            <p className="text-blue-100 text-sm leading-relaxed max-w-md mx-auto mb-8">
              Join the clinics already using Intellident to reduce no-shows, secure patient data, and simplify operations.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/sign-up"
                className="px-7 py-3.5 bg-white text-blue-600 font-semibold rounded-xl text-sm hover:bg-blue-50 transition-colors duration-200 shadow-lg"
              >
                Create an account
              </Link>
              <Link
                href="/sign-in"
                className="px-7 py-3.5 bg-blue-500/30 text-white font-semibold rounded-xl text-sm hover:bg-blue-500/50 transition-colors duration-200 border border-blue-400/40"
              >
                Sign In
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
