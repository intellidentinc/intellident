import { createTheme } from '@mui/material/styles';

export const colors = {
  primaryBlue: '#2563eb',   // CTAs, buttons, active states, nav highlights
  softSky: '#60a5fa',       // hover states, icons, secondary buttons
  lightBlue: '#dbeafe',     // card backgrounds, badges, tags
  mist: '#F8FAFC',          // page background, section dividers
  white: '#ffffff',         // cards, modals, input fields
  slateText: '#334155',     // body text, labels, headings
};

const theme = createTheme({
  palette: {
    primary: {
      main: colors.primaryBlue,
      light: colors.softSky,
    },
    background: {
      default: colors.mist,
      paper: colors.white,
    },
    text: {
      primary: colors.slateText,
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: 'var(--font-inter), sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          padding: '10px 20px',
        },
        containedPrimary: {
          backgroundColor: colors.primaryBlue,
          color: colors.white,
          '&:hover': {
            backgroundColor: '#1d4ed8',
          },
          '&:disabled': {
            backgroundColor: colors.lightBlue,
            color: colors.softSky,
          },
        },
        outlinedPrimary: {
          borderColor: colors.softSky,
          color: colors.primaryBlue,
          '&:hover': {
            backgroundColor: colors.lightBlue,
            borderColor: colors.primaryBlue,
          },
        },
        textPrimary: {
          color: colors.primaryBlue,
          '&:hover': {
            backgroundColor: colors.lightBlue,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: colors.white,
          borderRadius: 8,
          fontSize: '0.875rem',
          '& fieldset': {
            borderColor: '#e2e8f0',
          },
          '&:hover fieldset': {
            borderColor: colors.softSky,
          },
          '&.Mui-focused fieldset': {
            borderColor: colors.primaryBlue,
            borderWidth: '1.5px',
          },
          '&.Mui-error fieldset': {
            borderColor: '#ef4444',
          },
        },
        input: {
          padding: '11px 14px',
          color: colors.slateText,
          '&::placeholder': {
            color: '#94a3b8',
            opacity: 1,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
        elevation3: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: '0.875rem',
          fontWeight: 500,
        },
        filledSuccess: {
          backgroundColor: '#16a34a',
        },
        filledError: {
          backgroundColor: '#dc2626',
        },
        filledInfo: {
          backgroundColor: colors.primaryBlue,
        },
        filledWarning: {
          backgroundColor: '#d97706',
        },
      },
    },
  },
});

export default theme;
