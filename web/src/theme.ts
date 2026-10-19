import { theme } from 'antd'
import type { ThemeConfig } from 'antd'

export const palette = {
  canvas: '#080808',
  canvasSoft: '#0c0c0b',
  panel: '#131311',
  panelRaised: '#1a1a17',
  line: '#262620',
  lineSoft: '#1e1e1a',
  ink: '#f8f8f6',
  ink2: '#b8b0a8',
  ink3: '#a09a92',
  gold: '#e8c060',
  goldStrong: '#d89048',
  ok: '#5fd08a',
  warn: '#e8a34c',
  danger: '#e5645e',
} as const

const fontFamily =
  "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif"

export const antdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: palette.gold,
    colorInfo: palette.gold,
    colorSuccess: palette.ok,
    colorWarning: palette.warn,
    colorError: palette.danger,
    colorBgBase: palette.canvas,
    colorBgContainer: palette.panel,
    colorBgElevated: '#101010',
    colorBgLayout: palette.canvas,
    colorBorder: palette.line,
    colorBorderSecondary: palette.lineSoft,
    colorText: palette.ink,
    colorTextSecondary: palette.ink2,
    colorTextTertiary: palette.ink3,
    colorTextQuaternary: '#7f7971',
    fontFamily,
    fontSize: 14,
    borderRadius: 10,
    borderRadiusLG: 14,
    controlHeight: 38,
    lineWidth: 1,
    wireframe: false,
  },
  components: {
    Button: {
      fontWeight: 500,
      primaryColor: '#241c07',
      colorPrimaryHover: '#f0cf7a',
      colorPrimaryActive: '#d8ae4c',
      defaultBg: 'transparent',
      defaultBorderColor: palette.line,
      defaultColor: palette.ink2,
      defaultHoverBg: palette.panelRaised,
      defaultHoverBorderColor: '#3a3a32',
      defaultHoverColor: palette.ink,
      paddingInline: 16,
    },
    Input: {
      colorBgContainer: '#0f0f0e',
      colorBorder: palette.line,
      hoverBorderColor: '#3a3a32',
      activeBorderColor: palette.gold,
      activeShadow: '0 0 0 3px rgba(232, 192, 96, 0.12)',
      paddingInline: 12,
      colorTextPlaceholder: '#6b645c',
    },
    Drawer: {
      colorBgElevated: '#0c0c0b',
      paddingLG: 20,
      colorIcon: palette.ink2,
      colorIconHover: palette.ink,
    },
    Checkbox: {
      colorBgContainer: 'transparent',
      colorBorder: '#3a3a32',
      colorPrimary: palette.gold,
      colorPrimaryHover: palette.gold,
      borderRadiusSM: 4,
    },
    Segmented: {
      itemColor: palette.ink3,
      itemHoverColor: palette.ink,
      itemSelectedBg: palette.panelRaised,
      itemSelectedColor: palette.ink,
      itemHoverBg: '#1f1f1b',
      trackBg: '#0d0d0c',
      trackPadding: 3,
      borderRadius: 8,
    },
    Tooltip: {
      colorBgSpotlight: '#1f1f1b',
      colorTextLightSolid: palette.ink,
      fontSize: 12,
    },
    Message: {
      contentBg: '#16160f',
    },
    Modal: {
      contentBg: '#0f0f0e',
      headerBg: 'transparent',
    },
    Empty: {
      colorTextDescription: palette.ink3,
    },
  },
}
