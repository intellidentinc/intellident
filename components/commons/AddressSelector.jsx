'use client'

import { useState, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import FormHelperText from '@mui/material/FormHelperText'
import Input from '@/components/commons/Input'

const BASE = 'https://psgc.cloud/api'
const GITLAB_BASE = 'https://psgc.gitlab.io/api'
const NCR_CODE = '1300000000'
const NCR_REGION_CODE_9 = '130000000'

// Natural sort order for congressional district labels (province districts)
const DISTRICT_ORDER = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

export const EMPTY_ADDRESS = {
  unit: '',
  street: '',
  region: null,      // { name, code }
  province: null,    // { name, code } | null (null for NCR)
  district: null,    // { name, code } | null
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
  const [ncrDistricts, setNcrDistricts] = useState([])  // [{name, code}] fetched from PSGC for NCR
  const [allCitiesMunis, setAllCitiesMunis] = useState([])
  const [barangays, setBarangays] = useState([])

  const [loadingRegions, setLoadingRegions] = useState(true)
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [loadingNcrDistricts, setLoadingNcrDistricts] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingBarangays, setLoadingBarangays] = useState(false)

  const isNCR = value.region?.code === NCR_CODE

  // For NCR: city loading is triggered by a selected district's PSGC code.
  // value.district is always { name, code } (object) or null.
  // For provinces: legacy string districts are also wrapped as { name, code } objects.
  const ncrDistrictCode = isNCR && value.district?.code ? value.district.code : null

  // District options are always objects { name, code }.
  // NCR: fetched from PSGC districts endpoint.
  // Province: derived from allCitiesMunis city.district strings, wrapped as objects.
  const districtOptions = useMemo(() => {
    if (isNCR) return ncrDistricts
    const raw = [...new Set(allCitiesMunis.map((c) => c.district).filter((d) => d && d !== 'Lone'))]
    const sorted = raw.sort((a, b) => {
      const ai = DISTRICT_ORDER.indexOf(a)
      const bi = DISTRICT_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    return sorted.map((d) => ({ name: `${d} District`, code: d }))
  }, [allCitiesMunis, isNCR, ncrDistricts])

  // Resolve value.district to an Autocomplete-compatible value.
  // value.district is { name, code } for NCR, or a legacy string for provinces.
  const districtValue = useMemo(() => {
    if (!value.district) return null
    if (typeof value.district === 'object') return value.district
    // Legacy string (province): find in options by code
    return districtOptions.find((d) => d.code === value.district) ?? null
  }, [value.district, districtOptions])

  // Filter city list by selected district (province only; NCR loads per district).
  const citiesMunis = useMemo(() => {
    if (isNCR || !value.district) return allCitiesMunis
    const code = value.district?.code ?? value.district
    return allCitiesMunis.filter((c) => c.district === code)
  }, [allCitiesMunis, isNCR, value.district])

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

  // Load NCR districts when NCR is selected — psgc.cloud has no districts endpoint,
  // so we use psgc.gitlab.io which has proper district data.
  useEffect(() => {
    if (!isNCR) { setNcrDistricts([]); return }
    setLoadingNcrDistricts(true)
    fetchJson(`${GITLAB_BASE}/districts.json`)
      .then((data) => {
        const ncrOnly = data.filter((d) => d.regionCode === NCR_REGION_CODE_9)
        return ncrOnly
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((d) => ({ name: d.name.trim(), code: d.code }))
      })
      .then(setNcrDistricts)
      .catch(() => setNcrDistricts([]))
      .finally(() => setLoadingNcrDistricts(false))
  }, [isNCR]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load cities/munis:
  //   NCR — per selected district via psgc.gitlab.io (psgc.cloud has no district-city endpoint)
  //   Province — all cities for the selected province via psgc.cloud
  useEffect(() => {
    if (isNCR) {
      if (!ncrDistrictCode) { setAllCitiesMunis([]); return }
      setLoadingCities(true)
      // NCR districts have cities only — municipalities endpoint returns empty.
      // psgc.gitlab.io returns proper UTF-8 and district-filtered cities;
      // psgc.cloud has zip codes but no district filtering — fetch both and merge.
      Promise.all([
        fetchJson(`${GITLAB_BASE}/districts/${ncrDistrictCode}/cities.json`),
        fetchJson(`${BASE}/regions/${NCR_CODE}/cities`),
      ])
        .then(([gitlabCities, cloudCities]) => {
          // Match gitlab cities against psgc.cloud cities to get correct codes
          // and zip codes. Try name first (after fixing psgc.cloud's ñ encoding),
          // then fall back to psgc10DigitCode so neither encoding nor numbering
          // differences cause a missed lookup.
          const fixedCloud = fixNames(cloudCities)
          const cloudByName = new Map(fixedCloud.map((c) => [c.name, c]))
          const cloudByCode = new Map(fixedCloud.map((c) => [c.code, c]))
          const normalized = gitlabCities.map((c) => {
            const name = c.name.trim()
            const code10 = c.psgc10DigitCode || c.code
            const cloud = cloudByName.get(name) ?? cloudByCode.get(code10)
            return {
              name,
              code: cloud?.code ?? code10,
              type: cloud?.type ?? 'City',
              zip_code: cloud?.zip_code ?? '',
              district: null,
            }
          })
          setAllCitiesMunis(normalized.sort((a, b) => a.name.localeCompare(b.name)))
        })
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
  }, [value.province?.code, isNCR, value.region?.code, ncrDistrictCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load barangays when city/municipality changes
  useEffect(() => {
    if (!value.cityMuni) { setBarangays([]); return }
    setLoadingBarangays(true)
    const type = value.cityMuni.type === 'Mun' ? 'municipalities' : 'cities'
    const cityCode = value.cityMuni.code
    fetchJson(`${BASE}/${type}/${cityCode}/barangays`)
      .then((data) => {
        if (data.length > 0) return data
        // Some NCR cities (e.g. Manila) have sub-municipalities as an intermediate
        // level — barangays sit under sub-municipalities, not the city directly.
        if (value.region?.code !== NCR_CODE) return data
        const prefix = cityCode.slice(0, 6)
        return fetchJson(`${BASE}/regions/${NCR_CODE}/sub-municipalities`)
          .then((subMunis) => {
            const citySubMunis = subMunis.filter(
              (s) => s.code.startsWith(prefix) && s.code !== cityCode
            )
            return Promise.all(
              citySubMunis.map((s) => fetchJson(`${BASE}/sub-municipalities/${s.code}/barangays`))
            ).then((arrays) => arrays.flat())
          })
      })
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

      {/* District — always shown.
          NCR: required step before city (fetched from PSGC districts endpoint).
          Province: optional filter derived from loaded cities. */}
      <DropdownField label='District'>
        <Autocomplete
          options={districtOptions}
          getOptionLabel={(o) => o.name}
          isOptionEqualToValue={(a, b) => a.code === b.code}
          value={districtValue}
          disabled={districtOptions.length < 2 && !loadingNcrDistricts}
          loading={isNCR ? loadingNcrDistricts : false}
          onChange={(_, district) =>
            update({ district, cityMuni: null, barangay: null, postal: '' })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              size='small'
              placeholder={
                !value.region ? 'Select region first'
                : !isNCR && !value.province ? 'Select province first'
                : loadingNcrDistricts ? 'Loading districts...'
                : districtOptions.length < 2 ? 'Not applicable'
                : isNCR ? 'Select district'
                : 'Filter by district (optional)'
              }
              InputProps={{ ...params.InputProps }}
            />
          )}
        />
      </DropdownField>

      {/* City / Municipality — NCR requires district first */}
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
          disabled={isNCR ? !ncrDistrictCode : !value.province}
          onChange={(_, cityMuni) =>
            update({
              cityMuni,
              barangay: null,
              postal: Number(cityMuni?.zip_code) > 0 ? String(cityMuni.zip_code) : value.postal,
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              size='small'
              error={!!errors.cityMuni}
              placeholder={
                isNCR
                  ? !value.region ? 'Select region first'
                  : !ncrDistrictCode ? 'Select district first'
                  : 'Select city / municipality'
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
