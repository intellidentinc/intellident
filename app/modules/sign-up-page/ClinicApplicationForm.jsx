'use client'

import { Fragment, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Divider from '@mui/material/Divider'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import { Check, Plus, Trash2 } from 'lucide-react'
import Button from '@/components/commons/Button'
import Input from '@/components/commons/Input'
import AddressSelector, { EMPTY_ADDRESS, assembleAddress } from '@/components/commons/AddressSelector'
import FileUploadZone from './FileUploadZone'
import TermsDialog from './TermsDialog'
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
  const steps = ['Clinic Details', 'Services', 'Documents']
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
              <Box sx={{ flex: 1, height: 2, mt: 2.25, mx: 1, bgcolor: current > i + 1 ? 'primary.main' : '#e2e8f0', transition: 'background-color 0.2s' }} />
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

  // Step 2 — services
  const EMPTY_SERVICE = { name: '', duration: '', price: '', description: '' }
  const [services, setServices] = useState([{ ...EMPTY_SERVICE }])

  function updateService(i, field, value) {
    setServices(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }
  function addService() {
    setServices(prev => [...prev, { ...EMPTY_SERVICE }])
  }
  function removeService(i) {
    setServices(prev => prev.filter((_, idx) => idx !== i))
  }

  // Step 3 — documents
  const [birFiles,           setBirFiles]           = useState([])
  const [businessPermitFiles, setBusinessPermitFiles] = useState([])
  const [dtiSecFiles,        setDtiSecFiles]        = useState([])
  const [idFiles,            setIdFiles]            = useState([])
  const [prcLicenseFiles,    setPrcLicenseFiles]    = useState([])

  const [loading,         setLoading]         = useState(false)
  const [submitted,       setSubmitted]       = useState(false)
  const [errors,          setErrors]          = useState({})
  const [termsAccepted,   setTermsAccepted]   = useState(false)
  const [termsAcceptedAt, setTermsAcceptedAt] = useState(null)
  const [termsDialogOpen, setTermsDialogOpen] = useState(false)

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
    const rowErrors = services.map(s => {
      const re = {}
      if (!s.name.trim()) re.name = 'Service name is required'
      const dur = parseInt(s.duration, 10)
      if (!s.duration || isNaN(dur) || dur < 15 || dur > 480)
        re.duration = '15–480 min'
      return re
    })
    if (services.length === 0) e.services = 'Add at least one service'
    if (rowErrors.some(re => Object.keys(re).length > 0)) e.serviceRows = rowErrors
    return e
  }

  function validateStep3() {
    const e = {}
    if (birFiles.length === 0)            e.birFiles            = 'Please upload your BIR Certificate of Registration (Form 2303)'
    if (businessPermitFiles.length === 0) e.businessPermitFiles = 'Please upload your Business Permit'
    if (dtiSecFiles.length === 0)         e.dtiSecFiles         = 'Please upload your DTI or SEC Registration Certificate'
    if (idFiles.length === 0)             e.idFiles             = 'Please upload at least one valid government-issued ID'
    if (prcLicenseFiles.length === 0)     e.prcLicenseFiles     = 'Please upload the PRC License of your dentist'
    if (!termsAccepted)                   e.terms               = 'You must accept the Terms of Service and Data Privacy Policy to continue.'
    return e
  }

  function handleNext() {
    if (step === 1) {
      const errs = validateStep1()
      if (Object.keys(errs).length) { setErrors(errs); return }
    } else if (step === 2) {
      const errs = validateStep2()
      if (Object.keys(errs).length) { setErrors(errs); return }
    }
    setErrors({})
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    const errs = validateStep3()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const [birUrls, businessPermitUrls, dtiSecUrls, idUrls, prcLicenseUrls] = await Promise.all([
        Promise.all(birFiles.map(f => uploadFile(f, 'bir'))),
        Promise.all(businessPermitFiles.map(f => uploadFile(f, 'business_permit'))),
        Promise.all(dtiSecFiles.map(f => uploadFile(f, 'dti_sec'))),
        Promise.all(idFiles.map(f => uploadFile(f, 'id'))),
        Promise.all(prcLicenseFiles.map(f => uploadFile(f, 'prc_license'))),
      ])

      const contactPersonName = [contactFirstName, contactMiddleName, contactLastName, contactSuffix]
        .map(s => s.trim()).filter(Boolean).join(' ')

      const proposedServices = services.map(s => ({
        name: s.name.trim(),
        duration: parseInt(s.duration, 10),
        ...(s.price !== '' && !isNaN(parseFloat(s.price)) && { price: parseFloat(s.price) }),
        ...(s.description.trim() && { description: s.description.trim() }),
      }))

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
          proposedServices,
          birDocuments:      birUrls,
          businessPermitDocs: businessPermitUrls,
          dtiSecDocs:        dtiSecUrls,
          applicantIds:      idUrls,
          prcLicenseDocs:    prcLicenseUrls,
          termsAcceptedAt,
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
                  inputProps={{ maxLength: 100 }}
                  required
                />
                <Input
                  id="contactMiddleName"
                  label="Middle Name"
                  value={contactMiddleName}
                  onChange={(e) => setContactMiddleName(e.target.value)}
                  placeholder="Santos (optional)"
                  inputProps={{ maxLength: 100 }}
                />
                <Input
                  id="contactLastName"
                  label="Last Name"
                  value={contactLastName}
                  onChange={(e) => setContactLastName(e.target.value)}
                  placeholder="Cruz"
                  error={!!errors.contactLastName}
                  helperText={errors.contactLastName}
                  inputProps={{ maxLength: 100 }}
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
                  inputProps={{ maxLength: 20 }}
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

      {/* ── Step 2: Services ── */}
      {step === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          <Box sx={{ p: 2, bgcolor: '#eff6ff', borderRadius: 2, border: '1px solid #bfdbfe' }}>
            <Typography variant="body2" color="primary.dark" sx={{ lineHeight: 1.7 }}>
              List the dental services your clinic will offer. You can adjust these after approval.
            </Typography>
          </Box>

          {errors.services && (
            <Typography variant="caption" color="error">{errors.services}</Typography>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {services.map((svc, i) => (
              <Box key={i} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: '#fafbfc', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Service {i + 1}
                  </Typography>
                  {services.length > 1 && (
                    <Box
                      component="button"
                      type="button"
                      onClick={() => { removeService(i); setErrors(prev => ({ ...prev, serviceRows: undefined, services: undefined })) }}
                      sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', p: 0.5, borderRadius: 1, '&:hover': { color: '#E05C6A', bgcolor: '#fff5f5' } }}
                    >
                      <Trash2 size={15} />
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 2 }}>
                  <Input
                    id={`svc-name-${i}`}
                    label="Service Name"
                    value={svc.name}
                    onChange={(e) => { updateService(i, 'name', e.target.value); setErrors(prev => ({ ...prev, serviceRows: undefined })) }}
                    placeholder="e.g. Tooth Extraction"
                    error={!!errors.serviceRows?.[i]?.name}
                    helperText={errors.serviceRows?.[i]?.name}
                    inputProps={{ maxLength: 200 }}
                    required
                  />
                  <Input
                    id={`svc-dur-${i}`}
                    label="Duration (min)"
                    type="number"
                    value={svc.duration}
                    onChange={(e) => { updateService(i, 'duration', e.target.value); setErrors(prev => ({ ...prev, serviceRows: undefined })) }}
                    placeholder="30"
                    error={!!errors.serviceRows?.[i]?.duration}
                    helperText={errors.serviceRows?.[i]?.duration}
                    inputProps={{ min: 15, max: 480, step: 1 }}
                    required
                  />
                  <Input
                    id={`svc-price-${i}`}
                    label="Price (₱, optional)"
                    type="number"
                    value={svc.price}
                    onChange={(e) => updateService(i, 'price', e.target.value)}
                    placeholder="500"
                    inputProps={{ min: 0 }}
                  />
                </Box>
                <Input
                  id={`svc-desc-${i}`}
                  label="Description (optional)"
                  value={svc.description}
                  onChange={(e) => updateService(i, 'description', e.target.value)}
                  placeholder="Brief description of the service..."
                  inputProps={{ maxLength: 500 }}
                />
              </Box>
            ))}
          </Box>

          {services.length < 50 && (
            <Box
              component="button"
              type="button"
              onClick={addService}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
                border: '1.5px dashed #bfdbfe', bgcolor: 'transparent', borderRadius: 2,
                color: '#2563eb', fontWeight: 600, fontSize: '0.85rem', py: 1.5, cursor: 'pointer',
                '&:hover': { bgcolor: '#eff6ff' }, transition: 'background 0.15s',
              }}
            >
              <Plus size={16} />
              Add Another Service
            </Box>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 2 }}>
            <Button variant="outlined" onClick={() => { setStep(1); setErrors({}) }}>
              Back
            </Button>
            <Button variant="contained" onClick={handleNext} sx={{ py: 1.5, fontWeight: 600 }}>
              Next
            </Button>
          </Box>
        </Box>
      )}

      {/* ── Step 3: Documents ── */}
      {step === 3 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          <Box sx={{ p: 2, bgcolor: '#eff6ff', borderRadius: 2, border: '1px solid #bfdbfe' }}>
            <Typography variant="body2" color="primary.dark" sx={{ lineHeight: 1.7 }}>
              Upload clear, readable copies of the documents below. Accepted formats: <strong>PDF, JPG, PNG</strong> — max <strong>5 MB</strong> per file.
            </Typography>
          </Box>

          <Box>
            <SectionLabel>Business Registration Documents</SectionLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5 }}>
              <FileUploadZone
                label="BIR Certificate of Registration"
                hint="Upload BIR Form 2303 (Certificate of Registration) issued by the Bureau of Internal Revenue."
                files={birFiles}
                onAdd={(f) => setBirFiles(prev => [...prev, ...f])}
                onRemove={(i) => setBirFiles(prev => prev.filter((_, idx) => idx !== i))}
                error={errors.birFiles}
                required
                maxFiles={5}
              />
              <FileUploadZone
                label="Business Permit"
                hint="Upload your current Mayor's Permit / Business Permit issued by your Local Government Unit (LGU)."
                files={businessPermitFiles}
                onAdd={(f) => setBusinessPermitFiles(prev => [...prev, ...f])}
                onRemove={(i) => setBusinessPermitFiles(prev => prev.filter((_, idx) => idx !== i))}
                error={errors.businessPermitFiles}
                required
                maxFiles={5}
              />
              <FileUploadZone
                label="DTI or SEC Registration"
                hint="Upload your DTI Certificate of Registration (sole proprietor) or SEC Certificate of Incorporation (corporation/partnership)."
                files={dtiSecFiles}
                onAdd={(f) => setDtiSecFiles(prev => [...prev, ...f])}
                onRemove={(i) => setDtiSecFiles(prev => prev.filter((_, idx) => idx !== i))}
                error={errors.dtiSecFiles}
                required
                maxFiles={5}
              />
            </Box>
          </Box>

          <Box>
            <SectionLabel>Owner &amp; Professional Credentials</SectionLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5 }}>
              <FileUploadZone
                label="Government-Issued ID"
                hint="Upload a valid government-issued ID of the owner or authorized representative (Driver's License, Passport, SSS, PhilHealth, UMID, etc.)."
                files={idFiles}
                onAdd={(f) => setIdFiles(prev => [...prev, ...f])}
                onRemove={(i) => setIdFiles(prev => prev.filter((_, idx) => idx !== i))}
                error={errors.idFiles}
                required
                maxFiles={5}
              />
              <FileUploadZone
                label="PRC License"
                hint="Upload the PRC ID or Certificate of Registration of the clinic's licensed dentist to verify their professional credentials."
                files={prcLicenseFiles}
                onAdd={(f) => setPrcLicenseFiles(prev => [...prev, ...f])}
                onRemove={(i) => setPrcLicenseFiles(prev => prev.filter((_, idx) => idx !== i))}
                error={errors.prcLicenseFiles}
                required
                maxFiles={5}
              />
            </Box>
          </Box>

          {/* ── Terms & Data Privacy Consent ── */}
          <Box sx={{
            p: 2.5,
            border: '1px solid',
            borderColor: termsAccepted ? 'primary.main' : errors.terms ? 'error.main' : 'divider',
            borderRadius: 2,
            bgcolor: termsAccepted ? '#dbeafe' : errors.terms ? '#fff5f5' : 'background.paper',
            transition: 'all 0.15s',
          }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={termsAccepted}
                  onChange={(e) => { setTermsAccepted(e.target.checked); setTermsAcceptedAt(e.target.checked ? new Date().toISOString() : null); if (e.target.checked) setErrors(prev => ({ ...prev, terms: undefined })) }}
                  size="small"
                  sx={{ color: errors.terms ? 'error.main' : 'text.secondary', '&.Mui-checked': { color: 'primary.main' }, mt: '-2px', alignSelf: 'flex-start' }}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  I have read and agree to the{' '}
                  <Box
                    component="span"
                    onClick={(e) => { e.preventDefault(); setTermsDialogOpen(true) }}
                    sx={{ color: 'primary.main', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Terms of Service &amp; Data Privacy Policy
                  </Box>
                  , including the collection and processing of clinic and personal information in
                  accordance with the{' '}
                  <strong>Philippine Data Privacy Act of 2012 (RA 10173)</strong>,{' '}
                  <strong>ISO/IEC 27001</strong> security standards, and the{' '}
                  <strong>NIST Cybersecurity Framework</strong>.
                </Typography>
              }
              sx={{ alignItems: 'flex-start', mx: 0 }}
            />
            {errors.terms && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, ml: 4 }}>
                {errors.terms}
              </Typography>
            )}
          </Box>

          <TermsDialog open={termsDialogOpen} onClose={() => setTermsDialogOpen(false)} />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => { setStep(2); setErrors({}) }}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              variant="contained"
              loading={loading}
              onClick={handleSubmit}
              disabled={!termsAccepted}
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
