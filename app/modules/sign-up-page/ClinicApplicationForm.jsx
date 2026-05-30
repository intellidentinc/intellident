'use client'

import { Fragment, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Divider from '@mui/material/Divider'
import { Check } from 'lucide-react'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import AddressSelector, { EMPTY_ADDRESS, assembleAddress } from '@/components/commons/AddressSelector'
import FileUploadZone from './FileUploadZone'
import { useToast } from '@/app/providers/ToastProvider'

const PHONE_RE = /^\+63\d{10}$/

function SectionLabel({ children }) {
  return (
    <Typography
      variant="caption"
      fontWeight={700}
      sx={{ color: 'text.secondary', letterSpacing: '0.08em', textTransform: 'uppercase' }}
    >
      {children}
    </Typography>
  )
}

function PhoneInput({ id, label, value, onChange, error, helperText, required }) {
  function handleChange(e) {
    let v = e.target.value
    if (!v.startsWith('+63')) v = '+63'
    if (v.length > 13) v = v.slice(0, 13)
    onChange(v)
  }
  return (
    <Input
      id={id}
      label={label}
      value={value}
      onChange={handleChange}
      placeholder="+63XXXXXXXXXX"
      error={error}
      helperText={helperText}
      required={required}
      inputProps={{ maxLength: 13 }}
    />
  )
}

function StepIndicator({ current }) {
  const steps = ['Clinic Details', 'Documents']
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', mb: 4 }}>
      {steps.map((label, i) => {
        const s    = i + 1
        const done = current > s
        const active = current === s
        return (
          <Fragment key={s}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, minWidth: 90 }}>
              <Box sx={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: done || active ? 'primary.main' : '#e2e8f0',
                color: done || active ? '#fff' : '#94a3b8',
                fontWeight: 700, fontSize: 14,
                transition: 'background-color 0.2s',
              }}>
                {done ? <Check size={16} /> : s}
              </Box>
              <Typography variant="caption" fontWeight={active ? 700 : 400}
                color={active ? 'primary' : done ? 'text.secondary' : 'text.disabled'}>
                {label}
              </Typography>
            </Box>
            {i < steps.length - 1 && (
              <Box sx={{ flex: 1, height: 2, mt: 2.25, mx: 1, bgcolor: current > 1 ? 'primary.main' : '#e2e8f0', transition: 'background-color 0.2s' }} />
            )}
          </Fragment>
        )
      })}
    </Box>
  )
}

async function uploadFile(file, category) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('category', category)
  const res = await fetch('/api/clinic-applications/documents', { method: 'POST', body: fd })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error || `Failed to upload ${file.name}`)
  }
  const { url } = await res.json()
  return url
}

