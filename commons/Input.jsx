import TextField from '@mui/material/TextField';

export default function Input({ label, id, type = 'text', value, onChange, placeholder, required, minLength, ...props }) {
  return (
    <TextField
      fullWidth
      label={label}
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      slotProps={{ htmlInput: { minLength } }}
      variant="outlined"
      {...props}
    />
  );
}
