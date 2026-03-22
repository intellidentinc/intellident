import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MuiSelect from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';

export default function Select({ label, id, required, error, helperText, options = [], placeholder, ...props }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {label && (
        <Typography
          component="label"
          htmlFor={id}
          variant="body2"
          fontWeight={500}
          sx={{ color: 'text.primary', userSelect: 'none' }}
        >
          {label}
          {required && (
            <Typography component="span" sx={{ color: '#E05C6A', ml: 0.25 }}>
              *
            </Typography>
          )}
        </Typography>
      )}
      <MuiSelect
        inputProps={{ id }}
        required={required}
        error={error}
        fullWidth
        displayEmpty
        {...props}
      >
        {placeholder && (
          <MenuItem value="" disabled>
            <Typography variant="body2" color="text.disabled">
              {placeholder}
            </Typography>
          </MenuItem>
        )}
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </MuiSelect>
      {helperText && (
        <FormHelperText error={error} sx={{ mx: 0, mt: 0 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  );
}