export default function ClinicApplicationForm() {
  const { showToast } = useToast()

  const [step, setStep] = useState(1)

  // Step 1 — clinic info
  const [clinicName,      setClinicName]      = useState('')
  const [businessAddress, setBusinessAddress] = useState({ ...EMPTY_ADDRESS })
  const [businessPhone,   setBusinessPhone]   = useState('+63')
  const [businessEmail,   setBusinessEmail]   = useState('')

  // Step 1 — contact person
  const [contactFirstName,   setContactFirstName]   = useState('')
  const [contactMiddleName,  setContactMiddleName]  = useState('')
  const [contactLastName,    setContactLastName]    = useState('')
  const [contactSuffix,      setContactSuffix]      = useState('')
  const [contactPersonPhone, setContactPersonPhone] = useState('+63')
  const [contactPersonEmail, setContactPersonEmail] = useState('')
  const [message,            setMessage]            = useState('')

  // Step 2 — documents
  const [birFiles, setBirFiles] = useState([])
  const [idFiles,  setIdFiles]  = useState([])

  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors,    setErrors]    = useState({})

  function validateStep1() {
    const e = {}
    if (!clinicName.trim())         e.clinicName         = 'Clinic name is required'
    if (!assembleAddress(businessAddress)) e.businessAddress = 'Business address is required'
    if (!businessPhone || !PHONE_RE.test(businessPhone))
      e.businessPhone = 'Enter a valid Philippine phone number (+63XXXXXXXXXX)'
    if (!businessEmail.trim())       e.businessEmail       = 'Business email is required'
    if (!contactFirstName.trim())    e.contactFirstName    = 'First name is required'
    if (!contactLastName.trim())     e.contactLastName     = 'Last name is required'
    if (!contactPersonPhone || !PHONE_RE.test(contactPersonPhone))
      e.contactPersonPhone = 'Enter a valid Philippine phone number (+63XXXXXXXXXX)'
    if (!contactPersonEmail.trim())  e.contactPersonEmail  = 'Contact email is required'
    if (message.length > 500)        e.message             = 'Message must be 500 characters or fewer'
    return e
  }

  function validateStep2() {
    const e = {}
    if (birFiles.length === 0) e.birFiles = 'Please upload at least one BIR document'
    if (idFiles.length  === 0) e.idFiles  = 'Please upload at least one valid ID'
    return e
  }

  function handleNext() {
    const errs = validateStep1()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    const errs = validateStep2()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const [birUrls, idUrls] = await Promise.all([
        Promise.all(birFiles.map(f => uploadFile(f, 'bir'))),
        Promise.all(idFiles.map(f => uploadFile(f, 'id'))),
      ])

      const contactPersonName = [contactFirstName, contactMiddleName, contactLastName, contactSuffix]
        .map(s => s.trim()).filter(Boolean).join(' ')

      const res = await fetch('/api/clinic-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName: clinicName.trim(),
          businessAddress: assembleAddress(businessAddress),
          businessPhone,
          businessEmail: businessEmail.trim(),
          contactPersonName,
          contactPersonPhone,
          contactPersonEmail: contactPersonEmail.trim(),
          message: message.trim() || null,
          birDocuments: birUrls,
          applicantIds:  idUrls,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Submission failed')
      }
      setSubmitted(true)
    } catch (err) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 4, textAlign: 'center' }}>
        <Box sx={{ fontSize: 48, mb: 2 }}>🏥</Box>
        <Typography variant="h6" fontWeight={700} color="primary.main" gutterBottom>
          Application Submitted!
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          We&apos;ve received your application for <strong>{clinicName}</strong>. Our team will
          review it and contact you at <strong>{businessEmail}</strong> within a few business days.
        </Typography>
      </Paper>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <StepIndicator current={step} />

      {/* ── Step 1: Clinic Details ── */}
      {step === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          <Box>
            <SectionLabel>Clinic Information</SectionLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Input
                id="clinicName"
                label="Clinic Name"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="e.g. Sunrise Dental Clinic"
                error={!!errors.clinicName}
                helperText={errors.clinicName}
                required
              />
              <Box>
                <AddressSelector value={businessAddress} onChange={setBusinessAddress} />
                {errors.businessAddress && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    {errors.businessAddress}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <PhoneInput
                  id="businessPhone"
                  label="Business Phone"
                  value={businessPhone}
                  onChange={setBusinessPhone}
                  error={!!errors.businessPhone}
                  helperText={errors.businessPhone}
                  required
                />
                <Input
                  id="businessEmail"
                  label="Business Email"
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  placeholder="clinic@example.com"
                  error={!!errors.businessEmail}
                  helperText={errors.businessEmail}
                  required
                />
              </Box>
            </Box>
          </Box>

          <Divider />

          <Box>
            <SectionLabel>Contact Person</SectionLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                <Input
                  id="contactFirstName"
                  label="First Name"
                  value={contactFirstName}
                  onChange={(e) => setContactFirstName(e.target.value)}
                  placeholder="Juan"
                  error={!!errors.contactFirstName}
                  helperText={errors.contactFirstName}
                  required
                />
                <Input
                  id="contactMiddleName"
                  label="Middle Name"
                  value={contactMiddleName}
                  onChange={(e) => setContactMiddleName(e.target.value)}
                  placeholder="Santos (optional)"
                />
                <Input
                  id="contactLastName"
                  label="Last Name"
                  value={contactLastName}
                  onChange={(e) => setContactLastName(e.target.value)}
                  placeholder="Cruz"
                  error={!!errors.contactLastName}
                  helperText={errors.contactLastName}
                  required
                />
              </Box>
              <Box sx={{ maxWidth: 160 }}>
                <Input
                  id="contactSuffix"
                  label="Suffix"
                  value={contactSuffix}
                  onChange={(e) => setContactSuffix(e.target.value)}
                  placeholder="Jr., Sr., III (optional)"
                />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <PhoneInput
                  id="contactPersonPhone"
                  label="Contact Phone"
                  value={contactPersonPhone}
                  onChange={setContactPersonPhone}
                  error={!!errors.contactPersonPhone}
                  helperText={errors.contactPersonPhone}
                  required
                />
                <Input
                  id="contactPersonEmail"
                  label="Contact Email"
                  type="email"
                  value={contactPersonEmail}
                  onChange={(e) => setContactPersonEmail(e.target.value)}
                  placeholder="you@example.com"
                  error={!!errors.contactPersonEmail}
                  helperText={errors.contactPersonEmail}
                  required
                />
              </Box>
            </Box>
          </Box>

          <Divider />

          <Box>
            <SectionLabel>Additional Information</SectionLabel>
            <Box sx={{ mt: 1 }}>
              <Input
                id="message"
                label="Brief Description (optional)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us a bit about your clinic..."
                multiline
                rows={4}
                error={!!errors.message}
                helperText={errors.message}
              />
              <Typography
                variant="caption"
                color={message.length > 500 ? 'error' : 'text.secondary'}
                sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}
              >
                {message.length}/500
              </Typography>
            </Box>
          </Box>

          <Button variant="contained" onClick={handleNext} fullWidth sx={{ mt: 1, py: 1.5, fontWeight: 600 }}>
            Next
          </Button>
        </Box>
      )}

      {/* ── Step 2: Documents ── */}
      {step === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          <Box sx={{ p: 2, bgcolor: '#eff6ff', borderRadius: 2, border: '1px solid #bfdbfe' }}>
            <Typography variant="body2" color="primary.dark" sx={{ lineHeight: 1.7 }}>
              Upload clear, readable copies of the documents below. Accepted formats: <strong>PDF, JPG, PNG</strong> — max <strong>5 MB</strong> per file.
            </Typography>
          </Box>

          <Box>
            <SectionLabel>BIR Registration</SectionLabel>
            <Box sx={{ mt: 1.5 }}>
              <FileUploadZone
                label="BIR Documents"
                hint="Upload your BIR Certificate of Registration (Form 2303) or other BIR registration documents."
                files={birFiles}
                onAdd={(f) => setBirFiles(prev => [...prev, ...f])}
                onRemove={(i) => setBirFiles(prev => prev.filter((_, idx) => idx !== i))}
                error={errors.birFiles}
                required
                maxFiles={5}
              />
            </Box>
          </Box>

          <Box>
            <SectionLabel>Owner / Applicant ID</SectionLabel>
            <Box sx={{ mt: 1.5 }}>
              <FileUploadZone
                label="Government-Issued ID"
                hint="Upload at least one valid government-issued ID (Driver's License, Passport, SSS, PhilHealth, UMID, etc.)."
                files={idFiles}
                onAdd={(f) => setIdFiles(prev => [...prev, ...f])}
                onRemove={(i) => setIdFiles(prev => prev.filter((_, idx) => idx !== i))}
                error={errors.idFiles}
                required
                maxFiles={5}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 2, mt: 1 }}>
            <Button
              variant="outlined"
              onClick={() => { setStep(1); setErrors({}) }}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              variant="contained"
              loading={loading}
              onClick={handleSubmit}
              sx={{ py: 1.5, fontWeight: 600 }}
            >
              Submit Application
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  )
}
