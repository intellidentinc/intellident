import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import OutlinedInput from '@mui/material/OutlinedInput'
import FormHelperText from '@mui/material/FormHelperText'

export default function Input({ label, id, required, error, helperText, slotProps, ...props }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {label && (
        <Typography
          component='label'
          htmlFor={id}
          variant='body2'
          fontWeight={500}
          sx={{ color: 'text.primary', userSelect: 'none' }}
        >
          {label}
          {required && (
            <Typography component='span' sx={{ color: '#E05C6A', ml: 0.25 }}>
              *
            </Typography>
          )}
        </Typography>
      )}
      <OutlinedInput id={id} required={required} error={error} fullWidth slotProps={slotProps} {...props} />
      {helperText && (
        <FormHelperText error={error} sx={{ mx: 0, mt: 0 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  )
}
