import { createTheme } from '@mui/material/styles';

export const colors = {
  primaryBlue: '#2563eb',   // CTAs, buttons, active states, nav highlights
  primaryDark: '#1d4ed8',   // hover for primary
  softSky: '#60a5fa',       // hover states, icons, secondary buttons
  lightBlue: '#dbeafe',     // card backgrounds, badges, tags
  paleBlue: '#eff6ff',      // tinted icon backgrounds
  mist: '#F8FAFC',          // page background, section dividers
  surface: '#f8fafc',       // subtle surface / table head
  white: '#ffffff',         // cards, modals, input fields
  ink: '#0f172a',           // headings, strongest text
  slateText: '#334155',     // body text, labels
  muted: '#64748b',         // secondary text
  faint: '#94a3b8',         // placeholder / tertiary text
  border: '#e2e8f0',        // default borders
  borderStrong: '#cbd5e1',  // hover borders
};

// Consistent elevation scale — soft, layered, light-mode tuned.
export const shadows = {
  sm: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
  md: '0 2px 4px -1px rgb(15 23 42 / 0.05), 0 4px 10px -2px rgb(15 23 42 / 0.07)',
  lg: '0 8px 24px -4px rgb(15 23 42 / 0.10), 0 4px 8px -4px rgb(15 23 42 / 0.06)',
  hover: '0 4px 14px -2px rgb(37 99 235 / 0.12), 0 2px 6px -2px rgb(15 23 42 / 0.06)',
};

// Shared radius tokens (px) used across the system design language.
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

const theme = createTheme({
  palette: {
    primary: {
      main: colors.primaryBlue,
      light: colors.softSky,
      dark: colors.primaryDark,
    },
    background: {
      default: colors.mist,
      paper: colors.white,
    },
    text: {
      primary: colors.slateText,
      secondary: colors.muted,
    },
    divider: colors.border,
  },
  typography: {
    fontFamily: 'var(--font-inter), sans-serif',
    h4: { fontWeight: 800, letterSpacing: '-0.5px', color: colors.ink },
    h5: { fontWeight: 700, letterSpacing: '-0.3px', color: colors.ink },
    h6: { fontWeight: 700, letterSpacing: '-0.2px', color: colors.ink },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body2: { lineHeight: 1.5 },
    caption: { color: colors.faint },
    overline: {
      fontWeight: 700,
      letterSpacing: '1.2px',
      fontSize: '0.68rem',
      color: colors.faint,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: radii.sm,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: radii.sm,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          padding: '10px 20px',
        },
        containedPrimary: {
          backgroundColor: colors.primaryBlue,
          color: colors.white,
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: colors.primaryDark,
            boxShadow: shadows.hover,
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
          borderRadius: radii.sm,
          fontSize: '0.875rem',
          '& fieldset': {
            borderColor: colors.border,
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
            color: colors.faint,
            opacity: 1,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: radii.md,
          backgroundImage: 'none',
        },
        elevation1: { boxShadow: shadows.sm },
        elevation2: { boxShadow: shadows.sm },
        elevation3: { boxShadow: shadows.md },
        elevation4: { boxShadow: shadows.lg },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: radii.lg,
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.sm,
          backgroundImage: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontSize: '0.72rem',
        },
        sizeSmall: {
          height: 22,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#f1f5f9',
          fontSize: '0.84rem',
        },
        head: {
          backgroundColor: colors.surface,
          color: colors.muted,
          fontWeight: 700,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: colors.surface,
          },
          '&:last-child td': {
            borderBottom: 0,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: radii.xl,
          boxShadow: shadows.lg,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.ink,
          borderRadius: 8,
          fontSize: '0.72rem',
          fontWeight: 500,
          padding: '6px 10px',
        },
        arrow: {
          color: colors.ink,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: radii.sm,
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
