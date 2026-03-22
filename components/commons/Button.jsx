import MuiButton from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

export default function Button({ children, loading, startIcon, ...props }) {
  return (
    <MuiButton
      startIcon={loading ? undefined : startIcon}
      {...props}
      disabled={props.disabled || loading}
    >
      {loading ? (
        <>
          <CircularProgress size={16} thickness={5} sx={{ color: 'inherit', mr: 1 }} />
          {children}
        </>
      ) : (
        children
      )}
    </MuiButton>
  );
}
