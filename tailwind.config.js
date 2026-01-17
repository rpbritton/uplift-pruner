/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				strava: '#FC4C02',
				primary: {
					50: '#f0fdfa',
					100: '#ccfbf1',
					200: '#99f6e4',
					300: '#5eead4',
					400: '#2dd4bf',
					500: '#14b8a6',
					600: '#138A7B', // Main brand color from icon
					700: '#0f766e',
					800: '#115e59',
					900: '#134e4a',
					950: '#042f2e'
				},
				accent: {
					amber: '#FBBF24', // Warmer golden hover color
					red: '#F87171' // Selected/removal color
				}
			}
		}
	},
	plugins: []
};
