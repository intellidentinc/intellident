'use client'

import { useState, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import FormHelperText from '@mui/material/FormHelperText'
import Input from '@/components/commons/Input'

const BASE = 'https://psgc.cloud/api'
const NCR_CODE = '1300000000'

// Natural sort order for congressional district labels
const DISTRICT_ORDER = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

export const EMPTY_ADDRESS = {
  unit: '',
  street: '',
  region: null,      // { name, code }
  province: null,    // { name, code } | null (null for NCR)
  district: null,    // string e.g. "1st" | null (optional filter)
  cityMuni: null,    // { name, code, type, zip_code, district }
  barangay: null,    // { name, code }
  postal: '',
}

export function assembleAddress(addr) {
  const location = addr.province?.name
    ?? (addr.region?.code === NCR_CODE ? 'Metro Manila' : addr.region?.name)
    ?? ''
  return [
    addr.unit,
    addr.street,
    addr.barangay ? `Brgy. ${addr.barangay.name}` : '',
    addr.cityMuni?.name ?? '',
    location,
    addr.postal,
  ]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(', ')
}

function DropdownLabel({ children, required }) {
  return (
    <Typography
      component='label'
      variant='body2'
      fontWeight={500}
      sx={{ color: 'text.primary', userSelect: 'none' }}
    >
      {children}
      {required && (
        <Typography component='span' sx={{ color: '#E05C6A', ml: 0.25 }}>
          *
        </Typography>
      )}
    </Typography>
  )
}

function DropdownField({ label, required, error, helperText, children }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <DropdownLabel required={required}>{label}</DropdownLabel>
      {children}
      {helperText && (
        <FormHelperText error={error} sx={{ mx: 0, mt: 0 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  )
}

function fixEncoding(str) {
  // PSGC API returns mojibake for ñ (UTF-8 bytes decoded as Latin-1).
  try {
    const bytes = new Uint8Array([...str].map((c) => c.charCodeAt(0)))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return str
  }
}

function fixNames(items) {
  return items.map((item) => ({ ...item, name: fixEncoding(item.name.trim()) }))
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export default function AddressSelector({ value = EMPTY_ADDRESS, onChange, errors = {}, required = false }) {
  const [regions, setRegions] = useState([])
  const [provinces, setProvinces] = useState([])
  const [allCitiesMunis, setAllCitiesMunis] = useState([])
  const [barangays, setBarangays] = useState([])

  const [loadingRegions, setLoadingRegions] = useState(true)
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingBarangays, setLoadingBarangays] = useState(false)

  const isNCR = value.region?.code === NCR_CODE

  // Derive unique, ordered district options from loaded cities/munis (skip "Lone")
  const districtOptions = useMemo(() => {
    const raw = [...new Set(allCitiesMunis.map((c) => c.district).filter((d) => d && d !== 'Lone'))]
    return raw.sort((a, b) => {
      const ai = DISTRICT_ORDER.indexOf(a)
      const bi = DISTRICT_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
  }, [allCitiesMunis])

  // Show District dropdown only when province has 2+ distinct numbered districts
  const showDistrict = districtOptions.length >= 2

  // Apply district filter to city/municipality list
  const citiesMunis = useMemo(() => {
    if (!value.district) return allCitiesMunis
    return allCitiesMunis.filter((c) => c.district === value.district)
  }, [allCitiesMunis, value.district])

  // Load all regions on mount
  useEffect(() => {
    fetchJson(`${BASE}/regions`)
      .then((data) => setRegions(fixNames([...data]).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setLoadingRegions(false))
  }, [])

  // Load provinces when region changes (skip for NCR)
  useEffect(() => {
    if (!value.region || isNCR) { setProvinces([]); return }
    setLoadingProvinces(true)
    fetchJson(`${BASE}/regions/${value.region.code}/provinces`)
      .then((data) => setProvinces(fixNames([...data]).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setProvinces([]))
      .finally(() => setLoadingProvinces(false))
  }, [value.region?.code, isNCR]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load cities/munis when province changes (or immediately for NCR)
  useEffect(() => {
    if (isNCR && value.region) {
      setLoadingCities(true)
      Promise.all([
        fetchJson(`${BASE}/regions/${NCR_CODE}/cities`),
        fetchJson(`${BASE}/regions/${NCR_CODE}/municipalities`),
      ])
        .then(([cities, munis]) =>
          setAllCitiesMunis(fixNames([...cities, ...munis]).sort((a, b) => a.name.localeCompare(b.name)))
        )
        .catch(() => setAllCitiesMunis([]))
        .finally(() => setLoadingCities(false))
      return
    }
    if (!value.province) { setAllCitiesMunis([]); return }
    setLoadingCities(true)
    Promise.all([
      fetchJson(`${BASE}/provinces/${value.province.code}/cities`),
      fetchJson(`${BASE}/provinces/${value.province.code}/municipalities`),
    ])
      .then(([cities, munis]) =>
        setAllCitiesMunis(fixNames([...cities, ...munis]).sort((a, b) => a.name.localeCompare(b.name)))
      )
      .catch(() => setAllCitiesMunis([]))
      .finally(() => setLoadingCities(false))
  }, [value.province?.code, isNCR, value.region?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load barangays when city/municipality changes
  useEffect(() => {
    if (!value.cityMuni) { setBarangays([]); return }
    setLoadingBarangays(true)
    const type = value.cityMuni.type === 'Mun' ? 'municipalities' : 'cities'
    fetchJson(`${BASE}/${type}/${value.cityMuni.code}/barangays`)
      .then((data) => setBarangays(fixNames([...data]).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setBarangays([]))
      .finally(() => setLoadingBarangays(false))
  }, [value.cityMuni?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  function update(patch) {
    onChange({ ...value, ...patch })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Region */}
      <DropdownField label='Region'>
        <Autocomplete
          options={regions}
          getOptionLabel={(o) => o.name}
          isOptionEqualToValue={(a, b) => a.code === b.code}
          value={value.region}
          loading={loadingRegions}
          onChange={(_, region) =>
            update({ region, province: null, district: null, cityMuni: null, barangay: null, postal: '' })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              size='small'
              placeholder='Select region'
              InputProps={{ ...params.InputProps }}
            />
          )}
        />
      </DropdownField>

      {/* Province — hidden for NCR */}
      {!isNCR && (
        <DropdownField label='Province'>
          <Autocomplete
            options={provinces}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(a, b) => a.code === b.code}
            value={value.province}
            loading={loadingProvinces}
            disabled={!value.region}
            onChange={(_, province) =>
              update({ province, district: null, cityMuni: null, barangay: null, postal: '' })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                size='small'
                placeholder={value.region ? 'Select province' : 'Select region first'}
                InputProps={{ ...params.InputProps }}
              />
            )}
          />
        </DropdownField>
      )}

      {/* District — shown only when province has 2+ numbered districts */}
      {showDistrict && (
        <DropdownField label='District'>
          <Autocomplete
            options={districtOptions}
            getOptionLabel={(o) => `${o} District`}
            value={value.district}
            onChange={(_, district) =>
              update({ district, cityMuni: null, barangay: null, postal: '' })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                size='small'
                placeholder='Filter by district (optional)'
                InputProps={{ ...params.InputProps }}
              />
            )}
          />
        </DropdownField>
      )}

      {/* City / Municipality */}
      <DropdownField
        label='City / Municipality'
        required={required}
        error={!!errors.cityMuni}
        helperText={errors.cityMuni}
      >
        <Autocomplete
          options={citiesMunis}
          getOptionLabel={(o) => o.name}
          isOptionEqualToValue={(a, b) => a.code === b.code}
          value={value.cityMuni}
          loading={loadingCities}
          disabled={isNCR ? !value.region : !value.province}
          onChange={(_, cityMuni) =>
            update({
              cityMuni,
              barangay: null,
              postal: cityMuni?.zip_code || value.postal,
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              size='small'
              error={!!errors.cityMuni}
              placeholder={
                isNCR
                  ? value.region ? 'Select city / municipality' : 'Select region first'
                  : value.province ? 'Select city / municipality' : 'Select province first'
              }
              InputProps={{ ...params.InputProps }}
            />
          )}
        />
      </DropdownField>

      {/* Barangay */}
      <DropdownField label='Barangay'>
        <Autocomplete
          options={barangays}
          getOptionLabel={(o) => o.name}
          isOptionEqualToValue={(a, b) => a.code === b.code}
          value={value.barangay}
          loading={loadingBarangays}
          disabled={!value.cityMuni}
          onChange={(_, barangay) => update({ barangay })}
          renderInput={(params) => (
            <TextField
              {...params}
              size='small'
              placeholder={value.cityMuni ? 'Select barangay' : 'Select city first'}
              InputProps={{ ...params.InputProps }}
            />
          )}
        />
      </DropdownField>

      {/* Lot/Unit + Street */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
        <Input
          id='addr-unit'
          label='Lot / Block / Unit No.'
          value={value.unit}
          onChange={(e) => update({ unit: e.target.value })}
          placeholder='e.g. Lot 5, Blk 3'
        />
        <Input
          id='addr-street'
          label='Street / Road'
          value={value.street}
          onChange={(e) => update({ street: e.target.value })}
          placeholder='e.g. Rizal Avenue'
          required={required}
          error={!!errors.street}
          helperText={errors.street}
        />
      </Box>

      {/* Postal Code */}
      <Box sx={{ maxWidth: 180 }}>
        <Input
          id='addr-postal'
          label='Postal Code'
          value={value.postal}
          onChange={(e) => update({ postal: e.target.value })}
          placeholder='e.g. 1200'
        />
      </Box>

    </Box>
  )
}
