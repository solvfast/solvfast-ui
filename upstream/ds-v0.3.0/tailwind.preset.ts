// SOLV FAST Design System — Tailwind CSS 3 PRESET (contract: CONSUMING.md §B.5).
// The whole DS theme: dark mode, container, fonts, CSS-variable colours, radius, shadows, keyframes and
// the animate plugin. Moved verbatim from tailwind.config.ts. Consumers add it to their own config:
//   presets: [dsPreset]  +  content: [..., "../../design_system/frontend/src/**/*.{ts,tsx}"]
// Tailwind merges `theme.extend` deeply, but a TOP-LEVEL `theme` key in the consumer's config REPLACES
// the preset's (for example `theme.container`). Put consumer additions under `theme.extend`.
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  theme: {
  	container: {
  		center: true,
  		padding: '1.5rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			// Product font. Geist for Latin; Arabic glyphs (absent in Geist) fall back
  			// automatically to IBM Plex Sans Arabic — so product text auto-switches by language.
  			sans: [
  				'Geist',
  				'IBM Plex Sans Arabic',
  				'system-ui',
  				'sans-serif'
  			],
  			// Explicit Arabic product family (IBM Plex Sans Arabic).
  			arabic: [
  				'IBM Plex Sans Arabic',
  				'system-ui',
  				'sans-serif'
  			],
  			// Brand font — Zain covers both Latin AND Arabic, so brand moments stay Zain in both languages.
  			brand: [
  				'Zain',
  				'IBM Plex Sans Arabic',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'Geist Mono',
  				'ui-monospace',
  				'SFMono-Regular',
  				'monospace'
  			]
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			info: {
  				DEFAULT: 'hsl(var(--info))',
  				foreground: 'hsl(var(--info-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				border: 'hsl(var(--sidebar-border))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			soft: '0 1px 2px 0 hsl(var(--foreground) / 0.05)',
  			card: '0 1px 3px 0 hsl(var(--foreground) / 0.07), 0 1px 2px -1px hsl(var(--foreground) / 0.07)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Partial<Config>;
